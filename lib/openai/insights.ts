import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export type InsightScope = 'location' | 'team'
export type PeriodWindow = '30d' | '90d' | '6m' | '1y'

export interface InsightsInput {
  reviews: Array<{
    id?: string
    rating: number
    comment: string | null
    review_date: string
    reviewer_name?: string | null
    reply_status?: string | null
  }>
  previousReviews?: Array<{
    id?: string
    rating: number
    comment: string | null
    review_date: string
    reviewer_name?: string | null
    reply_status?: string | null
  }>
  periodStart: string
  periodEnd: string
  previousPeriodStart?: string
  previousPeriodEnd?: string
  locationName?: string | null
  teamName?: string | null
  scope?: InsightScope
  periodWindow?: PeriodWindow
}

export interface StandardReportData {
  comparison: {
    currentAvgRating: number
    previousAvgRating: number
    currentReviewCount: number
    previousReviewCount: number
    currentSentiment: number
    previousSentiment: number
    headline: string
    keyDeltas: Array<{
      metric: string
      direction: 'up' | 'down' | 'flat'
      description: string
    }>
  }
  overallSentiment: number
  momentumScore: number
  executiveSummary: string
  ratingTrend: 'improving' | 'declining' | 'stable'
  topActionItem: { title: string; description: string }
  keyStrengths: Array<{ theme: string; description: string; mentionCount: number; exampleQuote?: string }>
  keyWeaknesses: Array<{ theme: string; description: string; mentionCount: number; severity: 'low' | 'medium' | 'high'; exampleQuote?: string }>
  emergingTopics?: Array<{ topic: string; sentiment: 'positive' | 'negative' | 'mixed'; description: string; previousMentions: number; currentMentions: number }>
  riskAlerts: Array<{ title: string; description: string; urgency: 'low' | 'medium' | 'high' }>
  recommendations: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high'; category: 'service' | 'staff' | 'operations' | 'marketing' | 'product' }>
  notableQuotes: Array<{ quote: string; rating: number; sentiment: 'positive' | 'negative'; theme: string }>
}

export interface AnnualReportData {
  yearInNumbers: {
    totalReviews: number
    averageRating: number
    totalResponses: number
    responseRate: number
    bestMonth: { month: string; avgRating: number; reviewCount: number }
    worstMonth: { month: string; avgRating: number; reviewCount: number }
    fiveStarPercentage: number
  }
  yearStory: string
  monthlyTimeline: Array<{ month: string; avgRating: number; reviewCount: number; annotation: string | null }>
  highlights: Array<{ title: string; description: string; quote: string | null }>
  lowlights: Array<{ title: string; description: string; quote: string | null }>
  keyStrengths: Array<{ theme: string; description: string; mentionCount: number; exampleQuote?: string }>
  keyWeaknesses: Array<{ theme: string; description: string; mentionCount: number; severity: 'low' | 'medium' | 'high'; exampleQuote?: string }>
  recommendations: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high'; category: 'service' | 'staff' | 'operations' | 'marketing' | 'product' }>
  notableQuotes: Array<{ quote: string; rating: number; sentiment: 'positive' | 'negative'; theme: string }>
}

// ─── Voice Block ──────────────────────────────────────────────────────────────

const VOICE_RULES = `
VOICE RULES:
- Write like a sharp friend who runs a business, not a consultant.
- Use "you" and "your." Short sentences. No filler. No jargon.
- If a stat is trivial relative to sample size, say so. Don't manufacture drama.
- Every sentence should make the owner feel smarter or prompt them to do something. If it doesn't, cut it.
- Never use em dashes. Use commas, periods, or semicolons instead.`

// ─── System Prompts by Scope x Period ─────────────────────────────────────────

