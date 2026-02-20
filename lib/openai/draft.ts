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
export async function draftReply(review: ReviewData, locationSettings: LocationSettings, previousDraft?: string): Promise<string> {
  const prompt = buildPrompt(review, locationSettings, previousDraft)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional customer service representative helping businesses respond to Google reviews. Generate friendly, professional, and appropriate replies. DO NOT USE EM DASHES.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: 4000,
  })

  const draftText = completion.choices[0].message.content

  if (!draftText) {
    throw new Error(`Failed to generate draft reply: ${completion.choices[0]?.message?.content ? 'No content' : 'Empty response'}`)
  }

  return draftText
}

export function buildPrompt(review: ReviewData, settings: LocationSettings, previousDraft?: string): string {
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

  if (previousDraft) {
    prompt += `\n\nIMPORTANT: The user rejected the following draft. Generate something COMPLETELY DIFFERENT in tone, structure, and content:\n"${previousDraft}"\n`
  }

  prompt += `\nGenerate a concise, professional reply (2-4 sentences).`

  return prompt
}

