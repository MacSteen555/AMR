import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json()
    const { location_name } = body

    const businessName = location_name || 'your business'

    // Generate sample reviews and reply options in one call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are helping a business owner set up their automated review reply system. Generate realistic sample Google reviews and reply options for their business. Return valid JSON only, no markdown.`,
        },
        {
          role: 'user',
          content: `For the business "${businessName}", generate:

1. A realistic 5-star positive Google review (2-3 sentences from a happy customer)
2. A realistic 1-star negative Google review (2-3 sentences from an unhappy customer)
3. For each review, generate 3 different reply options with distinct brand voice tones:
   - "professional" (formal, corporate tone)
   - "friendly" (warm, casual, personable)
   - "witty" (clever, lighthearted but still appropriate)

Return as JSON with this exact structure:
{
  "positive_review": {
    "reviewer_name": "Sarah M.",
    "rating": 5,
    "text": "...",
    "replies": {
      "professional": "...",
      "friendly": "...",
      "witty": "..."
    }
  },
  "negative_review": {
    "reviewer_name": "James K.",
    "rating": 1,
    "text": "...",
    "replies": {
      "professional": "...",
      "friendly": "...",
      "witty": "..."
    }
  }
}

Make the reviews feel authentic and the replies 2-4 sentences each. DO NOT use em dashes.`,
        },
      ],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('Failed to generate sample reviews')
    }

    const samples = JSON.parse(content)

    return NextResponse.json(samples)
  } catch (error: any) {
    console.error('Generate sample reviews error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
