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
  periodStart: string
  periodEnd: string
  locationName?: string | null
  teamName?: string | null
  scope?: InsightScope
  periodWindow?: PeriodWindow
}

export interface GeneratedInsights {
  // Hero metrics
  overallSentiment: number // 0-100 score
  momentumScore: number // -10 to +10 (negative = declining, positive = improving)

  // Executive summary
  executiveSummary: string
  ratingTrend: 'improving' | 'declining' | 'stable'
  ratingTrendDescription: string
  topActionItem: { title: string; description: string }

  // Strengths & Weaknesses with richer data
  keyStrengths: Array<{
    theme: string
    description: string
    mentionCount: number
    exampleQuote?: string
  }>
  keyWeaknesses: Array<{
    theme: string
    description: string
    mentionCount: number
    severity: 'low' | 'medium' | 'high'
    exampleQuote?: string
  }>

  // Topics with trend direction
  emergingTopics: Array<{
    topic: string
    sentiment: 'positive' | 'negative' | 'mixed'
    description: string
    trend: 'rising' | 'falling' | 'steady'
  }>

  // Risk alerts
  riskAlerts: Array<{
    title: string
    description: string
    urgency: 'low' | 'medium' | 'high'
  }>

  // Recommendations with categories
  recommendations: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
    category: 'service' | 'staff' | 'operations' | 'marketing' | 'product'
  }>

  // Response strategy
  responseStrategy: {
    tone: string
    priorities: string[]
    avoidTopics: string[]
  }

  // Customer persona (richer)
  customerPersona: {
    description: string
    demographics: string
    motivations: string[]
    painPoints: string[]
  }

  // Notable quotes with themes
  notableQuotes: Array<{
    quote: string
    rating: number
    sentiment: 'positive' | 'negative'
    theme: string
  }>
}

/**
 * Generates rich, structured insights for a team or location based on reviews.
 */
export async function insightsRun(input: InsightsInput): Promise<GeneratedInsights> {
  const scope = input.scope || (input.locationName ? 'location' : 'team')
  const periodWindow = input.periodWindow || '6m'
  const systemPrompt = buildSystemPrompt(scope, periodWindow)
  const prompt = buildInsightsPrompt(input, scope, periodWindow)

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
    const reviewsById = new Map(
      input.reviews.filter(r => r.id).map(r => [r.id!, r])
    )
    const jsonStr = JSON.stringify(parsed)
    const refPattern = /\{\{REV:([a-f0-9-]+)(?::[^}]+)?\}\}/g
    const referencedIds = new Set<string>()
    let match
    while ((match = refPattern.exec(jsonStr)) !== null) {
      referencedIds.add(match[1])
    }

    const referencedReviews: Record<string, { rating: number; comment: string | null; review_date: string; reviewer_name?: string | null }> = {}
    for (const id of referencedIds) {
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

// ─── System Prompts by Scope ────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<InsightScope, Record<PeriodWindow, string>> = {
  location: {
    '30d': `You are an on-the-ground operations consultant analyzing the last 30 days of reviews for a single business location. Your job is to surface what is happening RIGHT NOW: recent incidents, sudden shifts in customer experience, and urgent fires to put out. Think like a store manager's advisor who needs to give a morning briefing. Be tactical, specific, and time-sensitive. Every claim must reference actual patterns from the data. Never use em dashes. Write in a confident, direct tone.`,

    '90d': `You are an operations strategist analyzing the last 90 days of reviews for a single business location. Your job is to identify forming patterns: is service quality trending up or down? Are there recurring complaints that weren't there before? Have recent changes (staffing, menu, hours) had a measurable impact? Think like a regional manager reviewing quarterly performance. Be pattern-focused and specific. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,

    '6m': `You are a senior business consultant delivering a 6-month performance review for a single business location. Your job is to assess progress: what has improved, what has stagnated, and where the biggest opportunities lie for the next quarter. Compare early months vs recent months to identify trajectory. Think like an advisor presenting to the business owner at a strategy meeting. Be strategic and forward-looking. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,

    '1y': `You are an executive advisor delivering an annual review of a single business location. Your job is to tell the story of this location's year: the highs, the lows, the turning points, and the overall brand perception trajectory. Identify what defined the year, what the location should be most proud of, and the one or two things that would transform performance next year. Think like a $500/hour consultant presenting to ownership. Be narrative, strategic, and visionary. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,
  },
  team: {
    '30d': `You are a multi-location operations analyst reviewing the last 30 days across all locations for a business. Your job is to spot cross-location patterns: which locations are having a great month, which ones are struggling, and whether there are team-wide issues or location-specific problems. Think like a VP of Operations doing a weekly pulse check. Be comparative, tactical, and action-oriented. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,

    '90d': `You are a regional performance strategist analyzing 90 days of reviews across all locations for a business. Your job is to identify which locations are outperforming or underperforming, whether brand standards are consistent, and what operational patterns differ between high and low performers. Think like a franchise consultant doing a quarterly brand audit. Be comparative and identify both shared strengths and location-specific issues. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,

    '6m': `You are a senior multi-location strategist delivering a 6-month portfolio review. Your job is to assess the overall health of the business across all locations: is the brand perception growing or declining? Are investments in specific areas paying off? Which locations should receive more resources? Think like a COO presenting to the executive team. Be strategic, comparative, and resource-focused. Every claim must reference actual data. Never use em dashes. Write in a confident, direct tone.`,

    '1y': `You are an executive advisor delivering an annual portfolio review across all locations. Your job is to tell the story of the business's year: overall brand trajectory, standout locations, underperformers, and the strategic priorities for next year. Identify whether the multi-location strategy is working and what would have the highest ROI to change. Think like a board-level advisor. Be narrative, high-level, and visionary while staying grounded in the data. Never use em dashes. Write in a confident, direct tone.`,
  },
}

