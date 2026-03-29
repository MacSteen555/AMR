import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export type InsightScope = 'location' | 'team'
export type PeriodWindow = '30d' | '90d' | '6m' | '1y'
export type PeriodWindowOrUnified = PeriodWindow | 'unified'

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
  periodWindow?: PeriodWindowOrUnified
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

/* ── Unified Report (replaces all 4 period-specific reports) ─────────── */

export interface SnapshotCard {
  headline: string
  description: string
  delta?: string          // e.g. "+12%", "3x", "new"
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface TrendStats {
  currentAvgRating: number
  previousAvgRating: number | null
  currentReviewCount: number
  previousReviewCount: number
  currentSentiment: number       // 0-100
  previousSentiment: number | null
  currentResponseRate: number
  previousResponseRate: number | null
  currentFiveStarPct: number
  previousFiveStarPct: number | null
}

export interface SubTheme {
  name: string
  mentionCount: number
  sentiment: 'positive' | 'negative' | 'mixed'
  exampleQuote?: string
}

export interface ThemeItem {
  theme: string
  mentionCount: number
  allTimeMentionCount: number
  sentiment: 'positive' | 'negative' | 'mixed'
  trendDirection: 'up' | 'down' | 'stable' | 'new'
  trendDescription: string
  avgRatingWhenMentioned: number
  overallAvgRating: number
  subThemes: SubTheme[]
  topQuotes: string[]
  narrative: string
}

export interface MonthlyTheme {
  theme: string
  mentionCount: number
  sentiment: 'positive' | 'negative' | 'mixed'
}

export interface TimelineMonth {
  month: string                  // YYYY-MM
  avgRating: number
  reviewCount: number
  annotation: string | null
  dominantThemes: MonthlyTheme[]
}

export interface TimelineInsight {
  title: string
  description: string
  type: 'theme_emerged' | 'theme_disappeared' | 'sentiment_shift' | 'rating_correlation' | 'trend'
  monthsAffected: string[]
}

export interface HighlightCard {
  title: string
  description: string
  quote?: string
}

export interface StrengthCard {
  theme: string
  description: string
  mentionCount: number
  exampleQuote?: string
}

export interface WeaknessCard {
  theme: string
  description: string
  mentionCount: number
  severity: 'low' | 'medium' | 'high'
  exampleQuote?: string
}

export interface RecommendationCard {
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  effort: 'low' | 'medium' | 'high'
  category: string
}

export interface UnifiedReportData {
  // Metadata
  adaptiveWindowDays: number
  recentPeriodStart: string
  recentPeriodEnd: string
  previousPeriodStart: string | null
  previousPeriodEnd: string | null

  // Zone 1: Recent Trends
  snapshot: SnapshotCard[]                    // Section 1
  trendStats: TrendStats                      // Section 2
  themes: ThemeItem[]                         // Section 3

  // Zone 2: Big Picture
  bigPictureStats: {                          // Section 4
    totalReviews: number
    averageRating: number
    fiveStarPercentage: number
    responseRate: number
  }
  bigPictureNarrative: string                 // Section 4
  keyStrengths: StrengthCard[]                // Section 5
  keyWeaknesses: WeaknessCard[]               // Section 5
  monthlyTimeline: TimelineMonth[]            // Section 6
  highlights: HighlightCard[]                 // Section 6
  lowlights: HighlightCard[]                  // Section 6
  timelineInsights: TimelineInsight[]         // Section 6
  recommendations: RecommendationCard[]       // Section 7 (may be empty)
  notableQuotes: Array<{ quote: string; rating: number; sentiment: string; theme: string }>

  // Review references (populated post-generation)
  referencedReviews: Record<string, {
    rating: number
    comment: string | null
    review_date: string
    reviewer_name?: string | null
  }>
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

Aim for 5-20 total references across ALL fields combined. Only cite a review when it genuinely strengthens the point. If the claim stands on its own, skip the citation.

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
  const antiExtrapolation = `\nNever extrapolate a trend from fewer than 3 data points on the same theme. State the observation, don't call it a pattern. A single negative review about "wait times" is one complaint, not a trend.`

