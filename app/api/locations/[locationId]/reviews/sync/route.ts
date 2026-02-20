import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { listReviews } from '@/lib/google/gbp'
import { syncReviewsSchema } from '@/lib/validation/schemas'

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
  try {
    await requireLocationAccess(params.locationId)
    const user = await requireUser()
    const body = await request.json()
    const data = syncReviewsSchema.parse(body)

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get location
    const { data: location } = await supabase
      .schema('app')
      .from('locations')
      .select('google_location_id, google_account_hint')
      .eq('id', params.locationId)
      .single()

    if (!location || !location.google_account_hint) {
      return NextResponse.json({ error: 'Location account not configured' }, { status: 400 })
    }

    let pageToken = data.page_token
    let totalSynced = 0
    let hasMore = true

    while (hasMore) {
      const { reviews, nextPageToken } = await listReviews(
        location.google_account_hint,
        location.google_location_id,
        user.id,
        data.page_size,
        pageToken
      )

      if (reviews.length === 0) break

      // --- Safety Step: Preserve Drafts ---
      // Get Review IDs we are about to sync
      const incomingGoogleIds = reviews.map(r => r.reviewId || r.name?.split('/').pop() || '')

      // Fetch existing DB status for these
      const { data: existingMap } = await serviceClient
        .schema('app')
        .from('google_reviews')
        .select('google_review_id, reply_status')
        .eq('location_id', params.locationId)
        .in('google_review_id', incomingGoogleIds)
        .then(res => ({ data: new Map(res.data?.map(r => [r.google_review_id, r.reply_status])) }))

      // Upsert reviews
      for (const review of reviews) {
        const googleReviewId = review.reviewId || review.name?.split('/').pop() || ''
        const existingStatus = existingMap?.get(googleReviewId)

        // Determine Status
        let newStatus = 'none'
        if (review.reviewReply) {
          newStatus = 'replied_external' // Google has it, so it's external
        } else {
          // Google has NO reply.
          if (existingStatus === 'draft') {
            newStatus = 'draft' // Preserve local draft
          } else if (existingStatus === 'replied_external') {
            newStatus = 'none' // It was deleted on Google
          } else {
            newStatus = 'none'
          }
        }

        await serviceClient
          .schema('app')
          .from('google_reviews')
          .upsert(
            {
              location_id: params.locationId,
              google_review_id: googleReviewId,
              rating: review.starRating === 'FIVE' ? 5 :
                review.starRating === 'FOUR' ? 4 :
                  review.starRating === 'THREE' ? 3 :
                    review.starRating === 'TWO' ? 2 : 1, // Fix Rating Enum to Number if schema expects int
              reviewer_name: review.reviewer?.displayName || null,
              reviewer_profile_url: review.reviewer?.profilePhotoUrl || null,
              comment: review.comment || null,
              review_date: review.createTime || null,
              review_url: null, // API doesn't always give URL, maybe construct it?
              image_urls: [], // Fix mapping if specific format
              reply_status: newStatus,
              reply_text: review.reviewReply?.comment || null,
            },
            {
              onConflict: 'location_id,google_review_id',
              ignoreDuplicates: false,
            }
          )
        // BUG: Upserting without `draft_text` field in the object -> it might set it to null or default?
        // Actually, if the key is missing from the JS object passed to `.upsert()`, Supabase/PostgREST typically *only* updates the columns *present* in the object?
        // NO. `upsert` is usually "Update these columns".
        // CORRECT: If I omit `draft_text`, it should NOT touch that column in an update scenario.
        // It ONLY touches the columns I send.
        // So I just need to be careful NOT to send `draft_text` key.
        // However, I *am* sending `reply_status`.

        totalSynced++
      }

      pageToken = nextPageToken
      hasMore = !!nextPageToken && totalSynced < 500
    }

    // Update location sync status
    await serviceClient
      .schema('app')
      .from('locations')
      .update({
        last_google_sync_at: new Date().toISOString(),
        last_google_sync_status: 'success',
      })
      .eq('id', params.locationId)

    return NextResponse.json({ synced: totalSynced })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
