import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/openai/draft'
import { resolveSignature } from '@/lib/draft-signature'
import { captureRouteError } from '@/lib/sentry'

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
    try {
        const user = await requireUser()
        await requireLocationAccess(params.locationId)
        const body = await request.json()
        const limit = body.limit || 10

        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Get Location Settings
        const { data: location } = await serviceClient
            .schema('app')
            .from('locations')
            .select('id, name, team_id, brand_voice, positive_sentiment, negative_sentiment, signature, reply_language')
            .eq('id', params.locationId)
            .single()

        if (!location) throw new Error('Location not found')

        let teamName: string | undefined
        if (location.team_id) {
            const { data: team } = await serviceClient
                .schema('app')
                .from('teams')
                .select('name')
                .eq('id', location.team_id)
                .single()
            teamName = team?.name
        }

        const resolvedSignature = resolveSignature(location.signature, {
            locationName: location.name,
            teamName,
            userName: user.display_name || user.email,
        })

        // 2. Fetch unreplied reviews without drafts
        // We target reviews that have no reply_text (or reply_status is 'none')
        // and no draft_text yet.
        const { data: reviews } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .eq('location_id', params.locationId)
            .or('reply_status.eq.none,reply_status.is.null') // Only untouched ones
            .is('draft_text', null) // Only if not already drafted?
            .order('review_date', { ascending: false })
            .limit(limit)

        if (!reviews || reviews.length === 0) {
            return NextResponse.json({ generated: 0, message: 'No unreplied reviews found to draft.' })
        }

        // 3. Generate Drafts in Parallel
        let generatedCount = 0

        // We chunk promises to avoid hitting rate limits too hard if limit is high
        const updates = await Promise.all(reviews.map(async (review) => {
            try {
                const draft = await draftReply({
                    id: review.id,
                    rating: review.rating,
                    comment: review.comment,
                    reviewer_name: review.reviewer_name,
                    review_date: review.review_date
                }, {
                    location_id: location.id,
                    brand_voice: location.brand_voice,
                    positive_sentiment: location.positive_sentiment,
                    negative_sentiment: location.negative_sentiment,
                    signature: resolvedSignature,
                    reply_language: location.reply_language
                })

                // Update Review in DB
                await serviceClient
                    .schema('app')
                    .from('google_reviews')
                    .update({
                        draft_text: draft,
                        reply_status: 'draft' // Mark as having a draft
                    })
                    .eq('id', review.id)

                return true
            } catch (error) {
                console.error(`Failed to draft for review ${review.id}:`, error)
                return false
            }
        }))

        generatedCount = updates.filter(Boolean).length

        return NextResponse.json({ generated: generatedCount })
    } catch (error: any) {
        captureRouteError(error, { route: '/api/locations/[locationId]/reviews/bulk-generate', extra: { locationId: params.locationId } })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
