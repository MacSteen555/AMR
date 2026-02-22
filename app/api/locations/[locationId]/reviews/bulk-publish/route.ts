import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { updateReply } from '@/lib/google/gbp'

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
    try {
        const { canManage } = await requireLocationAccess(params.locationId)
        if (!canManage) throw new Error('Permission denied')

        const user = await requireUser()
        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Get Location (for account hint)
        const { data: location } = await serviceClient
            .schema('app')
            .from('locations')
            .select('google_location_id, google_account_hint')
            .eq('id', params.locationId)
            .single()

        if (!location || !location.google_account_hint) {
            return NextResponse.json({ error: 'Location not configured for Google sync' }, { status: 400 })
        }

        // 2. Fetch drafts to publish
        const { data: drafts } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .eq('location_id', params.locationId)
            .eq('reply_status', 'draft')
            .not('draft_text', 'is', null) // Safety check

        if (!drafts || drafts.length === 0) {
            return NextResponse.json({ published: 0, message: 'No drafts found to publish.' })
        }

        // 3. Publish in Parallel
        let publishedCount = 0
        const results = await Promise.all(drafts.map(async (review) => {
            try {
                // Push to Google
                await updateReply(
                    location.google_account_hint!, // This might be 'accounts/123'
                    location.google_location_id,   // distinct from DB id? yes, schema has google_location_id
                    review.google_review_id,
                    review.draft_text,
                    user.id // Pass user ID for auth token retrieval
                )

                // Update DB
                await serviceClient
                    .schema('app')
                    .from('google_reviews')
                    .update({
                        reply_status: 'posted',
                        reply_text: review.draft_text, // It's live now
                        draft_text: null // Clear draft? Or keep it? Usually keep history but field implies 'current active draft'. Let's keep it or clear it. Let's clear it to signify done. Or better, keep it but status changes. 
                        // Actually, if we clear it, we lose record of what we drafted.
                        // But if we copy to reply_text, we have it.
                    })
                    .eq('id', review.id)

                return true
            } catch (error) {
                console.error(`Failed to publish review ${review.id}:`, error)
                // Update status to 'failed'? Or keep 'draft' so user can retry.
                return false
            }
        }))

        publishedCount = results.filter(Boolean).length

        return NextResponse.json({ published: publishedCount })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