function buildSystemPrompt(scope: InsightScope, periodWindow: PeriodWindow): string {
  return SYSTEM_PROMPTS[scope][periodWindow]
}

// ─── Period-Specific Analysis Instructions ──────────────────────────────────

const PERIOD_FOCUS: Record<PeriodWindow, string> = {
  '30d': `ANALYSIS FOCUS (30-Day Window):
- Focus on RECENCY: what happened this month that matters right now?
- The topActionItem should be something that can be done THIS WEEK.
- Emerging topics should reflect things customers started mentioning in the last 2-4 weeks.
- Risk alerts should flag anything that needs immediate attention (e.g., a spike in 1-star reviews, a specific recurring complaint).
- Momentum score should reflect week-over-week trajectory, not long-term trends.
- Recommendations should be quick tactical fixes, not strategic initiatives.
- Response strategy should address the current mood of reviewers.`,

  '90d': `ANALYSIS FOCUS (90-Day Window):
- Focus on PATTERNS: what trends are forming over the last quarter?
- The topActionItem should address the most impactful pattern you see.
- Emerging topics should identify themes that are growing or shrinking in frequency.
- Compare the first 45 days to the last 45 days to detect shifts.
- Recommendations should be operational improvements that can show results in 30-60 days.
- Customer persona should reflect the type of customer who has been coming recently.
- Response strategy should address recurring themes in recent reviews.`,

  '6m': `ANALYSIS FOCUS (6-Month Window):
- Focus on PROGRESS: what has improved, what has stagnated, what has gotten worse?
- The topActionItem should be the highest-leverage change for the next quarter.
- Compare months 1-3 vs months 4-6 to assess trajectory.
- Emerging topics should identify seasonal patterns or shifts in customer expectations.
- Recommendations should be strategic investments (staff training, process changes, marketing campaigns).
- Risk alerts should flag systemic issues, not one-off incidents.
- Customer persona should capture the evolving customer base.`,

  '1y': `ANALYSIS FOCUS (1-Year Window):
- Focus on THE BIG PICTURE: what defined this year for the business?
- The topActionItem should be the single most transformative change for next year.
- Identify turning points: months where ratings shifted significantly and why.
- Strengths and weaknesses should reflect enduring patterns, not temporary spikes.
- Recommendations should be annual strategic priorities, not quick fixes.
- Customer persona should capture the core customer base and how it may have evolved.
- The executive summary should read like an annual report paragraph.
- Notable quotes should capture the range of the full year's experience.`,
}

// ─── Scope-Specific Analysis Instructions ───────────────────────────────────