const SYSTEM_PROMPTS: Record<InsightScope, Record<PeriodWindow, string>> = {
  location: {
    '30d': `You analyze the last 30 days of reviews for a single business location. Your job: what happened this month, what changed vs last month, and what should the owner do this week. Be specific and tactical.\n${VOICE_RULES}`,

    '90d': `You analyze the last 90 days of reviews for a single business location vs the previous 90 days. Your job: what patterns are forming, what's getting better or worse, and what should the owner prioritize this month.\n${VOICE_RULES}`,

    '6m': `You analyze the last 6 months of reviews for a single business location vs the previous 6 months. Your job: assess progress, identify what's improved or stagnated, and recommend strategic priorities for next quarter.\n${VOICE_RULES}`,

    '1y': `You deliver a year-in-review for a single business location. Tell the story of the year: the highs, the lows, the turning points. Be narrative and forward-looking.\n${VOICE_RULES}`,
  },
  team: {
    '30d': `You analyze the last 30 days of reviews across all locations for a business vs the previous 30 days. Spot cross-location patterns: which locations had a great month, which struggled, and what changed.\n${VOICE_RULES}`,

    '90d': `You analyze the last 90 days across all locations vs the previous 90 days. Identify which locations are outperforming, whether brand standards are consistent, and what operational patterns differ between high and low performers.\n${VOICE_RULES}`,

    '6m': `You deliver a 6-month portfolio review across all locations vs the previous 6 months. Assess overall brand health, whether investments are paying off, and which locations need more resources.\n${VOICE_RULES}`,

    '1y': `You deliver a year-in-review across all locations. Tell the story of the business's year: overall trajectory, standout locations, underperformers, and strategic priorities for next year.\n${VOICE_RULES}`,
  },
}

// ─── REV Reference Instructions ───────────────────────────────────────────────

const REV_INSTRUCTIONS = `
INLINE REVIEW REFERENCES:
You CAN link to specific reviews using this format: {{REV:review_id:display text}}
The display text becomes a clickable link to the original review. Weave references naturally into the sentence so they read as part of the prose.

WHEN TO USE (sparingly):
- When attributing a specific claim to a specific reviewer in descriptions or the executive summary
- In exampleQuote fields to make the quote clickable

WHEN NOT TO USE:
- notableQuotes: NEVER use {{REV}} inside notableQuotes. Those are already displayed as standalone quote cards.
- General trends or aggregate observations ("most reviewers said..." needs no link)
- Summaries that synthesize multiple reviews into one point
- Recommendations, strategy advice
- topActionItem (strategic, not review-specific)

CRITICAL: Do NOT write a quote in plain text and THEN repeat it inside a {{REV}} marker. The display text should be a short attribution phrase like "one cafe owner" or "a returning customer", NOT the quote itself. The quote should appear once in the sentence as normal text.

Aim for 3-8 total references across ALL fields combined. Most paragraphs should have zero.

GOOD examples:
- "{{REV:abc-123:One cafe owner}} reported that automation cut their review response time in half."
- "The strongest complaint came from {{REV:ghi-789:a first-time visitor}} who waited 45 minutes for cold food."

BAD examples:
- 'one customer said "Great service" ({{REV:abc:Great service}})' — quote repeated twice
- "{{REV:abc:Reviewers}} praised {{REV:def:the service}} and {{REV:ghi:the food}}" — overlinked
- "Staff friendliness was highlighted {{REV:abc-123}}" — no display text`

// ─── Helper: compute stats for a review set ──────────────────────────────────

type ReviewEntry = InsightsInput['reviews'][number]

function computeStats(reviews: ReviewEntry[]) {
  const ratings = reviews.map(r => r.rating)
  const count = ratings.length
  const avg = count > 0 ? ratings.reduce((a, b) => a + b, 0) / count : 0
  const distribution = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: ratings.filter(x => x === r).length,
  }))
  const repliedCount = reviews.filter(r => r.reply_status === 'posted' || r.reply_status === 'synced_external').length
  const responseRate = count > 0 ? (repliedCount / count) * 100 : 0
  const fiveStarPct = count > 0 ? (distribution[0].count / count) * 100 : 0

  return { count, avg, distribution, responseRate, repliedCount, fiveStarPct }
}

