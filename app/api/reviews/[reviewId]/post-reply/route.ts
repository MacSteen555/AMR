import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { updateReply } from '@/lib/google/gbp'
import { postReplySchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
  try {
    const user = await requireUser()
    const headers = request.headers
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()

    const body = await request.json()
    const data = postReplySchema.parse(body)

    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get review with location
    const { data: review } = await supabase
      .from('app.google_reviews')
      .select('*, location:locations!inner(google_location_id, google_account_hint)')
      .eq('id', params.reviewId)
      .single()

    if (!review || !review.location.google_account_hint) {
      return NextResponse.json({ error: 'Review or location account not found' }, { status: 404 })
    }

    // Get comment (use provided or draft)
    const comment = data.comment || review.draft_text

    if (!comment) {
      return NextResponse.json({ error: 'No comment provided and no draft available' }, { status: 400 })
    }

    // Get user identity for Google API
    const { data: identity } = await supabase
      .from('app.user_identities')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()

    if (!identity) {
      return NextResponse.json({ error: 'Google identity not found' }, { status: 404 })
    }

    let success = false
    let errorCode: string | null = null
    let errorMessage: string | null = null

    try {
      // Post reply to Google
      await updateReply(
        review.location.google_account_hint,
        review.location.google_location_id,
        review.google_review_id,
        comment,
        user.id
      )

      success = true

      // Update review
      await serviceClient
        .from('app.google_reviews')
        .update({
          reply_status: 'posted',
          replied_at: new Date().toISOString(),
          replied_by_user_id: user.id,
          reply_text: comment,
          reply_source: 'automyreply',
        })
        .eq('id', params.reviewId)
    } catch (error: any) {
      success = false
      errorCode = error.code || 'UNKNOWN'
      errorMessage = error.message

      // Update review status (keep draft)
      await serviceClient
        .from('app.google_reviews')
        .update({
          reply_status: 'post_failed',
        })
        .eq('id', params.reviewId)
    }

    // Always record attempt
    await serviceClient.from('app.reply_post_attempts').insert({
      review_id: params.reviewId,
      attempted_by_user_id: user.id,
      used_identity_id: identity.id,
      success,
      google_error_code: errorCode,
      google_error_message: errorMessage,
      request_payload: { comment },
    })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to post reply', details: errorMessage },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, reply_text: comment })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

