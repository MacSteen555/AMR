import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface LocationSettings {
  brand_voice?: string | null
  positive_sentiment?: string | null
  negative_sentiment?: string | null
  neutral_sentiment?: string | null
  signature?: string | null
  reply_language?: string | null
}

export interface ReviewData {
  rating: number
  comment: string | null
  reviewer_name?: string | null
  review_date?: string | null
}

const SYSTEM_PROMPT = `You are a review reply writer for a local business. Your tone, personality, and style come ENTIRELY from the brand voice provided by the user. Do not impose your own tone. If no brand voice is provided, default to warm and professional.

STRUCTURAL RULES (apply these invisibly regardless of brand voice):
- Shape every reply as: natural greeting using reviewer's first name -> substantive body that references specifics from the review -> warm close or invitation to return
- Write 2-4 sentences for reviews with text. Write 1-2 sentences for rating-only reviews (no comment).
- For detailed reviews (3+ sentences from the reviewer), write a proportionally substantive reply that addresses their key points.
- If the reviewer left a short review or just a rating, keep the reply concise and gracious.
- If the brand voice includes a signature, end the reply with it naturally as a sign-off.

SEO (apply naturally, never force):
- If the review or brand voice mentions a specific service, product, or location, reference it once naturally in the reply.
- Do not keyword-stuff. If there is no natural place for it, skip it.

HARD CONSTRAINTS:
- NEVER use em dashes (—). Use commas, periods, or semicolons instead.
- NEVER start with "Dear [Name]". Use their first name naturally in the greeting (e.g., "Hi Sarah," or "Sarah, thank you...").
- NEVER use these phrases: "valued customer", "we strive to", "your feedback is important to us", "at [Business] we pride ourselves", "we appreciate your feedback".
- Maximum ONE exclamation mark per reply.
- For negative reviews: NEVER repeat the reviewer's negative language back to them verbatim. Acknowledge the concern in your own words.
- NEVER make unverifiable promises like "we've already fixed this" or "this won't happen again".
- Vary your opening phrases. Do not start every reply with "Thank you for...".
- Output ONLY the reply text. No labels, no quotation marks wrapping the reply, no preamble.`

const DEFAULT_SENTIMENTS = {
  positive: 'Express genuine appreciation, reference what went well specifically, and warmly encourage them to return.',
  neutral: 'Acknowledge the mixed experience with empathy. Highlight what went well, briefly address what could improve without being defensive, and invite them to give you another chance.',
  negative: 'Acknowledge the concern with empathy and without being defensive. Offer to resolve the issue offline (phone or email if available). Keep it brief, sincere, and solution-focused.',
}

const FEW_SHOT_POSITIVE = {
  review: { rating: 5, comment: 'Amazing service! The team was super helpful and got everything done quickly.', reviewer_name: 'Jessica' },
  reply: 'Hi Jessica, so glad to hear the team took great care of you. Quick and thorough is exactly what we aim for. Hope to see you again soon!',
}

const FEW_SHOT_NEGATIVE = {
  review: { rating: 2, comment: 'Had to wait 45 minutes past my appointment time. Staff seemed disorganized.', reviewer_name: 'Tom' },
  reply: 'Tom, we understand how frustrating a long wait can be, and that is not the experience we want for you. We would love the chance to make this right. Please reach out to us directly so we can look into what happened.',
}

const FEW_SHOT_NEUTRAL = {
  review: { rating: 3, comment: 'Food was good but the service was slow. Might come back to give it another try.', reviewer_name: 'Alex' },
  reply: 'Alex, happy to hear you enjoyed the food. We hear you on the wait, and we are working on improving our service speed. We would love for you to come back and see the difference.',
}

/**
 * Generates a draft reply for a review using OpenAI.
 * Brand voice and sentiment settings are the primary creative direction;
 * the system prompt provides invisible structural guardrails.
 */
