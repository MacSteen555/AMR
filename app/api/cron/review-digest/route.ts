import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildReviewDigestEmail } from '@/lib/email/templates/review-digest'
import { createUnsubscribeToken } from '@/lib/email/digest-token'
import { draftReply } from '@/lib/openai/draft'
import { generateDigestSummary } from '@/lib/openai/digest-summary'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const now = new Date()
  const isMonday = now.getUTCDay() === 1

  // Fetch all active digest preferences with user + team + subscription data
  const { data: preferences, error: prefError } = await supabase
    .schema('app')
    .from('team_memberships')
    .select(`
      user_id,
      team_id,
      digest_frequency,
      digest_last_sent_at,
      created_at,
      user:users(email, display_name),
      team:teams(name, deleted_at)
    `)
    .neq('digest_frequency', 'off')

  if (prefError || !preferences) {
    return NextResponse.json({ error: 'Failed to fetch preferences', details: prefError?.message }, { status: 500 })
  }

  // Filter: daily runs every day, weekly runs on Mondays only
  const duePreferences = preferences.filter((p: any) => {
    if (p.team?.deleted_at) return false
    if (p.digest_frequency === 'daily') return true
    if (p.digest_frequency === 'weekly') return isMonday
    return false
  })

  // Verify tiers in bulk
  const teamIds = [...new Set(duePreferences.map((p: any) => p.team_id))]
  const { data: subscriptions } = await supabase
    .schema('app')
    .from('team_subscriptions')
    .select('team_id, tier')
    .in('team_id', teamIds)

  const tierMap = new Map((subscriptions || []).map((s: any) => [s.team_id, s.tier]))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const pref of duePreferences) {
    const p = pref as any
    const tier = tierMap.get(p.team_id) || 'FREE'

    // Tier gate: FREE gets nothing, PRO gets weekly only
    if (tier === 'FREE') { skipped++; continue }
    if (p.digest_frequency === 'daily' && !['BUSINESS', 'ENTERPRISE'].includes(tier)) { skipped++; continue }

    try {
      // Query new reviews since last digest (or since membership creation)
      const since = p.digest_last_sent_at || p.created_at
      const { data: reviews } = await supabase
        .schema('app')
        .from('google_reviews')
        .select('id, reviewer_name, rating, comment, reply_status, location:locations(id, name, team_id, brand_voice, positive_sentiment, negative_sentiment, signature, reply_language)')
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!reviews || reviews.length === 0) { skipped++; continue }

      // Filter to only reviews belonging to this team
      const validReviews = reviews.filter((r: any) => r.location && r.location.team_id === p.team_id)

      if (validReviews.length === 0) { skipped++; continue }

      // Generate drafts for reviews needing replies
      const reviewsWithDrafts = await Promise.all(
        validReviews.map(async (r: any) => {
          if (r.reply_status !== 'none') {
            return { ...r, draftPreview: null }
          }
          try {
            const draft = await draftReply(
              { id: r.id, rating: r.rating, comment: r.comment, reviewer_name: r.reviewer_name },
              {
                location_id: r.location?.id,
                brand_voice: r.location?.brand_voice,
                positive_sentiment: r.location?.positive_sentiment,
                negative_sentiment: r.location?.negative_sentiment,
                signature: r.location?.signature,
                reply_language: r.location?.reply_language,
              }
            )

            // Save draft to DB so it's ready when user opens the app
            await supabase
              .schema('app')
              .from('google_reviews')
              .update({
                draft_text: draft,
                reply_status: 'draft',
                draft_updated_at: new Date().toISOString(),
                llm_last_generated_at: new Date().toISOString(),
                llm_model: 'gpt-4o-mini',
              })
              .eq('id', r.id)

            return { ...r, draftPreview: draft }
          } catch (err) {
            // Draft generation failed — continue without draft
            return { ...r, draftPreview: null }
          }
        })
      )

      // Generate sentiment summary
      let summaryParagraph: string | undefined
      try {
        summaryParagraph = await generateDigestSummary(
          validReviews.map((r: any) => ({
            rating: r.rating,
            comment: r.comment,
            reviewer_name: r.reviewer_name,
            location_name: r.location?.name || 'Unknown',
          })),
          p.team?.name || 'Your Team'
        )
      } catch {
        // Summary generation failed — send email without it
      }

      const needsReply = validReviews.filter((r: any) => r.reply_status === 'none').length
      const avgRating = (validReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / validReviews.length).toFixed(1)

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://automyreply.com'
      const teamUrl = `${appBaseUrl}/teams/${p.team_id}/reviews`
      const unsubToken = createUnsubscribeToken({ userId: p.user_id, teamId: p.team_id })
      const unsubscribeUrl = `${appBaseUrl}/api/digest/unsubscribe?token=${unsubToken}`

      const { subject, html } = buildReviewDigestEmail({
        teamName: p.team?.name || 'Your Team',
        newReviewCount: validReviews.length,
        needsReplyCount: needsReply,
        avgRating,
        reviews: reviewsWithDrafts.map((r: any) => ({
          reviewerName: r.reviewer_name,
          rating: r.rating,
          comment: r.comment || '',
          locationName: r.location?.name || 'Unknown',
          replyStatus: r.reply_status,
          draftPreview: r.draftPreview || undefined,
        })),
        teamUrl,
        unsubscribeUrl,
        summaryParagraph,
      })

      await sendEmail({ to: p.user?.email, subject, html })

      // Update last_sent_at
      await supabase
        .schema('app')
        .from('team_memberships')
        .update({ digest_last_sent_at: now.toISOString() })
        .eq('user_id', p.user_id)
        .eq('team_id', p.team_id)

      sent++
    } catch (err: any) {
      errors.push(`${p.user_id}/${p.team_id}: ${err.message}`)
    }
  }

  return NextResponse.json({ sent, skipped, errors: errors.length > 0 ? errors : undefined })
}
