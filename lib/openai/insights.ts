import OpenAI from 'openai'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface InsightsInput {
  reviews: Array<{
    rating: number
    comment: string | null
    review_date: string
    reviewer_name?: string | null
  }>
  periodStart: string
  periodEnd: string
  locationName?: string | null
}

/**
 * Generates insights for a team or location based on reviews.
 */
export async function insightsRun(input: InsightsInput): Promise<any> {
  const prompt = buildInsightsPrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      {
        role: 'system',
        content:
          'You are a business analytics expert. Analyze review data and provide structured insights in JSON format.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const insightsText = completion.choices[0]?.message?.content?.trim()

  if (!insightsText) {
    throw new Error('Failed to generate insights')
  }

  try {
    return JSON.parse(insightsText)
  } catch (error) {
    throw new Error('Failed to parse insights JSON')
  }
}

function buildInsightsPrompt(input: InsightsInput): string {
  let prompt = `Analyze the following review data and provide insights in JSON format:\n\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd}\n`
  if (input.locationName) {
    prompt += `Location: ${input.locationName}\n`
  }
  prompt += `Total Reviews: ${input.reviews.length}\n\n`

  // Calculate basic stats
  const ratings = input.reviews.map((r) => r.rating)
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: ratings.filter((rating) => rating === r).length,
  }))

  prompt += `Average Rating: ${avgRating.toFixed(2)}\n`
  prompt += `Rating Distribution:\n${ratingDistribution.map((d) => `  ${d.rating} stars: ${d.count}`).join('\n')}\n\n`

  prompt += `Reviews:\n`
  input.reviews.slice(0, 50).forEach((review, idx) => {
    prompt += `${idx + 1}. [${review.rating}/5] ${review.comment || '(No comment)'}\n`
  })

  prompt += `\nProvide a JSON object with the following structure:\n`
  prompt += `{\n`
  prompt += `  "summary": "Overall summary of review trends",\n`
  prompt += `  "averageRating": ${avgRating.toFixed(2)},\n`
  prompt += `  "totalReviews": ${input.reviews.length},\n`
  prompt += `  "ratingDistribution": { "5": ${ratingDistribution[0].count}, "4": ${ratingDistribution[1].count}, "3": ${ratingDistribution[2].count}, "2": ${ratingDistribution[3].count}, "1": ${ratingDistribution[4].count} },\n`
  prompt += `  "topThemes": ["theme1", "theme2", "theme3"],\n`
  prompt += `  "sentimentAnalysis": { "positive": 0, "neutral": 0, "negative": 0 },\n`
  prompt += `  "recommendations": ["recommendation1", "recommendation2"]\n`
  prompt += `}\n`

  return prompt
}

/**
 * Generates competitive analysis comparing owned locations and competitors.
 */
export async function competitiveRun(input: {
  ownedLocations: Array<{
    name: string
    reviews: Array<{ rating: number; comment: string | null }>
  }>
  competitors: Array<{
    name: string
    reviews: Array<{ rating: number; comment: string | null }>
  }>
  periodStart: string
  periodEnd: string
}): Promise<any> {
  const prompt = buildCompetitivePrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      {
        role: 'system',
        content:
          'You are a competitive intelligence analyst. Compare business performance across owned locations and competitors based on review data.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 3000,
    response_format: { type: 'json_object' },
  })

  const analysisText = completion.choices[0]?.message?.content?.trim()

  if (!analysisText) {
    throw new Error('Failed to generate competitive analysis')
  }

  try {
    return JSON.parse(analysisText)
  } catch (error) {
    throw new Error('Failed to parse competitive analysis JSON')
  }
}

function buildCompetitivePrompt(input: {
  ownedLocations: Array<{ name: string; reviews: Array<{ rating: number; comment: string | null }> }>
  competitors: Array<{ name: string; reviews: Array<{ rating: number; comment: string | null }> }>
  periodStart: string
  periodEnd: string
}): string {
  let prompt = `Perform a competitive analysis comparing owned locations and competitors:\n\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd}\n\n`

  prompt += `Owned Locations:\n`
  input.ownedLocations.forEach((loc) => {
    const avgRating =
      loc.reviews.length > 0
        ? loc.reviews.reduce((sum, r) => sum + r.rating, 0) / loc.reviews.length
        : 0
    prompt += `- ${loc.name}: ${loc.reviews.length} reviews, avg ${avgRating.toFixed(2)}/5\n`
  })

  prompt += `\nCompetitors:\n`
  input.competitors.forEach((comp) => {
    const avgRating =
      comp.reviews.length > 0
        ? comp.reviews.reduce((sum, r) => sum + r.rating, 0) / comp.reviews.length
        : 0
    prompt += `- ${comp.name}: ${comp.reviews.length} reviews, avg ${avgRating.toFixed(2)}/5\n`
  })

  prompt += `\nProvide a JSON object with:\n`
  prompt += `{\n`
  prompt += `  "summary": "Overall competitive positioning",\n`
  prompt += `  "ownedAverageRating": 0.0,\n`
  prompt += `  "competitorAverageRating": 0.0,\n`
  prompt += `  "strengths": ["strength1", "strength2"],\n`
  prompt += `  "weaknesses": ["weakness1", "weakness2"],\n`
  prompt += `  "opportunities": ["opportunity1", "opportunity2"],\n`
  prompt += `  "recommendations": ["recommendation1", "recommendation2"]\n`
  prompt += `}\n`

  return prompt
}

