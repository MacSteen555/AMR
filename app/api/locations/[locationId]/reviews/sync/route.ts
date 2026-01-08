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
      .from('app.locations')
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

      // Upsert reviews
      for (const review of reviews) {
        const googleReviewId = review.reviewId || review.name?.split('/').pop() || ''

        await serviceClient
          .from('app.google_reviews')
          .upsert(
            {
              location_id: params.locationId,
              google_review_id: googleReviewId,
              rating: review.starRating?.rating || 0,
              reviewer_name: review.reviewer?.displayName || null,
              reviewer_profile_url: review.reviewer?.profilePhotoUrl || null,
              comment: review.comment || null,
              review_date: review.createTime || null,
              review_url: review.reviewReply?.comment || null,
              image_urls: review.media?.photos?.map((p: any) => p.thumbnailUri) || [],
              reply_status: review.reviewReply ? 'synced_external' : 'none',
              reply_text: review.reviewReply?.comment || null,
            },
            {
              onConflict: 'location_id,google_review_id',
            }
          )

        totalSynced++
      }

      pageToken = nextPageToken
      hasMore = !!nextPageToken && totalSynced < 500 // Limit to 500 per sync
    }

    // Update location sync status
    await serviceClient
      .from('app.locations')
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