  if (reviewCount < 10) {
    return `CONFIDENCE LEVEL: LOW (${reviewCount} reviews)
SHORT REPORT. Summary, strengths, weaknesses, 2-3 recommendations max. No trend claims. Acknowledge limited data directly.${antiExtrapolation}`
  }
  if (reviewCount <= 50) {
    return `CONFIDENCE LEVEL: STANDARD (${reviewCount} reviews)
STANDARD REPORT. All sections, 1-2 sentences per description. Appropriate hedging on trends.${antiExtrapolation}`
  }
  return `CONFIDENCE LEVEL: HIGH (${reviewCount} reviews)
FULL REPORT. Rich analysis, more items per section, confident claims.${antiExtrapolation}`
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

// ─── Unified System Prompts ───────────────────────────────────────────────────

const UNIFIED_SYSTEM_PROMPTS: Record<InsightScope, string> = {
  location: `You are a sharp, data-driven business analyst who reviews Google Business Profile reviews for a single location. You produce a unified report with two parts: (1) Recent Trends - what changed in the most recent window vs the prior period, and (2) Big Picture - patterns across all reviews. ${VOICE_RULES}`,
  team: `You are a sharp, data-driven business analyst who reviews Google Business Profile reviews across all locations for a multi-location business. You produce a unified report with two parts: (1) Recent Trends comparing locations and spotting what changed, and (2) Big Picture - brand-wide patterns, cross-location comparisons, and portfolio-level insights. ${VOICE_RULES}`,
}

// ─── Unified Prompt Builder ──────────────────────────────────────────────────

function buildUnifiedPrompt(input: InsightsInput & {
  allReviews: InsightsInput['reviews']
  adaptiveWindowDays: number
}): string {
  const recentReviews = input.reviews
  const prevReviews = input.previousReviews || []
  const allReviews = input.allReviews

  // Pre-compute stats
  const recentStats = computeStats(recentReviews)
  const prevStats = prevReviews.length > 0 ? computeStats(prevReviews) : null
  const allTimeStats = computeStats(allReviews)

  // Monthly breakdown from all reviews
  const monthlyMap = new Map<string, ReviewEntry[]>()
  for (const review of allReviews) {
    const month = review.review_date.substring(0, 7)
    if (!monthlyMap.has(month)) monthlyMap.set(month, [])
    monthlyMap.get(month)!.push(review)
  }

  const monthlyStats = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, reviews]) => {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      return { month, avgRating: parseFloat(avg.toFixed(2)), reviewCount: reviews.length }
    })

  let prompt = `${confidenceBlock(recentStats.count)}\n\n`

  // Data header
  prompt += `--- DATA ---\n`
  if (input.locationName) prompt += `Location: ${input.locationName}\n`
  if (input.teamName) prompt += `Business: ${input.teamName}\n`
  prompt += `Adaptive window: ${input.adaptiveWindowDays} days\n`
  prompt += `Recent period: ${input.periodStart} to ${input.periodEnd}\n`
  if (input.previousPeriodStart && input.previousPeriodEnd) {
    prompt += `Previous period: ${input.previousPeriodStart} to ${input.previousPeriodEnd}\n`
  }
  prompt += `Total reviews (all time): ${allReviews.length}\n\n`

  // Recent period stats
  prompt += `RECENT PERIOD STATS (trendStats must match exactly):\n`
  prompt += `  Reviews: ${recentStats.count}\n`
  prompt += `  Average rating: ${recentStats.avg.toFixed(2)}\n`
  prompt += `  Response rate: ${recentStats.responseRate.toFixed(1)}%\n`
  prompt += `  5-star percentage: ${recentStats.fiveStarPct.toFixed(1)}%\n\n`

  if (prevStats) {
    prompt += `PREVIOUS PERIOD STATS (trendStats must match exactly):\n`
    prompt += `  Reviews: ${prevStats.count}\n`
    prompt += `  Average rating: ${prevStats.avg.toFixed(2)}\n`
    prompt += `  Response rate: ${prevStats.responseRate.toFixed(1)}%\n`
    prompt += `  5-star percentage: ${prevStats.fiveStarPct.toFixed(1)}%\n\n`
  }

  // All-time stats
  prompt += `ALL-TIME STATS (bigPictureStats must match exactly):\n`
  prompt += `  Total reviews: ${allTimeStats.count}\n`
  prompt += `  Average rating: ${allTimeStats.avg.toFixed(2)}\n`
  prompt += `  5-star percentage: ${allTimeStats.fiveStarPct.toFixed(1)}%\n`
  prompt += `  Response rate: ${allTimeStats.responseRate.toFixed(1)}%\n\n`

  // Monthly breakdown
  prompt += `MONTHLY BREAKDOWN:\n`
  prompt += `(When generating monthlyTimeline, analyze the actual review text for each month to identify dominant themes and their sentiment.)\n`
  for (const m of monthlyStats) {
    prompt += `  ${m.month}: ${m.reviewCount} reviews, avg ${m.avgRating}\n`
  }
  prompt += `\n`

  // Reviews
  prompt += formatReviews(recentReviews, 'RECENT PERIOD', input.periodStart, input.periodEnd)
  prompt += `\n`

  if (prevReviews.length > 0 && input.previousPeriodStart && input.previousPeriodEnd) {
    prompt += formatReviews(prevReviews, 'PREVIOUS PERIOD', input.previousPeriodStart, input.previousPeriodEnd)
    prompt += `\n`
  }

  // Older reviews not in recent or previous period (sample for big picture context)
  const recentAndPrevIds = new Set([...recentReviews, ...prevReviews].map(r => r.id).filter(Boolean))
  const olderReviews = allReviews.filter(r => !r.id || !recentAndPrevIds.has(r.id))
  if (olderReviews.length > 0) {
    const earliest = olderReviews.reduce((min, r) => r.review_date < min ? r.review_date : min, olderReviews[0].review_date)
    const latest = olderReviews.reduce((max, r) => r.review_date > max ? r.review_date : max, olderReviews[0].review_date)
    prompt += formatReviews(olderReviews, 'OLDER REVIEWS (for Big Picture)', earliest, latest)
    prompt += `\n`
  }

  // JSON schema and instructions
  prompt += `${REV_INSTRUCTIONS}

Return a JSON object with this EXACT structure:
{
  "adaptiveWindowDays": ${input.adaptiveWindowDays},
  "recentPeriodStart": "${input.periodStart}",
  "recentPeriodEnd": "${input.periodEnd}",
  "previousPeriodStart": ${input.previousPeriodStart ? `"${input.previousPeriodStart}"` : 'null'},
  "previousPeriodEnd": ${input.previousPeriodEnd ? `"${input.previousPeriodEnd}"` : 'null'},

  "snapshot": [{ "headline": "...", "description": "...", "delta": "+12% or 3x (a SHORT numeric change indicator, or omit this field entirely if no meaningful comparison exists)", "sentiment": "positive|negative|neutral" }],

  "trendStats": {
    "currentAvgRating": ${recentStats.avg.toFixed(2)},
    "previousAvgRating": ${prevStats ? prevStats.avg.toFixed(2) : 'null'},
    "currentReviewCount": ${recentStats.count},
    "previousReviewCount": ${prevStats ? prevStats.count : 0},
    "currentSentiment": <number 0-100>,
    "previousSentiment": ${prevStats ? '<number 0-100>' : 'null'},
    "currentResponseRate": ${parseFloat(recentStats.responseRate.toFixed(1))},
    "previousResponseRate": ${prevStats ? parseFloat(prevStats.responseRate.toFixed(1)) : 'null'},
    "currentFiveStarPct": ${parseFloat(recentStats.fiveStarPct.toFixed(1))},
    "previousFiveStarPct": ${prevStats ? parseFloat(prevStats.fiveStarPct.toFixed(1)) : 'null'}
  },

  "themes": [{
    "theme": "...",
    "mentionCount": N,
    "allTimeMentionCount": N,
    "sentiment": "positive|negative|mixed",
    "trendDirection": "up|down|stable|new",
    "trendDescription": "Mentions up 40% vs prior period",
    "avgRatingWhenMentioned": N,
    "overallAvgRating": N,
    "subThemes": [{ "name": "...", "mentionCount": N, "sentiment": "positive|negative|mixed", "exampleQuote": "..." }],
    "topQuotes": ["...", "...", "..."],
    "narrative": "2-3 sentences interpreting what this theme means for the business"
  }],

  "bigPictureStats": {
    "totalReviews": ${allTimeStats.count},
    "averageRating": ${parseFloat(allTimeStats.avg.toFixed(2))},
    "fiveStarPercentage": ${parseFloat(allTimeStats.fiveStarPct.toFixed(1))},
    "responseRate": ${parseFloat(allTimeStats.responseRate.toFixed(1))}
  },
  "bigPictureNarrative": "3-4 tight sentences summarizing business identity with review refs inline",

  "keyStrengths": [{ "theme": "...", "description": "...", "mentionCount": N, "exampleQuote": "..." }],
  "keyWeaknesses": [{ "theme": "...", "description": "...", "mentionCount": N, "severity": "low|medium|high", "exampleQuote": "..." }],

  "monthlyTimeline": [{
    "month": "YYYY-MM",
    "avgRating": N,
    "reviewCount": N,
    "annotation": "string or null",
    "dominantThemes": [{ "theme": "...", "mentionCount": N, "sentiment": "positive|negative|mixed" }]
  }],
  "timelineInsights": [{
    "title": "...",
    "description": "2-3 sentence narrative with review refs",
    "type": "theme_emerged|theme_disappeared|sentiment_shift|rating_correlation|trend",
    "monthsAffected": ["YYYY-MM"]
  }],
  "highlights": [{ "title": "...", "description": "...", "quote": "string or null" }],
  "lowlights": [{ "title": "...", "description": "...", "quote": "string or null" }],

  "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high", "category": "..." }],
  "notableQuotes": [{ "quote": "...", "rating": N, "sentiment": "positive|negative", "theme": "..." }]
}

IMPORTANT INSTRUCTIONS:

SNAPSHOT (rename to "30 Day Snapshot"):
- 3-5 punchy headline insights about the recent period.
- Each card MUST compare the last 30 days against all-time patterns. What's different? What's consistent? What's surprising?
- Each card MUST cite 2-3 specific reviews using {{REV:id:display text}} format. Ground every claim in customer proof.
- If there is a meaningful numeric delta, include it. If not, OMIT the delta field entirely.

THEMES (this is a KEY section — go deep):
- Extract 8-12 themes from the reviews. Read every review carefully and identify recurring topics.
- For each theme, identify 2-4 sub-themes (e.g., "Staff" → "Friendliness", "Knowledge", "Response time").
- trendDirection: Compare recent period mentions to previous period. "new" if theme only appears in recent period.
- trendDescription: Write a specific comparison like "Mentions up 40% vs prior period" or "Consistent across both periods."
- avgRatingWhenMentioned: Calculate the average rating of reviews that mention this theme. Compare to overallAvgRating.
- narrative: 2-3 sentences interpreting what this theme means for the business. What should the owner take away? Cite 1-2 reviews.
- topQuotes: 3-5 review-referenced quotes. Use {{REV:id:display text}} format.
- Be thorough but earn every sentence. If a point doesn't make the owner smarter or prompt action, cut it.

STRENGTHS & WEAKNESSES:
- Extract up to 7 strengths and up to 7 weaknesses. Dig deep — more is better.
- Each must cite at least one specific review.
- For weaknesses, severity should reflect how damaging the issue is to the business.

TIMELINE:
- monthlyTimeline: Include ALL months. For each month, list the top 3-5 dominant themes with mention counts and sentiment.
- timelineInsights: 3-5 narrative observations about month-over-month patterns. Look for:
  * Themes that emerged and persisted (or disappeared)
  * Themes where sentiment shifted over time
  * Correlations between theme emergence and rating changes
  * Seasonal or temporal patterns
- Each insight should cite specific months and, where possible, specific reviews.

RECOMMENDATIONS:
- World-class consulting advice. 3-5 sentences minimum per recommendation. Cite specific patterns and data.
- If there are not enough reviews or patterns, return an empty array. Never pad with generic advice.

GENERAL:
- trendStats must EXACTLY match the precomputed stats above. Do not recalculate.
- bigPictureStats must EXACTLY match the all-time stats above. Do not recalculate.
- Aim for 5-20 total review references across the entire report using {{REV:id:display text}} format. Only cite when the specific review genuinely strengthens the point.
- Every field must be grounded in actual review data. No generic advice. No filler.
`

  return prompt
}