const SCOPE_FOCUS: Record<InsightScope, string> = {
  location: `SCOPE FOCUS (Single Location):
- All insights should be specific to this one location's operations.
- Strengths and weaknesses should reference specific staff, services, or operational aspects unique to this location.
- Recommendations should be things this location's manager can directly act on.
- Customer persona should describe who visits THIS location specifically.
- Response strategy should match the tone and concerns of this location's reviewers.`,

  team: `SCOPE FOCUS (All Locations / Team-Wide):
- Insights should compare and contrast across locations when relevant.
- Identify which patterns are team-wide vs. location-specific.
- Strengths should highlight what the best-performing locations do differently.
- Weaknesses should flag whether issues are systemic (all locations) or isolated.
- Recommendations should distinguish between team-wide initiatives and location-specific actions.
- Customer persona should capture the overall brand's customer, noting if different locations attract different demographics.
- Risk alerts should flag locations that are dragging down the team average.`,
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildInsightsPrompt(input: InsightsInput, scope: InsightScope, periodWindow: PeriodWindow): string {
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

  // Count reviews with and without comments
  const withCommentCount = input.reviews.filter(r => r.comment && r.comment.trim().length > 0).length
  const noCommentCount = input.reviews.length - withCommentCount

  // Day-of-week distribution
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayCounts: Record<string, number> = {}
  for (const name of dayNames) dayCounts[name] = 0
  for (const review of input.reviews) {
    const day = dayNames[new Date(review.review_date).getDay()]
    dayCounts[day]++
  }
  const dayDistribution = dayNames.map(d => `${d}: ${dayCounts[d]}`).join(', ')

  const periodLabel = periodWindow === '30d' ? 'Last 30 Days' : periodWindow === '90d' ? 'Last 90 Days' : periodWindow === '6m' ? 'Last 6 Months' : 'Last Year'
  const scopeLabel = scope === 'location' ? 'Single Location Analysis' : 'Team-Wide Analysis (All Locations)'

  let prompt = `${PERIOD_FOCUS[periodWindow]}\n\n${SCOPE_FOCUS[scope]}\n\n`
  prompt += `─── DATA ───\n`
  prompt += `Report Type: ${scopeLabel} | ${periodLabel}\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd}\n`
  if (input.locationName) prompt += `Location: ${input.locationName}\n`
  if (input.teamName) prompt += `Team/Business: ${input.teamName}\n`
  prompt += `Total Reviews: ${input.reviews.length}\n`
  prompt += `Reviews with comments: ${withCommentCount} | Reviews without comments (rating only): ${noCommentCount}\n`
  prompt += `Average Rating: ${avgRating.toFixed(2)}\n`
  prompt += `Response Rate: ${responseRate}%\n`
  prompt += `First-half average: ${firstHalfAvg} | Second-half average: ${secondHalfAvg}\n`
  prompt += `Rating Distribution: ${ratingDistribution.map(d => `${d.rating}-star: ${d.count}`).join(', ')}\n`
  if (input.reviews.length >= 10) {
    prompt += `Day-of-week distribution: ${dayDistribution}\n`
  }
  prompt += `\n`

  prompt += `Reviews (up to 100):\n`
  input.reviews.slice(0, 100).forEach((review, idx) => {
    const date = new Date(review.review_date).toISOString().split('T')[0]
    const idTag = review.id ? ` [ID:${review.id}]` : ''
    const nameTag = review.reviewer_name ? ` by ${review.reviewer_name}` : ''
    prompt += `${idx + 1}.${idTag} [${review.rating}/5] [${date}]${nameTag} ${review.comment || '(No comment)'}\n`
  })

  prompt += `\nReturn a JSON object with this EXACT structure:
{
  "overallSentiment": <number 0-100>,
  "momentumScore": <number -10 to +10>,
  "executiveSummary": "...",
  "ratingTrend": "improving" | "declining" | "stable",
  "ratingTrendDescription": "...",
  "topActionItem": { "title": "...", "description": "..." },
  "keyStrengths": [{ "theme": "...", "description": "...", "mentionCount": N, "exampleQuote": "..." }],
  "keyWeaknesses": [{ "theme": "...", "description": "...", "mentionCount": N, "severity": "low|medium|high", "exampleQuote": "..." }],
  "emergingTopics": [{ "topic": "...", "sentiment": "positive|negative|mixed", "description": "...", "trend": "rising|falling|steady" }],
  "riskAlerts": [{ "title": "...", "description": "...", "urgency": "low|medium|high" }],
  "recommendations": [{ "title": "...", "description": "...", "impact": "low|medium|high", "effort": "low|medium|high", "category": "service|staff|operations|marketing|product" }],
  "responseStrategy": { "tone": "...", "priorities": ["..."], "avoidTopics": ["..."] },
  "customerPersona": { "description": "...", "demographics": "...", "motivations": ["..."], "painPoints": ["..."] },
  "notableQuotes": [{ "quote": "...", "rating": N, "sentiment": "positive|negative", "theme": "..." }]
}

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
- Recommendations, strategy advice, persona descriptions
- topActionItem, responseStrategy, customerPersona (strategic, not review-specific)

CRITICAL: Do NOT write a quote in plain text and THEN repeat it inside a {{REV}} marker. The display text should be a short attribution phrase like "one cafe owner" or "a returning customer", NOT the quote itself. The quote should appear once in the sentence as normal text.

Aim for 3-8 total references across ALL fields combined. Most paragraphs should have zero.

GOOD examples:
- "{{REV:abc-123:One cafe owner}} reported that automation cut their review response time in half."
- "The strongest complaint came from {{REV:ghi-789:a first-time visitor}} who waited 45 minutes for cold food."

BAD examples:
- 'one customer said "Great service" ({{REV:abc:Great service}})' — quote repeated twice
- "{{REV:abc:Reviewers}} praised {{REV:def:the service}} and {{REV:ghi:the food}}" — overlinked
- "Staff friendliness was highlighted {{REV:abc-123}}" — no display text

Rules:
- overallSentiment: 0-100 where 50 is neutral, 80+ is excellent, below 30 is crisis.
- momentumScore: -10 to +10 based on trajectory over this specific period. Compare first-half to second-half.
- topActionItem: match the urgency to the time window. 30d = do this week; 90d = do this month; 6m = do this quarter; 1y = do next year.
- keyStrengths: 3-5 items. Each MUST include an exampleQuote from the actual reviews.
- keyWeaknesses: 2-4 items. Each MUST include an exampleQuote. Severity correlates with frequency and impact.
- emergingTopics: 1-4 items. Trend indicates recent momentum of this topic.
- riskAlerts: 0-3 items. Only genuine business risks. Do not fabricate.
- recommendations: 3-5 items. Categories: service, staff, operations, marketing, product. Quick wins first.
- responseStrategy: specific to the current review climate. Actionable guidance for whoever replies to reviews.
- customerPersona: structured profile. Not generic.
- notableQuotes: 3-5 covering different themes. Mix of positive and negative.
- Every field must be grounded in the actual review data. No generic advice. No filler.
- Do NOT use em dashes. Use commas, periods, or semicolons instead.
`

  return prompt
}

// ─── Competitive Analysis ────────────────────────────────────────────────────

export interface CompetitiveInput {
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
  periodWindow: PeriodWindow
}

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
}