export async function draftReply(review: ReviewData, locationSettings: LocationSettings, previousDraft?: string): Promise<string> {
  const prompt = buildPrompt(review, locationSettings, previousDraft)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
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
  const sections: string[] = []

  // ── 1. BRAND VOICE (highest priority) ──────────────────────────────────
  if (settings.brand_voice) {
    sections.push(
      `=== YOUR BRAND VOICE (follow this above all other style guidance) ===\n${settings.brand_voice}`
    )
  }

  // ── 2. SENTIMENT APPROACH ──────────────────────────────────────────────
  const sentimentBlock = buildSentimentBlock(review.rating, settings)
  sections.push(`=== SENTIMENT APPROACH FOR THIS REVIEW ===\n${sentimentBlock}`)

  // ── 3. THE REVIEW ──────────────────────────────────────────────────────
  let reviewBlock = `=== REVIEW TO REPLY TO ===\nRating: ${review.rating}/5`
  if (review.reviewer_name) {
    reviewBlock += `\nReviewer: ${review.reviewer_name}`
  }
  if (review.comment && review.comment.trim()) {
    reviewBlock += `\nReview: "${review.comment}"`
  } else {
    reviewBlock += `\n(No written review, rating only)`
  }
  sections.push(reviewBlock)

  // ── 4. FEW-SHOT EXAMPLE (structural reference) ────────────────────────
  const example = pickExample(review.rating)
  sections.push(
    `=== EXAMPLE (for reply structure, not tone — use your brand voice for tone) ===\n` +
    `Review [${example.review.rating}/5]: "${example.review.comment}"\n` +
    `Reply: ${example.reply}`
  )

  // ── 5. CONTEXTUAL GUIDELINES ───────────────────────────────────────────
  const guidelines = buildGuidelines(review, settings)
  sections.push(`=== REPLY GUIDELINES ===\n${guidelines}`)

  // ── 6. REJECTION / REGENERATION ────────────────────────────────────────
  if (previousDraft) {
    sections.push(
      `=== REJECTED DRAFT (generate something completely different in structure, phrasing, and opening) ===\n"${previousDraft}"`
    )
  }

  return sections.join('\n\n')
}

function buildSentimentBlock(rating: number, settings: LocationSettings): string {
  if (rating >= 4) {
    return settings.positive_sentiment || DEFAULT_SENTIMENTS.positive
  }
  if (rating <= 2) {
    return settings.negative_sentiment || DEFAULT_SENTIMENTS.negative
  }
  // Rating === 3 (neutral)
  return settings.neutral_sentiment || DEFAULT_SENTIMENTS.neutral
}

function pickExample(rating: number) {
  if (rating >= 4) return FEW_SHOT_POSITIVE
  if (rating <= 2) return FEW_SHOT_NEGATIVE
  return FEW_SHOT_NEUTRAL
}

function buildGuidelines(review: ReviewData, settings: LocationSettings): string {
  const rules: string[] = []

  // Length guidance based on review context
  const hasComment = review.comment && review.comment.trim().length > 0
  if (!hasComment) {
    rules.push('This is a rating-only review with no text. Write a brief, gracious reply (1-2 sentences). Do not invent details about what the reviewer experienced.')
  } else {
    const commentLength = review.comment!.trim().length
    if (commentLength < 50) {
      rules.push('The review is short. Keep your reply concise and proportional (2-3 sentences).')
    } else if (commentLength > 200) {
      rules.push('The review is detailed. Write a substantive reply (3-4 sentences) that addresses the key points raised.')
    } else {
      rules.push('Write a concise reply (2-4 sentences).')
    }
  }

  // Language
  if (settings.reply_language) {
    rules.push(`Write the reply in ${settings.reply_language}.`)
  }

  // Signature
  if (settings.signature) {
    rules.push(`End the reply with this signature as a natural sign-off: ${settings.signature}`)
  }

  return rules.join('\n')
}
