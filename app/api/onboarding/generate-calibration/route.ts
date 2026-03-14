import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { captureRouteError } from '@/lib/sentry'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface CalibrationReview {
  index: number
  stars: number
  dimension: string
  reviewer_name: string
  comment: string | null
  reply_a: string
  reply_b: string
}

const REVIEW_SPECS = [
  {
    index: 0,
    stars: 5,
    dimension: 'warmth',
    reviewPrompt: 'a glowing 5-star review (2-3 sentences) from a very happy customer who had a great experience.',
    replyA: 'Write an enthusiastic, exclamatory, high-energy reply to this review. Use exclamation marks and show genuine excitement.',
    replyB: 'Write a warm but measured, composed reply to this review. Do not use any exclamation marks. Keep the tone appreciative but restrained.',
  },
  {
    index: 1,
    stars: 4,
    dimension: 'personalization',
    reviewPrompt: 'a positive 4-star review (2-3 sentences) mentioning specific details about what they liked, with one minor suggestion.',
    replyA: 'Write a reply that references specific details mentioned in the review. Show that you read and absorbed what the customer said.',
    replyB: 'Write a gracious but general reply that does not reference any specifics from the review. Keep it appreciative but generic.',
  },
  {
    index: 2,
    stars: 3,
    dimension: 'criticism_handling',
    reviewPrompt: 'a mixed 3-star review (2-3 sentences) with both positive feedback and a notable concern or complaint.',
    replyA: 'Write a reply that acknowledges the concern briefly, then pivots to the positive aspects and forward-looking improvements.',
    replyB: 'Write a reply that addresses the criticism head-on with a clear explanation before thanking them for the positive feedback.',
  },
  {
    index: 3,
    stars: 1,
    dimension: 'defensiveness',
    reviewPrompt: 'a harsh 1-star review (2-3 sentences) from a very unhappy customer making a specific complaint that may be partly unfair.',
    replyA: 'Write a factual reply that stands ground respectfully. Be clear and direct without being overly apologetic. Correct any misconceptions politely.',
    replyB: 'Write a fully empathetic reply that takes responsibility and focuses on the customer\'s feelings. Prioritize making them feel heard over explaining your side.',
  },
  {
    index: 4,
    stars: 5,
    dimension: 'length_formality',
    reviewPrompt: null, // rating-only review, no comment
    replyA: 'Write a brief, casual reply (1-2 sentences) to a 5-star rating-only review (no written comment). Keep it short and friendly.',
    replyB: 'Write a polished, structured reply (2-3 sentences) to a 5-star rating-only review (no written comment). Keep it professional and well-crafted.',
  },
] as const

async function generateReviewText(
  businessName: string,
  businessType: string,
  spec: (typeof REVIEW_SPECS)[number]
): Promise<{ reviewer_name: string; comment: string | null }> {
  if (spec.reviewPrompt === null) {
    // Rating-only review — generate just a reviewer name
    const names = ['Alex R.', 'Morgan T.', 'Casey L.', 'Jordan P.', 'Taylor S.']
    return { reviewer_name: names[spec.index] || 'Alex R.', comment: null }
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You generate realistic Google reviews for a ${businessType} called "${businessName}". Return valid JSON only with this structure: { "reviewer_name": "FirstName L.", "comment": "..." }. DO NOT use em dashes in any text.`,
      },
      {
        role: 'user',
        content: `Generate ${spec.reviewPrompt} DO NOT use em dashes (—) anywhere.`,
      },
    ],
    max_completion_tokens: 300,
    response_format: { type: 'json_object' },
  })

  const content = completion.choices[0].message.content
  if (!content) {
    throw new Error(`Failed to generate review for index ${spec.index}`)
  }

  const parsed = JSON.parse(content)
  return { reviewer_name: parsed.reviewer_name, comment: parsed.comment }
}

async function generateReplyText(
  businessName: string,
  businessType: string,
  review: { stars: number; comment: string | null; reviewer_name: string },
  instruction: string
): Promise<string> {
  const reviewContext = review.comment
    ? `"${review.comment}" - ${review.reviewer_name} (${review.stars} stars)`
    : `${review.reviewer_name} left a ${review.stars}-star rating with no written comment.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are replying to a Google review on behalf of a ${businessType} called "${businessName}". Output ONLY the reply text, nothing else. Keep replies SHORT: 1-2 sentences for rating-only reviews, 2-3 sentences max for reviews with text. Be concise. DO NOT use em dashes (—) anywhere.`,
      },
      {
        role: 'user',
        content: `Review: ${reviewContext}\n\nInstruction: ${instruction}`,
      },
    ],
    max_completion_tokens: 200,
  })

  const content = completion.choices[0].message.content
  if (!content) {
    throw new Error('Failed to generate reply')
  }

  return content.trim()
}

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json()
    const { location_id } = body

    if (!location_id) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceRoleClient()
    const { data: location, error: locationError } = await supabase
      .schema('app')
      .from('locations')
      .select('name, google_primary_category')
      .eq('id', location_id)
      .single()

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const businessName = location.name || 'your business'
    const businessType = location.google_primary_category || 'Business'

    // Generate all 5 reviews concurrently, then for each generate both replies concurrently
    const reviews: CalibrationReview[] = await Promise.all(
      REVIEW_SPECS.map(async (spec) => {
        // Step 1: Generate the review text
        const { reviewer_name, comment } = await generateReviewText(
          businessName,
          businessType,
          spec
        )

        // Step 2: Generate both replies concurrently
        const [reply_a, reply_b] = await Promise.all([
          generateReplyText(businessName, businessType, { stars: spec.stars, comment, reviewer_name }, spec.replyA),
          generateReplyText(businessName, businessType, { stars: spec.stars, comment, reviewer_name }, spec.replyB),
        ])

        return {
          index: spec.index,
          stars: spec.stars,
          dimension: spec.dimension,
          reviewer_name,
          comment,
          reply_a,
          reply_b,
        }
      })
    )

    return NextResponse.json({ reviews, business_type: businessType })
  } catch (error: any) {
    console.error('Generate calibration error:', error)
    captureRouteError(error, { route: '/api/onboarding/generate-calibration' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
