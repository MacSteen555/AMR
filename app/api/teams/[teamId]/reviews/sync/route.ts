import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { listReviews } from '@/lib/google/gbp'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
    try {
        await requireTeamMember(params.teamId)
        const user = await requireUser()
        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Get Locations
        const { data: locations } = await serviceClient
            .schema('app')
            .from('locations')
            .select('id, google_location_id, google_account_hint')
            .eq('team_id', params.teamId)

        if (!locations || locations.length === 0) return NextResponse.json({ synced: 0 })

        let totalSynced = 0
        const errors: string[] = []

        // 2. Sync Parallel (limited concurrency ideally, but for now 50 locations is "okay" if small app)
        // To be safe we should chunk it.

        // Helper to sync one location
        const syncLocation = async (loc: any) => {
            if (!loc.google_account_hint) return false
            try {
                // First page only for "Sync All" to save quota/time? Or full sync?
                // Let's do first page (50 items) for speed.
                const { reviews } = await listReviews(
                    loc.google_account_hint,
                    loc.google_location_id,
                    user.id,
                    100 // page size
                )

                // Upsert Reviews (similar logic to single sync)
                if (reviews.length > 0) {
                    const incomingGoogleIds = reviews.map(r => r.reviewId || r.name?.split('/').pop() || '')
                    // Basic upsert without preserving drafts logic here for brevity? 
                    // NO, we MUST preserve drafts or we overwrite them! 
                    // Re-implement preserving logic.

                    // Fetch existing status map
                    const { data: existingMap } = await serviceClient
                        .schema('app')
                        .from('google_reviews')
                        .select('google_review_id, reply_status')
                        .eq('location_id', loc.id)
                        .in('google_review_id', incomingGoogleIds)
                        .then(res => ({ data: new Map(res.data?.map(r => [r.google_review_id, r.reply_status])) }))

                    for (const review of reviews) {
                        const googleReviewId = review.reviewId || review.name?.split('/').pop() || ''
                        const existingStatus = existingMap?.get(googleReviewId)

                        let newStatus = 'none'
                        if (review.reviewReply) {
                            newStatus = 'posted'
                        } else {
                            if (existingStatus === 'draft') newStatus = 'draft'
                            else if (existingStatus === 'posted') newStatus = 'none'
                        }

                        await serviceClient.schema('app').from('google_reviews').upsert({
                            location_id: loc.id,
                            google_review_id: googleReviewId,
                            rating: review.starRating === 'FIVE' ? 5 :
                                review.starRating === 'FOUR' ? 4 :
                                    review.starRating === 'THREE' ? 3 :
                                        review.starRating === 'TWO' ? 2 : 1,
                            reviewer_name: review.reviewer?.displayName || null,
                            reviewer_profile_url: review.reviewer?.profilePhotoUrl || null,
                            comment: review.comment || null,
                            review_date: review.createTime || null,
                            reply_status: newStatus,
                            reply_text: review.reviewReply?.comment || null
                        }, { onConflict: 'location_id,google_review_id' })
                    }
                }
                return true
            } catch (e: any) {
                errors.push(`${loc.id}: ${e.message}`)
                return false
            }
        }

        // Execute
        const results = await Promise.all(locations.map(syncLocation))
        const successCount = results.filter(Boolean).length

        return NextResponse.json({
            locationsSynced: successCount,
            totalLocations: locations.length,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
