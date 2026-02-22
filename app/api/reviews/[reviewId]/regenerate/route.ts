import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReply } from '@/lib/openai/draft'

/**
 * POST /api/reviews/[reviewId]/regenerate
 * 
 * Regenerates a draft reply without changing reply_status.
 * Used for posted/history reviews so they stay in the History tab.
 */
export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
    try {
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

        // Read body for previous draft context
        const body = await request.json().catch(() => ({}))
        const previousDraft = body.previous_draft

        // Generate new draft
        const draft = await draftReply({
            rating: review.rating,
            comment: review.comment,
            reviewer_name: review.reviewer_name,
            review_date: review.review_date
        }, {
            brand_voice: location.brand_voice,
            positive_sentiment: location.positive_sentiment,
            negative_sentiment: location.negative_sentiment,
            reply_language: location.reply_language
        }, previousDraft)

        // Save draft WITHOUT changing reply_status
        const { data: updated } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .update({
                draft_text: draft,
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