// ─── Unified Insights Runner ─────────────────────────────────────────────────

export async function insightsRunUnified(input: InsightsInput & {
  allReviews: InsightsInput['reviews']
  adaptiveWindowDays: number
}): Promise<UnifiedReportData> {
  const scope: InsightScope = input.locationName ? 'location' : 'team'
  const systemPrompt = UNIFIED_SYSTEM_PROMPTS[scope]
  const prompt = buildUnifiedPrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 16000,
    response_format: { type: 'json_object' },
  })

  const insightsText = completion.choices[0]?.message?.content?.trim()

  if (!insightsText) {
    throw new Error('Failed to generate unified insights')
  }

  try {
    const parsed = JSON.parse(insightsText) as UnifiedReportData

    // Scan the entire JSON for {{REV:uuid}} markers and build a lookup map
    const allInputReviews = [...input.allReviews]
    const reviewsById = new Map(
      allInputReviews.filter(r => r.id).map(r => [r.id!, r])
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
    throw new Error('Failed to parse unified insights JSON')
  }
}

// ─── Main Insights Runner ─────────────────────────────────────────────────────

/**
 * Generates rich, structured insights for a team or location based on reviews.
 */
export async function insightsRun(input: InsightsInput): Promise<StandardReportData | AnnualReportData> {
  const scope = input.scope || (input.locationName ? 'location' : 'team')
  const periodWindow: PeriodWindow = (input.periodWindow === 'unified' ? '6m' : input.periodWindow) || '6m'
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

// ─── Competitive Analysis ────────────────────────────────────────────────────

export interface CompetitiveResult {
  // Hero metrics
  competitivePositionScore: number // 0-100: where you stand in the local market
  marketMomentum: number // -10 to +10: are you gaining or losing ground?

  // Executive summary
  executiveSummary: string
  ownedAverageRating: number
  competitorAverageRating: number
  ownedReviewCount: number
  competitorReviewCount: number
  ratingGap: number // owned - competitor avg (positive = you're ahead)

  // Top action
  topActionItem: { title: string; description: string }

  // Head-to-head breakdown per competitor
  headToHead: Array<{
    competitorName: string
    yourRating: number
    theirRating: number
    yourVolume: number
    theirVolume: number
    youWinOn: string[] // themes where you outperform
    theyWinOn: string[] // themes where they outperform
    verdict: string // one-line summary
  }>

  // Thematic gap analysis
  thematicGaps: Array<{
    theme: string
    yourSentiment: 'positive' | 'negative' | 'mixed' | 'absent'
    competitorSentiment: 'positive' | 'negative' | 'mixed' | 'absent'
    description: string
    gapType: 'advantage' | 'disadvantage' | 'opportunity' | 'threat'
  }>

  // Competitive strengths & weaknesses (structured)
  competitiveStrengths: Array<{
    theme: string
    description: string
    mentionCount: number
    exampleQuote?: string
  }>
  competitiveWeaknesses: Array<{
    theme: string
    description: string
    mentionCount: number
    severity: 'low' | 'medium' | 'high'
    exampleQuote?: string
  }>

  // Threat alerts
  threatAlerts: Array<{
    title: string
    description: string
    urgency: 'low' | 'medium' | 'high'
  }>

  // Opportunities
  opportunities: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
  }>

  // Recommendations
  recommendations: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
    category: 'service' | 'staff' | 'operations' | 'marketing' | 'product'
  }>

  // Competitor intel: what their customers love (learn from them)
  stealWorthy: Array<{
    competitorName: string
    theme: string
    quote: string
    takeaway: string
  }>

  // Review response comparison
  responseComparison: {
    yourResponseRate: number // 0-100
    competitorAvgResponseRate: number // 0-100
    analysis: string
  }

  // Customer sentiment comparison
  sentimentComparison: {
    yourSentiment: number // 0-100
    competitorSentiment: number // 0-100
    analysis: string
  }

  // Delta comparison (present when previousMetrics was provided)
  deltaComparison?: {
    scoreChange: number
    momentumChange: number
    ratingGapChange: number
    newThreats: string[]
    resolvedThreats: string[]
    improvedThemes: string[]
    declinedThemes: string[]
    summary: string
  }
}

