# Insights Reports Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign AI reports to generate a single user-chosen period with previous-period comparison, a distinct annual report format, and rewritten prompts for plain language and confidence-calibrated output.

**Architecture:** Single-period generation with variable credit cost. API fetches 2x the window (except 1y) to enable previous-period comparison. Two distinct output schemas: standard (30d/90d/6m) and annual (1y). Prompts rewritten for direct voice and confidence scaling by review count.

**Tech Stack:** Next.js 14 App Router, TypeScript, OpenAI (gpt-5-mini), Supabase, Tailwind CSS, Recharts

---

### Task 1: Update API Route - Single Period Generation with Variable Credits

**Files:**
- Modify: `app/api/teams/[teamId]/insights/run/route.ts`
- Modify: `lib/validation/schemas.ts`

**Step 1: Update validation schema**

In `lib/validation/schemas.ts`, change `runInsightsSchema` to accept a required `period_window`:

```typescript
export const runInsightsSchema = z.object({
  period_window: z.enum(['30d', '90d', '6m', '1y']),
})
```

**Step 2: Rewrite the POST handler**

Replace the POST handler in `app/api/teams/[teamId]/insights/run/route.ts`. Key changes:
- Parse `period_window` from request body using `runInsightsSchema`
- Credit cost map: `{ '30d': 3, '90d': 4, '6m': 7, '1y': 10 }`
- Fetch 2x the window for 30d/90d/6m (e.g., 60 days for 30d). For 1y, fetch only 1 year.
- Split fetched reviews into `currentReviews` and `previousReviews` arrays
- Call `insightsRun()` once with both review sets
- Insert 1 row into `insights` table (not 4)
- Return the single inserted insight

The date math for each period:

```typescript
const CREDIT_COST: Record<string, number> = { '30d': 3, '90d': 4, '6m': 7, '1y': 10 }

// For data fetching (2x window except 1y):
const FETCH_WINDOWS: Record<string, { current: number; previous: number; unit: 'days' | 'months' | 'years' }> = {
  '30d': { current: 30, previous: 30, unit: 'days' },
  '90d': { current: 90, previous: 90, unit: 'days' },
  '6m': { current: 6, previous: 6, unit: 'months' },
  '1y': { current: 12, previous: 0, unit: 'months' },  // no previous for annual
}
```

For each period, compute `currentStart`, `currentEnd` (today), `previousStart`, `previousEnd` (= currentStart). Filter reviews in memory into current vs previous arrays.

Pass both arrays to `insightsRun()`:

```typescript
const insightsData = await insightsRun({
  reviews: currentReviews,
  previousReviews: periodWindow === '1y' ? undefined : previousReviews,
  periodStart: currentStartStr,
  periodEnd: currentEndStr,
  previousPeriodStart: previousStartStr,
  previousPeriodEnd: previousEndStr,
  scope: locationId ? 'location' : 'team',
  locationName: locationId ? loc.name : undefined,
  teamName: currentTeam?.name,
  periodWindow: periodWindow,
})
```

**Step 3: Keep the GET handler unchanged**

The GET handler for fetching reports already supports filtering by `period_window` and works fine as-is.

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```
feat: single-period report generation with variable credit costs
```

---

### Task 2: Rewrite OpenAI Prompts and Schemas

**Files:**
- Modify: `lib/openai/insights.ts`

This is the largest task. Rewrite the entire prompts file.

**Step 1: Update the `InsightsInput` interface**

Add previous-period review data:

```typescript
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
```

**Step 2: Define the two output interfaces**

Replace `GeneratedInsights` with two interfaces:

