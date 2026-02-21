import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { updateReply } from '@/lib/google/gbp'

export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
    try {
        const user = await requireUser()
        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Fetch Review & Location
        const { data: review } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*, locations(google_location_id, google_account_hint)')
            .eq('id', params.reviewId)
            .single()

        if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

        // We expect a draft to exist, or the user sent a body with content?
        // Let's support body content override, else use draft.
        const body = await request.json().catch(() => ({}))
        const replyText = body.reply_text || review.draft_text

        if (!replyText) {
            return NextResponse.json({ error: 'No text to publish' }, { status: 400 })
        }

        const loc = review.locations
        if (!loc || !loc.google_account_hint) {
            return NextResponse.json({ error: 'Location not configured for sync' }, { status: 400 })
        }

        // 2. Publish to Google
        await updateReply(
            loc.google_account_hint,
            loc.google_location_id,
            review.google_review_id,
            replyText,
            user.id
        )
        // 3. Update DB
        const { data: updated } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .update({
                reply_status: 'posted',
                reply_text: replyText,
                draft_text: null, // Clear draft provided it posted successfully
            })
            .eq('id', params.reviewId)
            .select()
            .single()

        return NextResponse.json({ review: updated })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