function computeBusinessStats(reviews: Array<{ rating: number; comment: string | null; date: string; owner_response?: boolean }>) {
  if (reviews.length === 0) return { avg: 0, count: 0, dist: '', firstHalfAvg: 'N/A', secondHalfAvg: 'N/A', withComments: 0, responseRate: '0' }

  const ratings = reviews.map(r => r.rating)
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
  const dist = [5, 4, 3, 2, 1].map(r => `${r}★:${ratings.filter(x => x === r).length}`).join(' ')

  const sorted = [...reviews].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const mid = Math.floor(sorted.length / 2)
  const first = sorted.slice(0, mid)
  const second = sorted.slice(mid)
  const firstHalfAvg = first.length > 0 ? (first.reduce((s, r) => s + r.rating, 0) / first.length).toFixed(2) : 'N/A'
  const secondHalfAvg = second.length > 0 ? (second.reduce((s, r) => s + r.rating, 0) / second.length).toFixed(2) : 'N/A'

  const withComments = reviews.filter(r => r.comment && r.comment.trim().length > 0).length
  const responded = reviews.filter(r => r.owner_response).length
  const responseRate = ((responded / reviews.length) * 100).toFixed(0)

  return { avg, count: reviews.length, dist, firstHalfAvg, secondHalfAvg, withComments, responseRate }
}