function formatDistribution(dist: Array<{ rating: number; count: number }>): string {
  return dist.map(d => `${d.rating}-star: ${d.count}`).join(', ')
}

function formatReviews(reviews: ReviewEntry[], label: string, startDate: string, endDate: string): string {
  let out = `-- ${label} (${startDate} to ${endDate}) --\n`
  reviews.slice(0, 100).forEach((review, idx) => {
    const date = new Date(review.review_date).toISOString().split('T')[0]
    const idTag = review.id ? ` [ID:${review.id}]` : ''
    const nameTag = review.reviewer_name ? ` by ${review.reviewer_name}` : ''
    out += `${idx + 1}.${idTag} [${review.rating}/5] [${date}]${nameTag} ${review.comment || '(No comment)'}\n`
  })
  return out
}

function confidenceBlock(reviewCount: number): string {
  if (reviewCount < 10) {
    return `CONFIDENCE LEVEL: LOW (${reviewCount} reviews)
SHORT REPORT. Summary, strengths, weaknesses, 2-3 recommendations max. No trend claims. Acknowledge limited data directly.`
  }
  if (reviewCount <= 50) {
    return `CONFIDENCE LEVEL: STANDARD (${reviewCount} reviews)
STANDARD REPORT. All sections, 1-2 sentences per description. Appropriate hedging on trends.`
  }
  return `CONFIDENCE LEVEL: HIGH (${reviewCount} reviews)
FULL REPORT. Rich analysis, more items per section, confident claims.`
}

// ─── Standard Prompt Builder (30d / 90d / 6m) ────────────────────────────────