// ─── Competitive System Prompts ──────────────────────────────────────────────

const COMPETITIVE_SYSTEM_PROMPTS: Record<PeriodWindow, string> = {
  '30d': `You are a competitive intelligence analyst delivering a 30-day competitive pulse check. Your job is to surface what is happening RIGHT NOW in the local competitive landscape: who is gaining or losing ground, what customers are saying about each business this month, and where immediate action is needed. Think like a field strategist giving a weekly war-room briefing. Be tactical, specific, and urgent. Every claim must be grounded in the actual review data provided. Never use em dashes. Write in a confident, direct tone.`,

  '90d': `You are a competitive strategy analyst delivering a 90-day competitive trend report. Your job is to identify forming patterns across the competitive landscape: are gaps widening or closing? Which competitor is improving fastest? What themes are shifting in customer sentiment? Think like a market research director presenting quarterly competitive findings to the leadership team. Be pattern-focused, comparative, and data-driven. Every claim must be grounded in the actual review data provided. Never use em dashes. Write in a confident, direct tone.`,

  '6m': `You are a senior competitive strategist delivering a 6-month market position assessment. Your job is to evaluate how competitive positioning has evolved over the half-year: who has gained meaningful ground, what structural advantages or disadvantages have emerged, and where the biggest strategic opportunities lie for the next quarter. Compare early months vs recent months to detect trajectory shifts. Think like a management consultant presenting competitive intelligence to the executive team. Be strategic, evidence-based, and forward-looking. Every claim must be grounded in the actual review data provided. Never use em dashes. Write in a confident, direct tone.`,

  '1y': `You are an executive competitive intelligence advisor delivering an annual market landscape review. Your job is to tell the story of this competitive market over the past year: how have positions shifted, which businesses emerged as leaders or fell behind, what macro trends shaped customer expectations, and what defines the competitive strategy for next year. Think like a $500/hour strategy consultant presenting to the board. Be narrative, high-level, and visionary while staying grounded in actual review data. Every claim must be grounded in the actual review data provided. Never use em dashes. Write in a confident, direct tone.`,
}

