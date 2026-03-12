import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/openai/draft'
import { resolveSignature } from '@/lib/draft-signature'
import { spendCredits } from '@/lib/billing/credits'
import { updateDraftSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
  try {
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get review with location
    const { data: review } = await supabase
      .schema('app')
      .from('google_reviews')
      .select('*, location:locations!inner(team_id, name, brand_voice, positive_sentiment, negative_sentiment, signature, reply_language, teams(name))')
      .eq('id', params.reviewId)
      .single()

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Spend credit
    await spendCredits(
      review.location.team_id,
      user.id,
      'reply_generate',
      1,
      'review',
      params.reviewId,
      idempotencyKey
    )

    // Optional relation typing 
    const teamData = review.location.teams as { name: string } | null
    const teamName = teamData?.name

    const resolvedSignature = resolveSignature(review.location.signature, {
      locationName: review.location.name,
      teamName,
      userName: user.display_name || user.email,
    })

    // Generate draft
    const draftText = await draftReply(
      {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reviewer_name: review.reviewer_name,
        review_date: review.review_date,
      },
      {
        location_id: review.location_id,
        brand_voice: review.location.brand_voice,
        positive_sentiment: review.location.positive_sentiment,
        negative_sentiment: review.location.negative_sentiment,
        signature: resolvedSignature,
        reply_language: review.location.reply_language,
      }
    )

    // Save draft
    await serviceClient
      .schema('app')
      .from('google_reviews')
      .update({
        draft_text: draftText,
        reply_status: 'draft',
        draft_updated_at: new Date().toISOString(),
        llm_last_generated_at: new Date().toISOString(),
        llm_model: 'gpt-4o-mini',
      })
      .eq('id', params.reviewId)

    // Save draft history
    await serviceClient.schema('app').from('review_drafts').insert({
      review_id: params.reviewId,
      author_user_id: user.id,
      content: draftText,
    })

    return NextResponse.json({ draft_text: draftText })
  } catch (error: any) {
    if (error.message.includes('Insufficient credits') || error.message.includes('Requires')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
    captureRouteError(error, { route: '/api/reviews/[reviewId]/draft' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { reviewId: string } }) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const data = updateDraftSchema.parse(body)

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Verify access
    const { data: review } = await supabase
      .schema('app')
      .from('google_reviews')
      .select('location_id')
      .eq('id', params.reviewId)
      .single()

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Update draft
    await serviceClient
      .schema('app')
      .from('google_reviews')
      .update({
        draft_text: data.draft_text,
        draft_updated_at: new Date().toISOString(),
      })
      .eq('id', params.reviewId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/reviews/[reviewId]/draft' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