function buildStandardPrompt(input: InsightsInput, scope: InsightScope, periodWindow: PeriodWindow): string {
  const currentStats = computeStats(input.reviews)
  const prevReviews = input.previousReviews || []
  const prevStats = computeStats(prevReviews)

  const periodLabel = periodWindow === '30d' ? '30 days' : periodWindow === '90d' ? '90 days' : '6 months'

  // Period-specific focus
  const periodFocus: Record<string, string> = {
    '30d': `PERIOD FOCUS: Last 30 days. Be tactical. The topActionItem should be something the owner can do THIS WEEK. Recommendations should be quick fixes, not strategic initiatives.`,
    '90d': `PERIOD FOCUS: Last 90 days. Be operational. The topActionItem should address the most impactful pattern. Recommendations should be improvements that show results in 30-60 days.`,
    '6m': `PERIOD FOCUS: Last 6 months. Be strategic. The topActionItem should be the highest-leverage change for next quarter. Recommendations should be investments (training, process changes, campaigns).`,
  }

  // Scope-specific focus
  const scopeFocus: Record<string, string> = {
    location: `SCOPE: Single location. All insights should be specific to this location's operations. Recommendations should be things the manager can directly act on.`,
    team: `SCOPE: All locations. Compare and contrast across locations. Identify team-wide vs location-specific patterns. Flag locations dragging down the average.`,
  }

  let prompt = `${confidenceBlock(currentStats.count)}\n\n`
  prompt += `${periodFocus[periodWindow]}\n\n`
  prompt += `${scopeFocus[scope]}\n\n`

  // Data header
  prompt += `--- DATA ---\n`
  if (input.locationName) prompt += `Location: ${input.locationName}\n`
  if (input.teamName) prompt += `Business: ${input.teamName}\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd} (current ${periodLabel})\n`
  if (input.previousPeriodStart && input.previousPeriodEnd) {
    prompt += `Previous period: ${input.previousPeriodStart} to ${input.previousPeriodEnd}\n`
  }
  prompt += `\n`

  // Pre-computed stats for both periods
  prompt += `CURRENT PERIOD STATS:\n`
  prompt += `  Reviews: ${currentStats.count}\n`
  prompt += `  Average rating: ${currentStats.avg.toFixed(2)}\n`
  prompt += `  Distribution: ${formatDistribution(currentStats.distribution)}\n`
  prompt += `  Response rate: ${currentStats.responseRate.toFixed(1)}%\n`
  prompt += `\n`

  if (prevReviews.length > 0) {
    prompt += `PREVIOUS PERIOD STATS:\n`
    prompt += `  Reviews: ${prevStats.count}\n`
    prompt += `  Average rating: ${prevStats.avg.toFixed(2)}\n`
    prompt += `  Distribution: ${formatDistribution(prevStats.distribution)}\n`
    prompt += `  Response rate: ${prevStats.responseRate.toFixed(1)}%\n`
    prompt += `\n`
  }

  // Reviews
  prompt += formatReviews(input.reviews, 'CURRENT PERIOD', input.periodStart, input.periodEnd)
  prompt += `\n`

  if (prevReviews.length > 0 && input.previousPeriodStart && input.previousPeriodEnd) {
    prompt += formatReviews(prevReviews, 'PREVIOUS PERIOD', input.previousPeriodStart, input.previousPeriodEnd)
    prompt += `\n`
  }

  // JSON schema
  const emergingTopicsSchema = periodWindow === '30d'
    ? `  "emergingTopics": [{ "topic": "...", "sentiment": "positive|negative|mixed", "description": "...", "previousMentions": N, "currentMentions": N }],\n`
    : ''

  const emergingTopicsInstruction = periodWindow === '30d'
    ? `- emergingTopics (30d only): 1-4 items. Compare topics across both periods. previousMentions and currentMentions should reflect actual counts from each period.\n`
    : ''

  prompt += `Return a JSON object with this EXACT structure:
{
  "comparison": {
    "currentAvgRating": ${currentStats.avg.toFixed(2)},
    "previousAvgRating": ${prevStats.avg.toFixed(2)},
    "currentReviewCount": ${currentStats.count},
    "previousReviewCount": ${prevStats.count},
    "currentSentiment": <number 0-100>,
    "previousSentiment": <number 0-100>,
    "headline": "one-sentence summary of what changed",
    "keyDeltas": [{ "metric": "...", "direction": "up|down|flat", "description": "..." }]
  },
  "overallSentiment": <number 0-100>,
  "momentumScore": <number -10 to +10>,
  "executiveSummary": "...",
  "ratingTrend": "improving|declining|stable",
  "topActionItem": { "title": "...", "description": "..." },
  "keyStrengths": [{ "theme": "...", "description": "...", "mentionCount": N, "exampleQuote": "..." }],
  "keyWeaknesses": [{ "theme": "...", "description": "...", "mentionCount": N, "severity": "low|medium|high", "exampleQuote": "..." }],
${emergingTopicsSchema}  "riskAlerts": [{ "title": "...", "description": "...", "urgency": "low|medium|high" }],
  "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high", "category": "service|staff|operations|marketing|product" }],
  "notableQuotes": [{ "quote": "...", "rating": N, "sentiment": "positive|negative", "theme": "..." }]
}

${REV_INSTRUCTIONS}

KEY INSTRUCTIONS:
- Compute the comparison block FIRST. This anchors the whole report. Every strength/weakness should note whether it's new, growing, shrinking, or persistent vs the previous period.
- Don't flag a decline unless it's meaningful relative to sample size.
- comparison.currentAvgRating and previousAvgRating MUST match the pre-computed stats above exactly.
- comparison.currentReviewCount and previousReviewCount MUST match the pre-computed stats above exactly.
${emergingTopicsInstruction}- overallSentiment: 0-100 where 50 is neutral, 80+ is excellent, below 30 is crisis.
- momentumScore: -10 to +10 based on trajectory. Positive means improving vs previous period.
- topActionItem: match urgency to time window. ${periodWindow === '30d' ? 'Do this week.' : periodWindow === '90d' ? 'Do this month.' : 'Do this quarter.'}
- keyStrengths: 3-5 items. Each MUST include an exampleQuote from actual reviews.
- keyWeaknesses: 2-4 items. Each MUST include an exampleQuote. Severity correlates with frequency and impact.
- riskAlerts: 0-3 items. Only genuine business risks. Do not fabricate.
- recommendations: 3-5 items. Quick wins first.
- notableQuotes: 3-5 covering different themes. Mix of positive and negative.
- Every field must be grounded in the actual review data. No generic advice. No filler.
`

  return prompt
}

