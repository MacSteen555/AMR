import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/openai/draft'
import { resolveSignature } from '@/lib/draft-signature'

export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
    try {
        // 1. Auth & Review Lookup
        const user = await requireUser()
        const serviceClient = createSupabaseServiceRoleClient()

        const { data: review } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*, locations(*)')
            .eq('id', params.reviewId)
            .single()

        if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

        const locData = review.locations
        const location = Array.isArray(locData) ? locData[0] : locData

        let teamName: string | undefined
        if (location?.team_id) {
            const { data: team } = await serviceClient
                .schema('app')
                .from('teams')
                .select('name')
                .eq('id', location.team_id)
                .single()
            teamName = team?.name
        }

        const resolvedSignature = resolveSignature(location?.signature, {
            locationName: location?.name,
            teamName,
            userName: user.display_name || user.email,
        })

        const body = await request.json().catch(() => ({}))
        const previousDraft = body.previous_draft

        const draft = await draftReply({
            rating: review.rating,
            comment: review.comment,
            reviewer_name: review.reviewer_name,
            review_date: review.review_date
        }, {
            brand_voice: location.brand_voice,
            positive_sentiment: location.positive_sentiment,
            negative_sentiment: location.negative_sentiment,
            signature: resolvedSignature,
            reply_language: location.reply_language
        }, previousDraft)

        // 3. Save Draft
        const { data: updated } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .update({
                draft_text: draft,
                reply_status: 'draft',
                draft_updated_at: new Date().toISOString(),
                llm_last_generated_at: new Date().toISOString(),
                llm_model: 'gpt-5-nano'
            })
            .eq('id', params.reviewId)
            .select()
            .single()

        return NextResponse.json({ review: updated })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