function formatReviewsBlock(name: string, reviews: Array<{ rating: number; comment: string | null; date: string; reviewer_name?: string | null }>, limit: number): string {
  let block = ''
  const withComments = reviews.filter(r => r.comment && r.comment.trim().length > 0)
  const ratingOnly = reviews.filter(r => !r.comment || r.comment.trim().length === 0)

  // Prioritize reviews with comments, then pad with rating-only
  const selected = [...withComments.slice(0, limit)]
  if (selected.length < limit) {
    selected.push(...ratingOnly.slice(0, limit - selected.length))
  }

  selected.forEach((r, i) => {
    const dateStr = new Date(r.date).toISOString().split('T')[0]
    const nameTag = r.reviewer_name ? ` by ${r.reviewer_name}` : ''
    block += `  ${i + 1}. [${r.rating}/5] [${dateStr}]${nameTag} ${r.comment || '(No comment)'}\n`
  })

  if (reviews.length > limit) {
    block += `  ... and ${reviews.length - limit} more reviews\n`
  }

  return block
}

// ─── Unified Competitive Analysis (Single Report) ────────────────────────────

export interface CompetitivePulse {
  headline: string
  yourHighlights: string[]
  competitorHighlights: string[]
  immediateAction: { title: string; description: string }
  narrative: string
}

export interface CompetitiveTrends {
  momentumSummary: string
  emergingThemes: Array<{ theme: string; direction: 'emerging' | 'fading' | 'accelerating'; description: string }>
  gapMovement: Array<{ theme: string; movement: 'widening' | 'closing' | 'stable'; description: string }>
  narrative: string
  recommendations: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high' }>
}

export interface CompetitiveMarketPosition {
  positionNarrative: string
  enduringStrengths: string[]
  enduringWeaknesses: string[]
  structuralAdvantages: string[]
  structuralDisadvantages: string[]
  strategicRecommendations: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; effort: 'low' | 'medium' | 'high' }>
}

export interface UnifiedCompetitiveResult extends CompetitiveResult {
  periodStart: string
  periodEnd: string
  pulse: CompetitivePulse
  trends: CompetitiveTrends
  marketPosition: CompetitiveMarketPosition
}

export interface UnifiedCompetitiveInput {
  ownedLocations: Array<{
    name: string
    reviews: Array<{ rating: number; comment: string | null; date: string; reviewer_name?: string | null; owner_response?: boolean }>
  }>
  competitors: Array<{
    name: string
    reviews: Array<{ rating: number; comment: string | null; date: string; reviewer_name?: string | null; owner_response?: boolean }>
  }>
  periodStart: string
  periodEnd: string
  previousMetrics?: {
    competitivePositionScore: number
    marketMomentum: number
    ownedAverageRating: number
    competitorAverageRating: number
    threatAlerts: string[]
    topStrengths: string[]
    topWeaknesses: string[]
  }
}