// ─── Annual Prompt Builder (1y) ──────────────────────────────────────────────

function buildAnnualPrompt(input: InsightsInput, scope: InsightScope): string {
  const stats = computeStats(input.reviews)

  // Group reviews by YYYY-MM for monthly stats
  const monthlyMap = new Map<string, ReviewEntry[]>()
  for (const review of input.reviews) {
    const month = review.review_date.substring(0, 7) // YYYY-MM
    if (!monthlyMap.has(month)) monthlyMap.set(month, [])
    monthlyMap.get(month)!.push(review)
  }

  const monthlyStats = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, reviews]) => {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      return { month, avgRating: parseFloat(avg.toFixed(2)), reviewCount: reviews.length }
    })

  const scopeFocus: Record<string, string> = {
    location: `SCOPE: Single location. Tell the story of this location's year. Be specific about what defined each phase.`,
    team: `SCOPE: All locations. Tell the story of the business's year. Compare location trajectories. Identify standouts and underperformers.`,
  }

  let prompt = `${confidenceBlock(stats.count)}\n\n`
  prompt += `${scopeFocus[scope]}\n\n`

  // Data header
  prompt += `--- DATA ---\n`
  if (input.locationName) prompt += `Location: ${input.locationName}\n`
  if (input.teamName) prompt += `Business: ${input.teamName}\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd} (full year)\n\n`

  // Year stats
  prompt += `YEAR STATS:\n`
  prompt += `  Total reviews: ${stats.count}\n`
  prompt += `  Average rating: ${stats.avg.toFixed(2)}\n`
  prompt += `  Distribution: ${formatDistribution(stats.distribution)}\n`
  prompt += `  Response rate: ${stats.responseRate.toFixed(1)}%\n`
  prompt += `  Responses posted: ${stats.repliedCount}\n`
  prompt += `  5-star percentage: ${stats.fiveStarPct.toFixed(1)}%\n`
  prompt += `\n`

  // Monthly stats table
  prompt += `MONTHLY BREAKDOWN:\n`
  for (const m of monthlyStats) {
    prompt += `  ${m.month}: ${m.reviewCount} reviews, avg ${m.avgRating}\n`
  }
  prompt += `\n`

  // Reviews
  prompt += formatReviews(input.reviews, 'FULL YEAR', input.periodStart, input.periodEnd)
  prompt += `\n`

  // JSON schema
  prompt += `Return a JSON object with this EXACT structure:
{
  "yearInNumbers": {
    "totalReviews": ${stats.count},
    "averageRating": ${parseFloat(stats.avg.toFixed(2))},
    "totalResponses": ${stats.repliedCount},
    "responseRate": ${parseFloat(stats.responseRate.toFixed(1))},
    "bestMonth": { "month": "YYYY-MM", "avgRating": N, "reviewCount": N },
    "worstMonth": { "month": "YYYY-MM", "avgRating": N, "reviewCount": N },
    "fiveStarPercentage": ${parseFloat(stats.fiveStarPct.toFixed(1))}
  },
  "yearStory": "2-3 paragraphs telling the arc of the year",
  "monthlyTimeline": [{ "month": "YYYY-MM", "avgRating": N, "reviewCount": N, "annotation": "string or null" }],
  "highlights": [{ "title": "...", "description": "...", "quote": "string or null" }],
  "lowlights": [{ "title": "...", "description": "...", "quote": "string or null" }],
  "keyStrengths": [{ "theme": "...", "description": "...", "mentionCount": N, "exampleQuote": "..." }],
  "keyWeaknesses": [{ "theme": "...", "description": "...", "mentionCount": N, "severity": "low|medium|high", "exampleQuote": "..." }],
  "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high", "category": "service|staff|operations|marketing|product" }],
  "notableQuotes": [{ "quote": "...", "rating": N, "sentiment": "positive|negative", "theme": "..." }]
}

${REV_INSTRUCTIONS}

KEY INSTRUCTIONS:
- yearInNumbers: totalReviews, averageRating, totalResponses, responseRate, and fiveStarPercentage MUST match the pre-computed stats above exactly. bestMonth and worstMonth should be derived from the monthly breakdown.
- yearStory should be 2-3 paragraphs telling the arc of the year. What defined each phase? What changed?
- monthlyTimeline: include ALL months from the monthly breakdown. Annotations should only appear on months with notable shifts; set to null otherwise.
- highlights: 3-5 standout positive moments from the year.
- lowlights: 2-4 significant negative moments or challenges.
- keyStrengths: 3-5 items. Each MUST include an exampleQuote from actual reviews.
- keyWeaknesses: 2-4 items. Each MUST include an exampleQuote. Severity correlates with frequency and impact.
- recommendations: 3-5 annual strategic priorities for next year. Not quick fixes.
- notableQuotes: 3-5 covering different themes. Mix of positive and negative. Should capture the range of the full year.
- Every field must be grounded in the actual review data. No generic advice. No filler.
`

  return prompt
}

