import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface DigestReviewInput {
  rating: number
  comment: string | null
  reviewer_name: string | null
  location_name: string
}

/**
 * Generates a 2-3 sentence sentiment summary of a batch of reviews.
 * Used in the digest email to give a quick overview.
 */
export async function generateDigestSummary(
  reviews: DigestReviewInput[],
  teamName: string
): Promise<string> {
  const reviewLines = reviews.map((r, i) =>
    `${i + 1}. ${r.rating}/5 stars at ${r.location_name} by ${r.reviewer_name || 'Anonymous'}: "${r.comment || 'No comment'}"`
  ).join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You summarize batches of customer reviews for a business owner. Write a 2-3 sentence snapshot of the overall sentiment, highlighting key themes (positive and negative). Be direct and actionable. Do not use em dashes. Output ONLY the summary paragraph, no labels or preamble.`,
      },
      {
        role: 'user',
        content: `Here are ${reviews.length} new reviews for ${teamName}:\n\n${reviewLines}`,
      },
    ],
    max_completion_tokens: 200,
  })

  return completion.choices[0].message.content || 'Unable to generate summary.'
}
