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
          content: `You are an expert at analyzing writing style and tone by examining the literal diffs between two texts. Pay strict attention to the EXACT changes made by the user, such as punctuation (e.g., changing '!' to '.'), capitalization, use of emojis, sentence structure, specific word choices, and addition of contact information. Return valid JSON only.`,
        },
        {
          role: 'user',
          content: `The user was presented with an auto-generated ${sentiment_type} review reply and edited it. Analyze their exact changes to extract specific, highly actionable writing rules.

Original reply (${selected_voice} tone):
"${original_reply}"

User's edited version:
"${edited_reply}"

INSTRUCTIONS for extracting rules:
1. Look closely at granular differences. For instance, if they changed "Thank you so much!" to "Thank you so much.", a rule must be "Avoid overuse of exclamation marks when possible." If they removed emojis, a rule is "Never use emojis." 
2. Synthesize these precise mechanical differences into a concise prompt that captures their preferred writing style.
3. Determine how they want to handle ${sentiment_type} reviews.
4. If they added ANY contact information (e.g., an email address like support@example.com, a phone number, or a website link), you MUST include a rule that explicitly states to provide that exact contact information in the response.

Return JSON with exactly these keys:
{
  "brand_voice_prompt": "Specific, actionable style instructions focusing on the granular changes made (punctuation, length, tone, emojis, specific phrasing preferred). Include any general contact info rules. (1-3 sentences)",
  "sentiment_prompt": "Specific instructions for handling ${sentiment_type} reviews based on their edits. If they added specific contact information for ${sentiment_type} reviews, include the literal contact info here. (1-2 sentences)"
}`,
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