```typescript
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
  emergingTopics?: Array<{
    topic: string
    sentiment: 'positive' | 'negative' | 'mixed'
    description: string
    previousMentions: number
    currentMentions: number
  }>
  riskAlerts: Array<{
    title: string
    description: string
    urgency: 'low' | 'medium' | 'high'
  }>
  recommendations: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
    category: 'service' | 'staff' | 'operations' | 'marketing' | 'product'
  }>
  notableQuotes: Array<{
    quote: string
    rating: number
    sentiment: 'positive' | 'negative'
    theme: string
  }>
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
  monthlyTimeline: Array<{
    month: string
    avgRating: number
    reviewCount: number
    annotation: string | null
  }>
  highlights: Array<{
    title: string
    description: string
    quote: string | null
  }>
  lowlights: Array<{
    title: string
    description: string
    quote: string | null
  }>
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
  recommendations: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
    category: 'service' | 'staff' | 'operations' | 'marketing' | 'product'
  }>
  notableQuotes: Array<{
    quote: string
    rating: number
    sentiment: 'positive' | 'negative'
    theme: string
  }>
}
```

**Step 3: Rewrite system prompts**

Replace the `SYSTEM_PROMPTS` object. All prompts share a common voice directive appended at the end:

```
VOICE RULES:
- Write like a sharp friend who runs a business, not a consultant.
- Use "you" and "your." Short sentences. No filler. No jargon.
- If a stat is trivial relative to sample size, say so. Don't manufacture drama.
- Every sentence should make the owner feel smarter or prompt them to do something. If it doesn't, cut it.
- Never use em dashes. Use commas, periods, or semicolons instead.
```

System prompts by scope x period (simplified, direct tone):

**location/30d**: "You analyze the last 30 days of reviews for a single business location. Your job: what happened this month, what changed vs last month, and what should the owner do this week. Be specific and tactical."

**location/90d**: "You analyze the last 90 days of reviews for a single business location vs the previous 90 days. Your job: what patterns are forming, what's getting better or worse, and what should the owner prioritize this month."

**location/6m**: "You analyze the last 6 months of reviews for a single business location vs the previous 6 months. Your job: assess progress, identify what's improved or stagnated, and recommend strategic priorities for next quarter."

**location/1y**: "You deliver a year-in-review for a single business location. Tell the story of the year: the highs, the lows, the turning points. Be narrative and forward-looking."

**team/30d**: "You analyze the last 30 days of reviews across all locations for a business vs the previous 30 days. Spot cross-location patterns: which locations had a great month, which struggled, and what changed."

**team/90d**: "You analyze the last 90 days across all locations vs the previous 90 days. Identify which locations are outperforming, whether brand standards are consistent, and what operational patterns differ between high and low performers."

**team/6m**: "You deliver a 6-month portfolio review across all locations vs the previous 6 months. Assess overall brand health, whether investments are paying off, and which locations need more resources."

**team/1y**: "You deliver a year-in-review across all locations. Tell the story of the business's year: overall trajectory, standout locations, underperformers, and strategic priorities for next year."

Append the VOICE RULES block to each.

**Step 4: Rewrite the prompt builder**

Replace `buildInsightsPrompt` with two functions:

`buildStandardPrompt(input, scope, periodWindow)` for 30d/90d/6m:
- Include confidence calibration block based on current review count:
  - `< 10`: "SHORT REPORT. Summary, strengths, weaknesses, 2-3 recommendations max. No trend claims. Acknowledge limited data."
  - `10-50`: "STANDARD REPORT. All sections, but 1-2 sentences per description. Appropriate hedging on trends."
  - `50+`: "FULL REPORT. Rich analysis, more items per section, confident claims."
- Include period-specific focus (tactical/operational/strategic)
- Include scope-specific focus (location/team)
- Include pre-computed stats for BOTH current and previous period: avg rating, count, distribution, response rate
- Label reviews clearly:
  ```
  -- CURRENT PERIOD ({start} to {end}) --
  1. [ID:xxx] [5/5] [2026-03-08] by John "Great service..."
  ...

  -- PREVIOUS PERIOD ({prevStart} to {prevEnd}) --
  1. [ID:yyy] [4/5] [2026-01-15] by Jane "Good but slow..."
  ...
  ```
- Include the JSON schema for `StandardReportData`
- For 30d only: include `emergingTopics` in the schema and instruct AI to compare topics across both periods
- For 90d/6m: omit `emergingTopics` from schema
- Include the `{{REV}}` reference instructions (same as current)
- Instruct: "Compute the comparison block FIRST. This anchors the whole report. Every strength/weakness should note whether it's new, growing, shrinking, or persistent vs the previous period."