const COMPETITIVE_PERIOD_FOCUS: Record<PeriodWindow, string> = {
  '30d': `ANALYSIS FOCUS (30-Day Competitive Pulse):
- Focus on WHAT'S HAPPENING NOW: which competitor is having a hot streak or a bad month?
- topActionItem should be something that can be acted on THIS WEEK to gain competitive ground.
- headToHead should reflect this month's performance, not historical reputation.
- threatAlerts should flag competitors making sudden improvements or your sudden dips.
- recommendations should be quick tactical moves: response strategy changes, service tweaks, marketing pivots.
- stealWorthy should highlight things competitors did well THIS MONTH that you can learn from immediately.`,

  '90d': `ANALYSIS FOCUS (90-Day Competitive Trends):
- Focus on FORMING PATTERNS: are competitive gaps widening or narrowing?
- Compare the first 45 days to the last 45 days for each business to detect trajectory.
- topActionItem should address the most impactful competitive trend.
- thematicGaps should identify themes where the gap is growing or shrinking.
- recommendations should be operational improvements that can show competitive results in 30-60 days.
- stealWorthy should highlight consistent competitor strengths worth studying.`,

  '6m': `ANALYSIS FOCUS (6-Month Market Position):
- Focus on STRUCTURAL SHIFTS: have competitive positions changed meaningfully?
- Compare months 1-3 vs months 4-6 for each business to assess trajectory.
- topActionItem should be the highest-leverage competitive move for next quarter.
- headToHead should capture whether each competitor is becoming a bigger or smaller threat.
- opportunities should focus on gaps that have persisted long enough to exploit.
- recommendations should be strategic investments: staff training, process changes, marketing campaigns.`,

  '1y': `ANALYSIS FOCUS (Annual Competitive Landscape):
- Focus on THE BIG PICTURE: how has the competitive landscape shifted over the year?
- Identify turning points: months where competitive dynamics changed and why.
- topActionItem should be the single most transformative competitive move for next year.
- thematicGaps should capture enduring structural advantages/disadvantages.
- recommendations should be annual strategic priorities, not quick fixes.
- executiveSummary should read like an annual competitive intelligence brief.`,
}

/**
 * Generates rich competitive analysis comparing owned locations and competitors.
 * Each call handles one timeframe; the API route runs 4 concurrently.
 */
