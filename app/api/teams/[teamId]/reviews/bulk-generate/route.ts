import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/openai/draft'
import { resolveSignature } from '@/lib/draft-signature'

// POST /api/teams/[teamId]/reviews/bulk-generate
export async function POST(request: Request, { params }: { params: { teamId: string } }) {
    try {
        const user = await requireUser()
        await requireTeamMember(params.teamId)
        const body = await request.json()
        const limit = body.limit || 20

        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Get All Locations & Settings
        const [{ data: locations }, { data: team }] = await Promise.all([
            serviceClient
                .schema('app')
                .from('locations')
                .select('id, name, brand_voice, positive_sentiment, negative_sentiment, signature, reply_language')
                .eq('team_id', params.teamId),
            serviceClient.schema('app').from('teams').select('name').eq('id', params.teamId).single(),
        ])

        if (!locations || locations.length === 0) return NextResponse.json({ generated: 0 })

        const teamName = team?.name
        const locationSettingsMap = new Map(
            locations.map(l => [
                l.id,
                {
                    ...l,
                    resolvedSignature: resolveSignature(l.signature, {
                        locationName: l.name,
                        teamName,
                        userName: user.display_name || user.email,
                    }),
                },
            ])
        )
        const locationIds = locations.map(l => l.id)

        // 2. Fetch unreplied reviews for these locations
        const { data: reviews } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .in('location_id', locationIds)
            .or('reply_status.eq.none,reply_status.is.null')
            .is('draft_text', null)
            .order('review_date', { ascending: false })
            .limit(limit)

        if (!reviews || reviews.length === 0) {
            return NextResponse.json({ generated: 0 })
        }

        // 3. Generate
        const updates = await Promise.all(reviews.map(async (review) => {
            const settings = locationSettingsMap.get(review.location_id)
            if (!settings) return false

            try {
                const draft = await draftReply({
                    id: review.id,
                    rating: review.rating,
                    comment: review.comment,
                    reviewer_name: review.reviewer_name,
                    review_date: review.review_date
                }, {
                    location_id: review.location_id,
                    brand_voice: settings.brand_voice,
                    positive_sentiment: settings.positive_sentiment,
                    negative_sentiment: settings.negative_sentiment,
                    signature: settings.resolvedSignature,
                    reply_language: settings.reply_language
                })

                await serviceClient
                    .schema('app')
                    .from('google_reviews')
                    .update({
                        draft_text: draft,
                        reply_status: 'draft',
                        draft_updated_at: new Date().toISOString(),
                        llm_last_generated_at: new Date().toISOString(),
                        llm_model: 'gpt-5-nano'
                    })
                    .eq('id', review.id)

                return true
            } catch (e) {
                return false
            }
        }))

        return NextResponse.json({ generated: updates.filter(Boolean).length })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
