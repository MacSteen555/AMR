import OpenAI from 'openai'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface LocationSettings {
  brand_voice?: string | null
  positive_sentiment?: string | null
  negative_sentiment?: string | null
  signature?: string | null
  reply_language?: string | null
}

export interface ReviewData {
  rating: number
  comment: string | null
  reviewer_name?: string | null
  review_date?: string | null
}

/**
 * Generates a draft reply for a review using OpenAI.
 */
export async function draftReply(review: ReviewData, locationSettings: LocationSettings): Promise<string> {
  const prompt = buildPrompt(review, locationSettings)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional customer service representative helping businesses respond to Google reviews. Generate friendly, professional, and appropriate replies.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  })

  const draftText = completion.choices[0]?.message?.content?.trim()

  if (!draftText) {
    throw new Error('Failed to generate draft reply')
  }

  return draftText
}

function buildPrompt(review: ReviewData, settings: LocationSettings): string {
  let prompt = `Generate a professional reply to this Google review:\n\n`
  prompt += `Rating: ${review.rating}/5\n`
  if (review.comment) {
    prompt += `Review: "${review.comment}"\n`
  }
  if (review.reviewer_name) {
    prompt += `Reviewer: ${review.reviewer_name}\n`
  }

  if (settings.brand_voice) {
    prompt += `\nBrand voice guidelines: ${settings.brand_voice}\n`
  }

  if (review.rating >= 4 && settings.positive_sentiment) {
    prompt += `\nPositive sentiment approach: ${settings.positive_sentiment}\n`
  } else if (review.rating <= 2 && settings.negative_sentiment) {
    prompt += `\nNegative sentiment approach: ${settings.negative_sentiment}\n`
  }

  if (settings.reply_language) {
    prompt += `\nReply language: ${settings.reply_language}\n`
  }

  if (settings.signature) {
    prompt += `\nSignature to include: ${settings.signature}\n`
  }

  prompt += `\nGenerate a concise, professional reply (2-4 sentences).`

  return prompt
}