`buildAnnualPrompt(input, scope)` for 1y:
- Same confidence calibration
- No previous period data
- Pre-compute monthly stats from the reviews (group by month, calc avg/count per month)
- Include those monthly stats in the prompt so the AI has structured data to work with
- Include the JSON schema for `AnnualReportData`
- Instruct: "yearStory should be 2-3 paragraphs telling the arc of the year. monthlyTimeline annotations should only appear on months with notable shifts. highlights and lowlights should be the most significant moments."

**Step 5: Update `insightsRun()` function**

- Route to `buildStandardPrompt` or `buildAnnualPrompt` based on `periodWindow`
- Return type becomes `StandardReportData | AnnualReportData`
- Keep the `{{REV}}` post-processing logic (scanning for markers, building referencedReviews map)

**Step 6: Remove the `competitiveRun` changes** (out of scope, leave as-is)

**Step 7: Verify build**

Run: `npm run build`

**Step 8: Commit**

```
feat: rewrite insight prompts with comparison, confidence scaling, and annual format
```

---

### Task 3: Update Insights Page - Period Picker and Report Library

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add period picker state and modal**

Add state for the period picker:

```typescript
const [showPeriodPicker, setShowPeriodPicker] = useState(false)
```

Credit cost map (frontend):

```typescript
const REPORT_CREDITS: Record<string, number> = { '30d': 3, '90d': 4, '6m': 7, '1y': 10 }
const REPORT_LABELS: Record<string, string> = { '30d': 'Last 30 Days', '90d': 'Last 90 Days', '6m': 'Last 6 Months', '1y': 'Year in Review' }
```

**Step 2: Replace the Generate button with period picker flow**

Replace the single "Generate Report (3 credits)" button. New flow:

1. "Generate Report" button opens a dropdown/popover with 4 period options
2. Each option shows: period label + credit cost (e.g., "Last 30 Days - 3 credits")
3. Clicking an option triggers generation for that specific period

Implementation: a simple dropdown that appears below the button. Use a `div` with absolute positioning. Close on click outside.

```tsx
<div className="relative">
  <button
    onClick={() => setShowPeriodPicker(!showPeriodPicker)}
    disabled={generating}
    className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium text-sm flex items-center gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer"
  >
    {generating ? (
      <>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
        Generating...
      </>
    ) : (
      <>
        <SparklesIcon />
        Generate Report
      </>
    )}
  </button>
  {showPeriodPicker && !generating && (
    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-gray-200 shadow-xl z-10 overflow-hidden">
      {(['30d', '90d', '6m', '1y'] as const).map(pw => (
        <button
          key={pw}
          onClick={() => { setShowPeriodPicker(false); handleGenerateInsights(pw) }}
          className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors cursor-pointer flex items-center justify-between"
        >
          <span className="text-sm font-medium text-gray-900">{REPORT_LABELS[pw]}</span>
          <span className="text-xs text-gray-500">{REPORT_CREDITS[pw]} credits</span>
        </button>
      ))}
    </div>
  )}
</div>
```

**Step 3: Update `handleGenerateInsights` to accept period**