// ─── Main Insights Runner ─────────────────────────────────────────────────────

/**
 * Generates rich, structured insights for a team or location based on reviews.
 */
export async function insightsRun(input: InsightsInput): Promise<StandardReportData | AnnualReportData> {
  const scope = input.scope || (input.locationName ? 'location' : 'team')
  const periodWindow = input.periodWindow || '6m'
  const systemPrompt = SYSTEM_PROMPTS[scope][periodWindow]

  const prompt = periodWindow === '1y'
    ? buildAnnualPrompt(input, scope)
    : buildStandardPrompt(input, scope, periodWindow)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 10000,
    response_format: { type: 'json_object' },
  })

  const insightsText = completion.choices[0]?.message?.content?.trim()

  if (!insightsText) {
    throw new Error('Failed to generate insights')
  }

  try {
    const parsed = JSON.parse(insightsText)

    // Scan the entire JSON for {{REV:uuid}} markers and build a lookup map
    // Combine current and previous reviews for the lookup
    const allReviews = [...input.reviews, ...(input.previousReviews || [])]
    const reviewsById = new Map(
      allReviews.filter(r => r.id).map(r => [r.id!, r])
    )
    const jsonStr = JSON.stringify(parsed)
    const refPattern = /\{\{REV:([a-f0-9-]+)(?::[^}]+)?\}\}/g
    const referencedIds = new Set<string>()
    let match
    while ((match = refPattern.exec(jsonStr)) !== null) {
      referencedIds.add(match[1])
    }

    const referencedReviews: Record<string, { rating: number; comment: string | null; review_date: string; reviewer_name?: string | null }> = {}
    for (const id of Array.from(referencedIds)) {
      const r = reviewsById.get(id)
      if (r) {
        referencedReviews[id] = {
          rating: r.rating,
          comment: r.comment,
          review_date: r.review_date,
          reviewer_name: r.reviewer_name || null,
        }
      }
    }

    parsed.referencedReviews = referencedReviews
    return parsed
  } catch (error) {
    throw new Error('Failed to parse insights JSON')
  }
}

// ─── Competitive Analysis (unchanged) ─────────────────────────────────────────

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
