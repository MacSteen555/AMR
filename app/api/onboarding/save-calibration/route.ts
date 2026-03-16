import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { captureRouteError } from '@/lib/sentry'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const DIMENSIONS = [
  'warmth',
  'personalization',
  'criticism_handling',
  'defensiveness',
  'length_formality',
] as const

type Dimension = (typeof DIMENSIONS)[number]
type Choice = 'a' | 'b'

const DIMENSION_DESCRIPTIONS: Record<Dimension, Record<Choice, string>> = {
  warmth: {
    a: 'Enthusiastic and high-energy replies with exclamation marks and genuine excitement',
    b: 'Warm but measured replies that are sincere and composed without being over-the-top',
  },
  personalization: {
    a: 'Highly personalized replies that reference specific details the reviewer mentioned',
    b: 'Gracious but general replies that are appreciative without referencing specifics',
  },
  criticism_handling: {
    a: 'Acknowledges concerns briefly then pivots to the positive, ending on an optimistic note',
    b: 'Addresses criticism head-on with transparent explanation before thanking for positive feedback',
  },
  defensiveness: {
    a: 'Factual and direct on negative reviews, explaining the business\'s perspective respectfully without being overly apologetic',
    b: 'Fully empathetic on negative reviews, taking responsibility and focusing entirely on the customer\'s feelings',
  },
  length_formality: {
    a: 'Brief and casual replies that feel like a quick, genuine thank-you from a real person',
    b: 'Polished and structured replies with formal language and well-crafted sentences',
  },
}

const pickSchema = z.object({
  review_index: z.number().int().min(0).max(4),
  dimension: z.enum(DIMENSIONS),
  choice: z.enum(['a', 'b']),
})

const requestSchema = z.object({
  location_id: z.string().uuid(),
  picks: z.array(pickSchema).length(5),
  negative_contact_email: z.string().email().optional().nullable(),
  business_type: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = requestSchema.parse(await request.json())
    const { location_id, picks, negative_contact_email, business_type } = body

    // Map picks to human-readable descriptions
    const pickDescriptions = picks.map((pick) => {
      const description = DIMENSION_DESCRIPTIONS[pick.dimension][pick.choice]
      return `${pick.dimension}: ${description}`
    })

    const picksList = pickDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')

    // Two concurrent GPT calls
    const [brandVoiceResult, sentimentResult] = await Promise.all([
      // Call 1 — Brand voice synthesis
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a brand voice analyst. Write a concise brand voice description (3-5 sentences) in the second person ("you" / "your"). Be directional, not prescriptive — describe the feeling and personality, not rigid rules. Do not mention calibration, A/B testing, or any testing process. The description should read like a creative brief that a copywriter could use to nail the tone on the first try.`,
          },
          {
            role: 'user',
            content: `Based on the following tone preferences${business_type ? ` for a ${business_type}` : ''}, write the brand voice description:\n\n${picksList}`,
          },
        ],
        max_completion_tokens: 500,
      }),

      // Call 2 — Sentiment guidance
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You generate sentiment-specific reply instructions for a business replying to Google reviews. Based on the tone preferences provided, generate specific guidance for positive, negative, and neutral reviews. Return valid JSON only with exactly these keys: { "positive_sentiment": "...", "negative_sentiment": "...", "neutral_sentiment": "..." }. Each value should be 1-3 sentences of actionable instructions.${negative_contact_email ? ` For negative reviews, include a note to offer the contact email ${negative_contact_email} when appropriate.` : ''}`,
          },
          {
            role: 'user',
            content: `Tone preferences${business_type ? ` for a ${business_type}` : ''}:\n\n${picksList}`,
          },
        ],
        max_completion_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    ])

    const brandVoice = brandVoiceResult.choices[0].message.content
    if (!brandVoice) {
      throw new Error('Failed to generate brand voice')
    }

    const sentimentContent = sentimentResult.choices[0].message.content
    if (!sentimentContent) {
      throw new Error('Failed to generate sentiment guidance')
    }

    const sentimentGuidance = JSON.parse(sentimentContent)

    // Save to location
    const supabase = createSupabaseServiceRoleClient()

    const updateData: Record<string, unknown> = {
      tone_calibration: { business_type: business_type || null, picks },
      brand_voice: brandVoice.trim(),
      positive_sentiment: sentimentGuidance.positive_sentiment,
      negative_sentiment: sentimentGuidance.negative_sentiment,
    }

    if (negative_contact_email !== undefined) {
      updateData.negative_contact_email = negative_contact_email
    }

    const { error: updateError } = await supabase
      .schema('app')
      .from('locations')
      .update(updateData)
      .eq('id', location_id)

    if (updateError) {
      throw new Error(`Failed to save calibration: ${updateError.message}`)
    }

    return NextResponse.json({
      brand_voice: brandVoice.trim(),
      positive_sentiment: sentimentGuidance.positive_sentiment,
      negative_sentiment: sentimentGuidance.negative_sentiment,
      neutral_sentiment: sentimentGuidance.neutral_sentiment,
    })
  } catch (error: any) {
    console.error('Save calibration error:', error)
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    captureRouteError(error, { route: '/api/onboarding/save-calibration' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