```typescript
const handleGenerateInsights = async (periodWindow: string) => {
  setGenerating(true)
  try {
    const locParam = effectiveLocationId ? `?location=${effectiveLocationId}` : ''
    await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, { period_window: periodWindow })
    setToast({ message: 'Report generated!', type: 'success' })
    // Refresh report library
    const allLocParam = effectiveLocationId ? `location=${effectiveLocationId}` : 'scope=all'
    const allRes = await apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?${allLocParam}`)
    setAllReports(allRes.insights || [])
  } catch (err: any) {
    setToast({ message: err.message || 'Failed to generate report', type: 'error' })
  } finally {
    setGenerating(false)
  }
}
```

**Step 4: Update report library list to show richer columns**

Replace the current report list item to show: date generated, period label, scope, generated by. The `insights` table has `generated_by_user_id` but we need the user name. For now, show date + period + scope. We can fetch user names later.

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
      report.period_window === '1y' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'
    }`}>
      {REPORT_LABELS[report.period_window || ''] || report.period_window}
    </span>
    <span className="text-sm font-medium text-gray-900">
      {report.period_start} — {report.period_end}
    </span>
  </div>
  <div className="flex items-center gap-3">
    {report.data?.overallSentiment != null && (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        report.data.overallSentiment >= 70 ? 'bg-green-50 text-green-700' :
        report.data.overallSentiment >= 40 ? 'bg-yellow-50 text-yellow-700' :
        'bg-red-50 text-red-700'
      }`}>
        {report.data.overallSentiment}/100
      </span>
    )}
    <span className="text-xs text-gray-400">
      {new Date(report.generated_at).toLocaleDateString()}
    </span>
    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  </div>
</div>
```

**Step 5: Update the "Generate First Report" empty state button**

The empty state CTA should also open the period picker, not call `handleGenerateInsights` directly.

**Step 6: Close period picker on click outside**

Add a `useEffect` with a click-outside handler, or wrap the dropdown in a container with an overlay.

**Step 7: Verify build**

Run: `npm run build`

**Step 8: Commit**

```
feat: period picker UI for report generation with variable credit costs
```

---

### Task 4: Update AIInsightsPanel - Comparison Block and Remove Cut Sections

**Files:**
- Modify: `components/AIInsightsPanel.tsx`

**Step 1: Add the Comparison Block section**

Add a new section at the very top of the panel (before the hero section) that renders when `d.comparison` exists:

```tsx
{d.comparison && (
  <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl border border-gray-200 p-6">
    <h4 className="text-sm font-bold text-gray-900 mb-4">vs Previous Period</h4>
    {/* Headline */}
    <p className="text-base font-semibold text-gray-800 mb-4">{d.comparison.headline}</p>
    {/* Key metrics row */}
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">{d.comparison.currentAvgRating?.toFixed(1)}</div>
        <div className="text-xs text-gray-500">Avg Rating</div>
        <div className={`text-xs font-medium mt-1 ${
          d.comparison.currentAvgRating > d.comparison.previousAvgRating ? 'text-green-600' :
          d.comparison.currentAvgRating < d.comparison.previousAvgRating ? 'text-red-600' : 'text-gray-500'
        }`}>
          was {d.comparison.previousAvgRating?.toFixed(1)}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">{d.comparison.currentReviewCount}</div>
        <div className="text-xs text-gray-500">Reviews</div>
        <div className={`text-xs font-medium mt-1 ${
          d.comparison.currentReviewCount > d.comparison.previousReviewCount ? 'text-green-600' :
          d.comparison.currentReviewCount < d.comparison.previousReviewCount ? 'text-red-600' : 'text-gray-500'
        }`}>
          was {d.comparison.previousReviewCount}
        </div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">{d.comparison.currentSentiment}</div>
        <div className="text-xs text-gray-500">Sentiment</div>
        <div className={`text-xs font-medium mt-1 ${
          d.comparison.currentSentiment > d.comparison.previousSentiment ? 'text-green-600' :
          d.comparison.currentSentiment < d.comparison.previousSentiment ? 'text-red-600' : 'text-gray-500'
        }`}>
          was {d.comparison.previousSentiment}
        </div>
      </div>
    </div>
    {/* Key deltas */}
    {d.comparison.keyDeltas?.length > 0 && (
      <div className="space-y-2">
        {d.comparison.keyDeltas.map((delta: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              delta.direction === 'up' ? 'bg-green-100 text-green-600' :
              delta.direction === 'down' ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-500'
            }`}>
              <svg className={`w-3 h-3 ${delta.direction === 'down' ? 'rotate-180' : delta.direction === 'flat' ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-sm text-gray-700"><strong>{delta.metric}:</strong> {delta.description}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

**Step 2: Update Emerging Topics to show mention counts**

Update the emerging topics section to show previous/current mention counts and derive the badge:

```tsx
// Badge logic
const getTopicBadge = (t: any) => {
  if (t.previousMentions === 0 && t.currentMentions >= 1) return { label: 'NEW', class: 'bg-purple-200 text-purple-800' }
  if (t.currentMentions > t.previousMentions) return { label: 'RISING', class: 'bg-green-200 text-green-800' }
  if (t.currentMentions < t.previousMentions) return { label: 'FADING', class: 'bg-red-200 text-red-800' }
  return { label: 'STEADY', class: 'bg-gray-200 text-gray-700' }
}
```

Replace the existing trend badge with:
```tsx
const badge = getTopicBadge(t)
<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${badge.class}`}>
  {badge.label}
</span>
```

Add mention counts below the description:
```tsx
{(t.previousMentions != null || t.currentMentions != null) && (
  <div className="text-[10px] text-gray-400 mt-1">
    {t.currentMentions} mentions now{t.previousMentions != null ? ` vs ${t.previousMentions} last period` : ''}
  </div>
)}
```

**Step 3: Remove Response Strategy and Customer Persona sections**

Delete the entire `{/* Response Strategy + Customer Persona */}` grid section (lines 581-662). Remove the `persona` and `responseStrategy` variable declarations near the top.

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```
feat: add comparison block, update emerging topics, remove persona and response strategy
```

---

### Task 5: Add Annual Report Panel

**Files:**
- Modify: `components/AIInsightsPanel.tsx`

**Step 1: Detect annual report and branch rendering**

At the top of `AIInsightsPanel`, detect if this is an annual report by checking for `d.yearInNumbers`:

```typescript
const isAnnualReport = !!d.yearInNumbers
```

If `isAnnualReport`, render the annual layout. Otherwise, render the existing standard layout.

Wrap existing content in `{!isAnnualReport && ( ... )}` and add `{isAnnualReport && ( <AnnualReportView ... /> )}`.

**Step 2: Build the Year in Numbers hero banner**

```tsx
{isAnnualReport && d.yearInNumbers && (
  <div className="space-y-8">
    {/* Year in Numbers - Hero Banner */}
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">Year in Numbers</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div className="text-4xl font-bold">{d.yearInNumbers.totalReviews}</div>
          <div className="text-sm text-slate-400 mt-1">Total Reviews</div>
        </div>
        <div>
          <div className="text-4xl font-bold">{d.yearInNumbers.averageRating?.toFixed(1)}</div>
          <div className="text-sm text-slate-400 mt-1">Avg Rating</div>
        </div>
        <div>
          <div className="text-4xl font-bold">{d.yearInNumbers.responseRate?.toFixed(0)}%</div>
          <div className="text-sm text-slate-400 mt-1">Response Rate</div>
        </div>
        <div>
          <div className="text-4xl font-bold">{d.yearInNumbers.fiveStarPercentage?.toFixed(0)}%</div>
          <div className="text-sm text-slate-400 mt-1">Five Star</div>
        </div>
      </div>
      {/* Best/Worst month */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-700">
        {d.yearInNumbers.bestMonth && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Best Month: {d.yearInNumbers.bestMonth.month}</div>
              <div className="text-xs text-slate-400">{d.yearInNumbers.bestMonth.avgRating?.toFixed(1)} avg, {d.yearInNumbers.bestMonth.reviewCount} reviews</div>
            </div>
          </div>
        )}
        {d.yearInNumbers.worstMonth && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Toughest Month: {d.yearInNumbers.worstMonth.month}</div>
              <div className="text-xs text-slate-400">{d.yearInNumbers.worstMonth.avgRating?.toFixed(1)} avg, {d.yearInNumbers.worstMonth.reviewCount} reviews</div>
            </div>
          </div>
        )}
      </div>
    </div>
```

**Step 3: Build the Year's Story section**

```tsx
    {/* The Year's Story */}
    {d.yearStory && (
      <div className="bg-white rounded-2xl border border-gray-100 p-8">
        <h4 className="text-lg font-bold text-gray-900 mb-4">The Year's Story</h4>
        <div className="text-gray-700 leading-relaxed text-[15px] whitespace-pre-line">{rt(d.yearStory)}</div>
      </div>
    )}
```

**Step 4: Build the Monthly Timeline chart**

Use Recharts `ComposedChart` with a bar for review count and a line for avg rating. Render annotations as tooltips or labels.

```tsx
    {/* Monthly Timeline */}
    {d.monthlyTimeline?.length > 0 && (
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h4 className="text-sm font-bold text-gray-900 mb-4">Monthly Timeline</h4>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={d.monthlyTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} tickFormatter={(m: string) => {
              const [y, mo] = m.split('-')
              return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short' })
            }} />
            <YAxis yAxisId="left" domain={[0, 'auto']} tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" domain={[1, 5]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar yAxisId="left" dataKey="reviewCount" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Reviews" />
            <Line yAxisId="right" dataKey="avgRating" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} name="Avg Rating" />
          </ComposedChart>
        </ResponsiveContainer>
        {/* Annotations */}
        {d.monthlyTimeline.filter((m: any) => m.annotation).length > 0 && (
          <div className="mt-4 space-y-2">
            {d.monthlyTimeline.filter((m: any) => m.annotation).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{m.month}</span>
                <span className="text-gray-600">{m.annotation}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
```

**Step 5: Build Highlights & Lowlights section**

```tsx
    {/* Highlights & Lowlights */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {d.highlights?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <h4 className="text-sm font-bold text-gray-900">Highlights</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {d.highlights.map((h: any, i: number) => (
              <div key={i} className="px-6 py-4">
                <span className="font-semibold text-sm text-gray-900">{h.title}</span>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">{rt(h.description)}</p>
                {h.quote && (
                  <div className="mt-2 pl-3 border-l-2 border-green-200">
                    <p className="text-xs text-gray-500 italic">{rt(h.quote)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {d.lowlights?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h4 className="text-sm font-bold text-gray-900">Lowlights</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {d.lowlights.map((l: any, i: number) => (
              <div key={i} className="px-6 py-4">
                <span className="font-semibold text-sm text-gray-900">{l.title}</span>
                <p className="text-sm text-gray-600 leading-relaxed mt-1">{rt(l.description)}</p>
                {l.quote && (
                  <div className="mt-2 pl-3 border-l-2 border-red-200">
                    <p className="text-xs text-gray-500 italic">{rt(l.quote)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
```

**Step 6: Reuse existing sections for annual report**

After highlights/lowlights, render the shared sections (keyStrengths, keyWeaknesses, recommendations, notableQuotes) using the same JSX as the standard report. Extract these into helper functions or render them in both branches.

The cleanest approach: extract the shared sections (strengths/weaknesses grid, recommendations, notable quotes, metadata footer) into small inline components or just duplicate the JSX in both branches. Given the component is already 673 lines, extracting is better:

Create helper render functions inside the component:
- `renderStrengthsWeaknesses()`
- `renderRecommendations()`
- `renderNotableQuotes()`
- `renderMetadata()`

Call them from both the standard and annual branches.

**Step 7: Add Recharts imports**

The `AIInsightsPanel` component doesn't currently import Recharts. Add at the top:

```typescript
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
```

**Step 8: Verify build**

Run: `npm run build`

**Step 9: Commit**

```
feat: add annual report panel with hero banner, timeline chart, and highlights
```

---

### Task 6: Final Integration and Build Verification

**Step 1: Verify the full flow end-to-end**

Run: `npm run build`

Fix any type errors or build failures.

**Step 2: Commit any fixes**

```
fix: resolve build errors from insights redesign
```

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `lib/validation/schemas.ts` | Modify | Add `period_window` to `runInsightsSchema` |
| `app/api/teams/[teamId]/insights/run/route.ts` | Modify | Single period, variable credits, 2x window fetch |
| `lib/openai/insights.ts` | Modify | New schemas, rewritten prompts, two prompt builders |
| `app/(app)/teams/[teamId]/insights/page.tsx` | Modify | Period picker dropdown, updated report library, updated generate flow |
| `components/AIInsightsPanel.tsx` | Modify | Comparison block, annual report layout, remove persona/strategy |