export async function competitiveRun(input: CompetitiveInput): Promise<CompetitiveResult> {
  const systemPrompt = COMPETITIVE_SYSTEM_PROMPTS[input.periodWindow]
  const prompt = buildCompetitivePrompt(input)

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 16000,
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

// ─── Competitive Prompt Builder ──────────────────────────────────────────────

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

function buildCompetitivePrompt(input: CompetitiveInput): string {
  const periodLabel = input.periodWindow === '30d' ? 'Last 30 Days' : input.periodWindow === '90d' ? 'Last 90 Days' : input.periodWindow === '6m' ? 'Last 6 Months' : 'Last Year'

  let prompt = `${COMPETITIVE_PERIOD_FOCUS[input.periodWindow]}\n\n`
  prompt += `─── COMPETITIVE DATA ───\n`
  prompt += `Report: ${periodLabel} Competitive Analysis\n`
  prompt += `Period: ${input.periodStart} to ${input.periodEnd}\n\n`

  // Per-business reviews limit: split token budget across all businesses
  const totalBusinesses = input.ownedLocations.length + input.competitors.length
  const reviewsPerBusiness = Math.min(75, Math.floor(200 / totalBusinesses))

  // Owned locations with stats + reviews
  prompt += `═══ YOUR LOCATIONS ═══\n`
  input.ownedLocations.forEach(loc => {
    const stats = computeBusinessStats(loc.reviews)
    prompt += `\n▸ ${loc.name}\n`
    prompt += `  Reviews: ${stats.count} | Avg: ${stats.avg.toFixed(2)} | Distribution: ${stats.dist}\n`
    prompt += `  First-half avg: ${stats.firstHalfAvg} | Second-half avg: ${stats.secondHalfAvg}\n`
    prompt += `  Reviews with comments: ${stats.withComments} | Response rate: ${stats.responseRate}%\n`
    if (loc.reviews.length > 0) {
      prompt += `  Reviews:\n`
      prompt += formatReviewsBlock(loc.name, loc.reviews, reviewsPerBusiness)
    }
  })

  // Competitor locations with stats + reviews
  prompt += `\n═══ COMPETITORS ═══\n`
  input.competitors.forEach(comp => {
    const stats = computeBusinessStats(comp.reviews)
    prompt += `\n▸ ${comp.name}\n`
    prompt += `  Reviews: ${stats.count} | Avg: ${stats.avg.toFixed(2)} | Distribution: ${stats.dist}\n`
    prompt += `  First-half avg: ${stats.firstHalfAvg} | Second-half avg: ${stats.secondHalfAvg}\n`
    prompt += `  Reviews with comments: ${stats.withComments} | Response rate: ${stats.responseRate}%\n`
    if (comp.reviews.length > 0) {
      prompt += `  Reviews:\n`
      prompt += formatReviewsBlock(comp.name, comp.reviews, reviewsPerBusiness)
    }
  })

  prompt += `\n─── OUTPUT ───\n`
  prompt += `Return a JSON object with this EXACT structure:
{
  "competitivePositionScore": <number 0-100, where 50 = on par, 80+ = market leader, below 30 = significantly behind>,
  "marketMomentum": <number -10 to +10, based on whether you are gaining or losing ground vs competitors>,
  "executiveSummary": "<2-4 sentence competitive positioning summary>",
  "ownedAverageRating": <float>,
  "competitorAverageRating": <float>,
  "ownedReviewCount": <int>,
  "competitorReviewCount": <int>,
  "ratingGap": <float, owned avg minus competitor avg>,
  "topActionItem": { "title": "...", "description": "..." },

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
  }
}

Rules:
- competitivePositionScore: 0-100 relative to the competitors in this analysis. 50 = dead even. 75+ = clearly ahead. Below 30 = significantly behind.
- marketMomentum: compare first-half vs second-half performance across all businesses. Positive = you're gaining ground.
- headToHead: one entry per competitor. youWinOn/theyWinOn should be specific themes from actual reviews (e.g., "food quality", "wait times"), not generic labels.
- thematicGaps: 3-6 items. Focus on themes where there's a meaningful difference in customer sentiment between you and competitors. "absent" means the theme doesn't appear in that business's reviews.
- competitiveStrengths: 3-5 areas where YOUR reviews outshine competitor reviews. Each MUST include an exampleQuote from your actual reviews.
- competitiveWeaknesses: 2-4 areas where competitors outperform you. Each MUST include an exampleQuote from your reviews showing the problem.
- threatAlerts: 0-3 items. Only genuine competitive threats (competitor improving in your weak area, competitor gaining review velocity, etc). Do not fabricate.
- opportunities: 2-4 items. Things competitors get criticized for that you could exploit, or areas where no one is excelling.
- recommendations: 3-5 items. Sorted by impact. Quick wins first. Grounded in the competitive data.
- stealWorthy: 2-4 items. Actual quotes from competitor reviews that reveal what their customers love. Learn from the best.
- responseComparison: compare how actively each business responds to reviews. If response data isn't available, estimate 0.
- sentimentComparison: overall customer sentiment (0=terrible, 100=excellent) for each side, based on review content and ratings.
- Every field must be grounded in the actual review data. No generic advice. No filler. No hallucinating themes not present in the reviews.
- Do NOT use em dashes. Use commas, periods, or semicolons instead.
`

  return prompt
}

