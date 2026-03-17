import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReplyStream } from '@/lib/openai/draft'
import { resolveSignature } from '@/lib/draft-signature'
import { spendCredits } from '@/lib/billing/credits'
import { captureRouteError } from '@/lib/sentry'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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

    if (!review) {
      return new Response(JSON.stringify({ error: 'Review not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') || crypto.randomUUID()
    const body = await request.json().catch(() => ({}))
    const previousDraft = body.previous_draft
    const mode = body.mode || 'generate'

    if (mode === 'generate') {
      // Spend 1 credit for generation before we stream
      await spendCredits(
        review.locations?.team_id,
        user.id,
        'reply_generate',
        1,
        'review',
        params.reviewId,
        idempotencyKey
      )
    }

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

    const encoder = new TextEncoder()
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = draftReplyStream(
            {
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              reviewer_name: review.reviewer_name,
              review_date: review.review_date,
            },
            {
              location_id: location.id,
              brand_voice: location.brand_voice,
              positive_sentiment: location.positive_sentiment,
              negative_sentiment: location.negative_sentiment,
              signature: resolvedSignature,
              reply_language: location.reply_language,
            },
            previousDraft,
          )

          for await (const delta of stream) {
            fullText += delta
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
          }

          // Save the completed draft to the database
          const updateFields: Record<string, any> = {
            draft_text: fullText,
            draft_updated_at: new Date().toISOString(),
            llm_last_generated_at: new Date().toISOString(),
            llm_model: 'gpt-4o-mini',
          }
          if (mode === 'generate') {
            updateFields.reply_status = 'draft'
          }

          const { data: updated } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .update(updateFields)
            .eq('id', params.reviewId)
            .select()
            .single()

          // Log the stream output to text draft history
          await serviceClient.schema('app').from('review_drafts').insert({
            review_id: params.reviewId,
            author_user_id: user.id,
            content: fullText,
          })

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, review: updated })}\n\n`))
          controller.close()
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    if (error.message.includes('Review limit reached') || error.message.includes('Requires')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    captureRouteError(error, { route: '/api/reviews/[reviewId]/stream' })
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
