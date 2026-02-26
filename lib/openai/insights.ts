import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface InsightsInput {
  reviews: Array<{
    rating: number
    comment: string | null
    review_date: string
    reviewer_name?: string | null
    reply_status?: string | null
  }>
  periodStart: string
  periodEnd: string
  locationName?: string | null
  teamName?: string | null
}

export interface GeneratedInsights {
  executiveSummary: string
  ratingTrend: 'improving' | 'declining' | 'stable'
  ratingTrendDescription: string
  keyStrengths: Array<{ theme: string; description: string; mentionCount: number }>
  keyWeaknesses: Array<{ theme: string; description: string; mentionCount: number; severity: 'low' | 'medium' | 'high' }>
  emergingTopics: Array<{ topic: string; sentiment: 'positive' | 'negative' | 'mixed'; description: string }>
  riskAlerts: Array<{ title: string; description: string; urgency: 'low' | 'medium' | 'high' }>
  recommendations: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high' }>
  customerPersona: string
  notableQuotes: Array<{ quote: string; rating: number; sentiment: 'positive' | 'negative' }>
}

/**
 * Generates rich, structured insights for a team or location based on reviews.
 */
export async function insightsRun(input: InsightsInput): Promise<GeneratedInsights> {
  const prompt = buildInsightsPrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert business intelligence analyst specializing in customer review analysis for local businesses. You provide actionable, specific insights grounded in the actual review data. Be concrete, not generic. Reference specific patterns you see in the data. DO NOT USE EM DASHES.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_completion_tokens: 10000,
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
  const ratings = input.reviews.map((r) => r.rating)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: ratings.filter((rating) => rating === r).length,
  }))

  const repliedCount = input.reviews.filter(r => r.reply_status === 'posted' || r.reply_status === 'synced_external').length
  const responseRate = ratings.length > 0 ? ((repliedCount / ratings.length) * 100).toFixed(1) : '0'

  // Split reviews into time halves for trend detection
  const sorted = [...input.reviews].sort((a, b) => new Date(a.review_date).getTime() - new Date(b.review_date).getTime())
  const midpoint = Math.floor(sorted.length / 2)
  const firstHalf = sorted.slice(0, midpoint)
  const secondHalf = sorted.slice(midpoint)
  const firstHalfAvg = firstHalf.length > 0 ? (firstHalf.reduce((s, r) => s + r.rating, 0) / firstHalf.length).toFixed(2) : 'N/A'
  const secondHalfAvg = secondHalf.length > 0 ? (secondHalf.reduce((s, r) => s + r.rating, 0) / secondHalf.length).toFixed(2) : 'N/A'

  let prompt = `Analyze the following review data and provide deep, actionable insights.\n\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd}\n`
  if (input.locationName) prompt += `Location: ${input.locationName}\n`
  if (input.teamName) prompt += `Team/Business: ${input.teamName}\n`
  prompt += `Total Reviews: ${input.reviews.length}\n`
  prompt += `Average Rating: ${avgRating.toFixed(2)}\n`
  prompt += `Response Rate: ${responseRate}%\n`
  prompt += `First-half average: ${firstHalfAvg} | Second-half average: ${secondHalfAvg}\n`
  prompt += `Rating Distribution: ${ratingDistribution.map(d => `${d.rating}-star: ${d.count}`).join(', ')}\n\n`

  prompt += `Reviews (up to 100):\n`
  input.reviews.slice(0, 100).forEach((review, idx) => {
    const date = new Date(review.review_date).toISOString().split('T')[0]
    prompt += `${idx + 1}. [${review.rating}/5] [${date}] ${review.comment || '(No comment)'}\n`
  })

  prompt += `\nReturn a JSON object with this EXACT structure:
{
  "executiveSummary": "A 2-3 sentence executive summary of the overall review landscape, written for a business owner. Be specific about what the data shows.",
  "ratingTrend": "improving" | "declining" | "stable",
  "ratingTrendDescription": "One sentence explaining the rating trajectory with specific numbers.",
  "keyStrengths": [
    { "theme": "Short theme name", "description": "Specific description with examples from reviews", "mentionCount": <estimated number of reviews mentioning this> }
  ],
  "keyWeaknesses": [
    { "theme": "Short theme name", "description": "Specific description", "mentionCount": <number>, "severity": "low" | "medium" | "high" }
  ],
  "emergingTopics": [
    { "topic": "Topic name", "sentiment": "positive" | "negative" | "mixed", "description": "What reviewers are saying" }
  ],
  "riskAlerts": [
    { "title": "Alert title", "description": "Why this needs attention", "urgency": "low" | "medium" | "high" }
  ],
  "recommendations": [
    { "title": "Action item", "description": "What to do and expected outcome", "impact": "low" | "medium" | "high", "effort": "low" | "medium" | "high" }
  ],
  "customerPersona": "A brief description of the typical reviewer based on review patterns.",
  "notableQuotes": [
    { "quote": "Exact quote from a review (abbreviated if long)", "rating": <number>, "sentiment": "positive" | "negative" }
  ]
}

Rules:
- Provide 3-5 keyStrengths and 2-4 keyWeaknesses
- Provide 1-3 emergingTopics (things that appeared recently or are changing)
- Provide 0-3 riskAlerts (only if there are genuine concerns)
- Provide 3-5 recommendations, prioritized by impact
- Provide 2-4 notableQuotes that capture representative customer voices
- Be specific and data-driven, not generic. Reference actual patterns.
- Do NOT use em dashes in any text.
`

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
    model: 'gpt-5.2',
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
    max_completion_tokens: 30000,
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

