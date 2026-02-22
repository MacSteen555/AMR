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
    const {
      original_reply,
      edited_reply,
      sentiment_type,
      selected_voice,
    } = body

    // If the user didn't change the reply, use the selected voice name directly
    if (original_reply === edited_reply) {
      return NextResponse.json({
        brand_voice_prompt: `Use a ${selected_voice} tone when responding to reviews. Be ${selected_voice === 'professional' ? 'formal, polished, and corporate' : selected_voice === 'friendly' ? 'warm, casual, and personable' : 'clever, lighthearted, and witty while remaining appropriate'}.`,
        sentiment_prompt: `For ${sentiment_type} reviews, maintain the ${selected_voice} tone and ${sentiment_type === 'positive' ? 'express genuine gratitude and encourage return visits' : 'acknowledge concerns empathetically and offer to make things right'}.`,
      })
    }

    // If the user edited the reply, analyze the diff to extract their preference
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing writing style and tone. Given an original auto-generated reply and a user's edited version, extract the specific style preferences and tone adjustments the user made. Return valid JSON only.`,
        },
        {
          role: 'user',
          content: `The user was presented with an auto-generated ${sentiment_type} review reply and edited it. Analyze their changes and extract a concise prompt that captures their preferred writing style.

Original reply (${selected_voice} tone):
"${original_reply}"

User's edited version:
"${edited_reply}"

This is for ${sentiment_type} review responses.

Return JSON with:
{
  "brand_voice_prompt": "A concise instruction (1-2 sentences) capturing the user's overall brand voice style based on their edits",
  "sentiment_prompt": "A concise instruction (1-2 sentences) for how to specifically handle ${sentiment_type} reviews based on the user's edits"
}

Focus on specific, actionable style instructions, not vague descriptions. For example: "Use first person plural (we/our), keep responses under 3 sentences, always mention the customer by name" rather than "Be nice".`,
        },
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0].message.content
    if (!content) {
      throw new Error('Failed to extract brand voice')
    }

    const result = JSON.parse(content)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Extract brand voice error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