const UNIFIED_COMPETITIVE_SYSTEM_PROMPT = `You are a competitive intelligence analyst delivering a multi-horizon competitive report. You analyze the competitive landscape across three time horizons: a 14-day tactical pulse, 90-day trend analysis, and 6-month market position assessment.

You receive reviews pre-sliced into three time horizons per business:
- PULSE REVIEWS (last 14 days): Drive the "pulse" section. What is happening RIGHT NOW?
- TREND REVIEWS (last 90 days, includes pulse): Drive the "trends" section. What patterns are forming?
- ALL REVIEWS (full 6 months): Drive the "marketPosition" section and all structural analysis fields.

Pulse reviews are a subset of trend reviews, which are a subset of all reviews. Each section should primarily analyze its designated slice but can reference other horizons for context.

Every claim must be grounded in actual review data. Never use em dashes. Write in a confident, direct tone.`

function buildUnifiedCompetitivePrompt(input: UnifiedCompetitiveInput): string {
  const now = new Date(input.periodEnd)
  const pulseStart = new Date(now)
  pulseStart.setDate(pulseStart.getDate() - 14)
  const trendStart = new Date(now)
  trendStart.setDate(trendStart.getDate() - 90)
  const periodStart = new Date(input.periodStart)

  const pulseStartStr = pulseStart.toISOString().split('T')[0]
  const trendStartStr = trendStart.toISOString().split('T')[0]

  type ReviewType = typeof input.ownedLocations[0]['reviews'][number]

  function sliceReviews(reviews: ReviewType[]) {
    const pulse: ReviewType[] = []
    const trend: ReviewType[] = []  // 15-90 days (excludes pulse)
    const market: ReviewType[] = [] // 91+ days (excludes trend)

    for (const r of reviews) {
      const d = new Date(r.date)
      if (d >= pulseStart && d <= now) {
        pulse.push(r)
      } else if (d >= trendStart && d < pulseStart) {
        trend.push(r)
      } else if (d >= periodStart) {
        market.push(r)
      }
    }

    return { pulse, trend, market }
  }

  let prompt = `ANALYSIS FOCUS:
This report covers three time horizons. Each section should primarily analyze its designated reviews.

PULSE (last 14 days, ${pulseStartStr} to ${input.periodEnd}):
- What is happening RIGHT NOW in the competitive landscape?
- Who had a great/bad week? What changed?
- immediateAction should be doable THIS WEEK.

TRENDS (last 90 days, ${trendStartStr} to ${input.periodEnd}):
- What patterns are forming? Are gaps widening or closing?
- Identify themes that are emerging, fading, or accelerating.
- recommendations should show results in 30-60 days.

MARKET POSITION (full 6 months, ${input.periodStart} to ${input.periodEnd}):
- Structural competitive positioning over the long term.
- What are the enduring dynamics? What has shifted?
- strategicRecommendations should be investments for next quarter.

Pulse reviews are a subset of trend reviews. Trend reviews are a subset of all reviews. Each section should focus on its slice but can reference other horizons for context (e.g., "this complaint appeared in pulse reviews but has been a theme for 6 months").

`

  prompt += `─── COMPETITIVE DATA ───\n`
  prompt += `Report Period: ${input.periodStart} to ${input.periodEnd} (6 months)\n`
  prompt += `Pulse Window: ${pulseStartStr} to ${input.periodEnd} (14 days)\n`
  prompt += `Trend Window: ${trendStartStr} to ${input.periodEnd} (90 days)\n\n`

  // Per-business review limits
  const totalBusinesses = input.ownedLocations.length + input.competitors.length
  const pulseLimit = Math.min(30, Math.floor(90 / totalBusinesses))
  const trendLimit = Math.min(40, Math.floor(120 / totalBusinesses))
  const marketLimit = Math.min(30, Math.floor(90 / totalBusinesses))

  function renderBusiness(name: string, reviews: ReviewType[]) {
    const { pulse, trend, market } = sliceReviews(reviews)

    const pulseStats = computeBusinessStats(pulse)
    const trendStats = computeBusinessStats([...pulse, ...trend])
    const allStats = computeBusinessStats(reviews)

    prompt += `\n▸ ${name}\n`
    prompt += `  PULSE Stats (last 14 days):\n`
    prompt += `    Reviews: ${pulseStats.count} | Avg: ${pulseStats.count > 0 ? pulseStats.avg.toFixed(2) : 'N/A'} | Distribution: ${pulseStats.dist || 'N/A'}\n`
    prompt += `    Reviews with comments: ${pulseStats.withComments} | Response rate: ${pulseStats.responseRate}%\n`
    prompt += `  TREND Stats (last 90 days):\n`
    prompt += `    Reviews: ${trendStats.count} | Avg: ${trendStats.count > 0 ? trendStats.avg.toFixed(2) : 'N/A'} | Distribution: ${trendStats.dist || 'N/A'}\n`
    prompt += `    First-half avg: ${trendStats.firstHalfAvg} | Second-half avg: ${trendStats.secondHalfAvg}\n`
    prompt += `    Reviews with comments: ${trendStats.withComments} | Response rate: ${trendStats.responseRate}%\n`
    prompt += `  ALL Stats (full 6 months):\n`
    prompt += `    Reviews: ${allStats.count} | Avg: ${allStats.count > 0 ? allStats.avg.toFixed(2) : 'N/A'} | Distribution: ${allStats.dist || 'N/A'}\n`
    prompt += `    Reviews with comments: ${allStats.withComments} | Response rate: ${allStats.responseRate}%\n`

    if (pulse.length > 0) {
      prompt += `  PULSE REVIEWS (last 14 days):\n`
      prompt += formatReviewsBlock(name, pulse, pulseLimit)
    }
    if (trend.length > 0) {
      prompt += `  TREND REVIEWS (0-90 days ago, excludes pulse reviews listed above):\n`
      prompt += formatReviewsBlock(name, trend, trendLimit)
    }
    if (market.length > 0) {
      prompt += `  MARKET POSITION REVIEWS (91+ days ago):\n`
      prompt += formatReviewsBlock(name, market, marketLimit)
    }
  }

  // Owned locations
  prompt += `═══ YOUR LOCATIONS ═══\n`
  input.ownedLocations.forEach(loc => renderBusiness(loc.name, loc.reviews))

  // Competitors
  prompt += `\n═══ COMPETITORS ═══\n`
  input.competitors.forEach(comp => renderBusiness(comp.name, comp.reviews))

  // Previous run metrics
  if (input.previousMetrics) {
    const pm = input.previousMetrics
    prompt += `\n═══ PREVIOUS REPORT METRICS (for delta comparison) ═══\n`
    prompt += `Competitive Position Score: ${pm.competitivePositionScore}/100\n`
    prompt += `Market Momentum: ${pm.marketMomentum}\n`
    prompt += `Your Average Rating: ${pm.ownedAverageRating}\n`
    prompt += `Competitor Average Rating: ${pm.competitorAverageRating}\n`
    prompt += `Active Threats: ${pm.threatAlerts.length > 0 ? pm.threatAlerts.join(', ') : 'None'}\n`
    prompt += `Key Strengths: ${pm.topStrengths.join(', ')}\n`
    prompt += `Key Weaknesses: ${pm.topWeaknesses.join(', ')}\n\n`
  }

  prompt += `\n─── OUTPUT ───\n`
  prompt += `Return a JSON object with this EXACT structure:
{
  "competitivePositionScore": <number 0-100, where 50 = on par, 80+ = market leader, below 30 = significantly behind>,
  "marketMomentum": <number -10 to +10, based on whether you are gaining or losing ground vs competitors>,
  "executiveSummary": "<2-4 sentence competitive positioning summary spanning all horizons>",
  "ownedAverageRating": <float, from full 6 months>,
  "competitorAverageRating": <float, from full 6 months>,
  "ownedReviewCount": <int, from full 6 months>,
  "competitorReviewCount": <int, from full 6 months>,
  "ratingGap": <float, owned avg minus competitor avg>,
  "topActionItem": { "title": "...", "description": "..." },

  "pulse": {
    "headline": "<one punchy sentence: what happened in the last 14 days>",
    "yourHighlights": ["2-4 bullet points: notable things from YOUR recent reviews"],
    "competitorHighlights": ["2-4 bullet points: notable things from COMPETITOR recent reviews"],
    "immediateAction": { "title": "...", "description": "<specific action for this week>" },
    "narrative": "<2-3 paragraphs analyzing the last 14 days. Focus ONLY on PULSE REVIEWS. Who had a good/bad stretch? What customers are saying right now.>"
  },

  "trends": {
    "momentumSummary": "<1-2 sentences: who is gaining/losing ground over the last 90 days>",
    "emergingThemes": [{ "theme": "...", "direction": "emerging|fading|accelerating", "description": "..." }],
    "gapMovement": [{ "theme": "...", "movement": "widening|closing|stable", "description": "..." }],
    "narrative": "<2-3 paragraphs analyzing the 90-day window. Focus on TREND REVIEWS. What patterns are forming? How does pulse activity fit into these trends?>",
    "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high" }]
  },

  "marketPosition": {
    "positionNarrative": "<2-3 paragraphs: the full 6-month competitive story. Structural dynamics, trajectory, where this market is heading.>",
    "enduringStrengths": ["2-4 themes where you have consistently outperformed over 6 months"],
    "enduringWeaknesses": ["2-4 themes where competitors have consistently outperformed over 6 months"],
    "structuralAdvantages": ["1-3 advantages that are hard for competitors to replicate"],
    "structuralDisadvantages": ["1-3 disadvantages that are hard for you to overcome quickly"],
    "strategicRecommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high" }]
  },

  "headToHead": [
    {
      "competitorName": "...",
      "yourRating": <float>,
      "theirRating": <float>,
      "yourVolume": <int>,
      "theirVolume": <int>,
      "youWinOn": ["theme1", "theme2"],
      "theyWinOn": ["theme1", "theme2"],
      "verdict": "<one sentence: who is winning and why>"
    }
  ],

  "thematicGaps": [
    {
      "theme": "...",
      "yourSentiment": "positive|negative|mixed|absent",
      "competitorSentiment": "positive|negative|mixed|absent",
      "description": "...",
      "gapType": "advantage|disadvantage|opportunity|threat"
    }
  ],

  "competitiveStrengths": [{ "theme": "...", "description": "...", "mentionCount": <int>, "exampleQuote": "..." }],
  "competitiveWeaknesses": [{ "theme": "...", "description": "...", "mentionCount": <int>, "severity": "low|medium|high", "exampleQuote": "..." }],

  "threatAlerts": [{ "title": "...", "description": "...", "urgency": "low|medium|high" }],

  "opportunities": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high" }],

  "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high", "category": "service|staff|operations|marketing|product" }],

  "stealWorthy": [
    {
      "competitorName": "...",
      "theme": "...",
      "quote": "<actual quote from competitor's review>",
      "takeaway": "<what you can learn from this>"
    }
  ],

  "responseComparison": {
    "yourResponseRate": <int 0-100>,
    "competitorAvgResponseRate": <int 0-100>,
    "analysis": "..."
  },

  "sentimentComparison": {
    "yourSentiment": <int 0-100>,
    "competitorSentiment": <int 0-100>,
    "analysis": "..."
  },

  "periodStart": "${input.periodStart}",
  "periodEnd": "${input.periodEnd}"${input.previousMetrics ? `,

  "deltaComparison": {
    "scoreChange": <number>,
    "momentumChange": <number>,
    "ratingGapChange": <number>,
    "newThreats": ["..."],
    "resolvedThreats": ["..."],
    "improvedThemes": ["..."],
    "declinedThemes": ["..."],
    "summary": "2-3 sentences comparing to previous report"
  }` : ''}
}

VOLUME & CONFIDENCE RULES:
- Review volume is a trust multiplier. A 5.0 average from 5 reviews is far less reliable than a 4.6 from 200 reviews. More reviews = higher confidence in the score. Fewer reviews = more skepticism.
- For ANY business (yours or competitor) with fewer than 10 reviews in the pulse window: the pulse section should be brief and acknowledge limited data. Do not claim trends from a handful of reviews.
- For ANY business with fewer than 10 reviews in the trend window: flag trend analysis as low-confidence. Use hedging language.
- When a competitor has significantly more reviews than you (or vice versa), call this out explicitly. Review velocity itself is a competitive signal.

SCORING RULES:
- competitivePositionScore: 0-100 relative to the competitors. 50 = dead even. 75+ = clearly ahead. Below 30 = significantly behind. IMPORTANT: Factor in BOTH rating quality AND review volume. High average + few reviews should score lower than slightly lower average + many more reviews.
- marketMomentum: compare pulse window performance vs the broader trend. Positive = you're gaining ground. Only claim momentum shifts when supported by enough data (5+ reviews minimum).
- headToHead: one entry per competitor, using FULL 6-month data. youWinOn/theyWinOn should be specific themes from actual reviews, not generic labels.
- thematicGaps: 3-6 items from full 6-month data. Focus on themes with meaningful sentiment differences.
- competitiveStrengths: 3-5 areas where YOUR reviews outshine competitors. Each MUST include an exampleQuote.
- competitiveWeaknesses: 2-4 areas where competitors outperform you. Each MUST include an exampleQuote.
- threatAlerts: 0-3 items. Only genuine competitive threats. Do not fabricate.
- opportunities: 2-4 items. Things competitors get criticized for that you could exploit.
- recommendations: 3-5 items. Sorted by impact. Quick wins first. Grounded in the data.
- stealWorthy: 2-4 items. Actual quotes from competitor reviews revealing what their customers love.
- responseComparison: compare response activity. If data isn't available, estimate 0.
- sentimentComparison: overall sentiment (0=terrible, 100=excellent) for each side.${input.previousMetrics ? `
- deltaComparison: Compare current metrics against previous report. Identify new/resolved threats, improved/declined themes.` : ''}
- Every field must be grounded in actual review data. No generic advice. No filler.
- Do NOT use em dashes. Use commas, periods, or semicolons instead.
`

  return prompt
}

export async function unifiedCompetitiveRun(input: UnifiedCompetitiveInput): Promise<UnifiedCompetitiveResult> {
  const prompt = buildUnifiedCompetitivePrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: UNIFIED_COMPETITIVE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 24000,
    response_format: { type: 'json_object' },
  })

  const analysisText = completion.choices[0]?.message?.content?.trim()

  if (!analysisText) {
    throw new Error('Failed to generate unified competitive analysis')
  }

  try {
    return JSON.parse(analysisText)
  } catch (error) {
    throw new Error('Failed to parse unified competitive analysis JSON')
  }
}
