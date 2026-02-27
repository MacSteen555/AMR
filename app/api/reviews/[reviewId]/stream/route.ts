import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { draftReplyStream } from '@/lib/openai/draft'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { reviewId: string } }) {
  try {
    await requireUser()
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

    const locData = review.locations
    const location = Array.isArray(locData) ? locData[0] : locData

    const body = await request.json().catch(() => ({}))
    const previousDraft = body.previous_draft
    const mode = body.mode || 'generate'

    const encoder = new TextEncoder()
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = draftReplyStream(
            {
              rating: review.rating,
              comment: review.comment,
              reviewer_name: review.reviewer_name,
              review_date: review.review_date,
            },
            {
              brand_voice: location.brand_voice,
              positive_sentiment: location.positive_sentiment,
              negative_sentiment: location.negative_sentiment,
              signature: location.signature,
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
            llm_model: 'gpt-5-nano',
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
