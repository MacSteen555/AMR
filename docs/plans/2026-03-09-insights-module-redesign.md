# Insights Module Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the insights module with tabbed Insights/Reports layout, consolidated team-scoped API routes with `?location=` param, single-location auto-collapse, and new standard analytics features.

**Architecture:** Single route `/teams/[teamId]/insights` with two tabs. Team API routes accept an optional `?location=` query param to scope analytics and AI reports. Frontend detects single-location teams and auto-scopes. New standard insights (reply gap, velocity, keywords, etc.) computed server-side from `google_reviews`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Recharts, OpenAI (for reports)

---

### Task 1: Consolidate Team Insights Data API to Support `?location=` Param

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`

**Step 1: Add location query param support to GET handler**

The existing team data route fetches all locations. Add an optional `?location=` param that, when present, filters to a single location and returns location-scoped analytics (no `perLocation`, no `locationCount`).

```typescript
// In the GET handler, after requireTeamMember:
const locationId = searchParams.get('location')

// If locationId provided, verify it belongs to this team
if (locationId) {
  const { data: loc } = await supabase
    .schema('app')
    .from('locations')
    .select('id, name')
    .eq('id', locationId)
    .eq('team_id', params.teamId)
    .single()

  if (!loc) {
    return NextResponse.json({ error: 'Location not found in this team' }, { status: 404 })
  }

  // Fetch reviews for just this location
  const { data: reviews, error } = await supabase
    .schema('app')
    .from('google_reviews')
    .select('rating, comment, review_date, reply_status, replied_at')
    .eq('location_id', locationId)
    .gte('review_date', periodStart)
    .lte('review_date', periodEnd)
    .order('review_date', { ascending: true })

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`)

  const analytics = computeLocationAnalytics(reviews || [], periodStart, periodEnd)
  return NextResponse.json({ analytics })
}

// ... existing team-wide logic unchanged
```

**Step 2: Add `computeLocationAnalytics` function**

Copy the `computeAnalytics` function from the location data route into this file (rename to `computeLocationAnalytics`). This is the single-location variant that returns no `perLocation` or `locationCount`.

**Step 3: Verify the build compiles**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts
git commit -m "feat: add ?location= param support to team insights data API"
```

---

### Task 2: Consolidate Team Insights Run API to Support `?location=` Param

**Files:**
- Modify: `app/api/teams/[teamId]/insights/run/route.ts`

**Step 1: Add location param support to POST handler**

When `?location=` is provided in the POST body or query, generate location-scoped AI reports instead of team-wide ones. Store with `location_id` set and `team_id` null (matching the existing constraint).

```typescript
// In POST handler, after requireTeamMember:
const { searchParams: qp } = new URL(request.url)
const locationId = qp.get('location')

if (locationId) {
  // Verify location belongs to team
  const { data: loc } = await serviceClient
    .schema('app')
    .from('locations')
    .select('id, name, team_id')
    .eq('id', locationId)
    .eq('team_id', params.teamId)
    .single()

  if (!loc) {
    return NextResponse.json({ error: 'Location not found in this team' }, { status: 404 })
  }

  // Spend credits scoped to location
  await spendCredits(
    params.teamId, user.id, 'insight_run', 3,
    'location', locationId, idempotencyKey, { feature: 'insights' }
  )

  // Fetch reviews for this location only
  const { data: reviews } = await serviceClient
    .schema('app')
    .from('google_reviews')
    .select('id, rating, comment, review_date, reply_status, reviewer_name')
    .eq('location_id', locationId)
    .gte('review_date', absoluteStart)
    .lte('review_date', absoluteEnd)

  // Run insights with location scope
  const runs = periods.map(async (period) => {
    // ... same period logic
    const insightsData = await insightsRun({
      reviews: periodReviews,
      periodStart: periodStartStr,
      periodEnd: absoluteEnd,
      locationName: loc.name,
      scope: 'location',
      periodWindow: period.key as any,
    })
    return { period_window: period.key, period_start: periodStartStr, period_end: absoluteEnd, insightsData }
  })

  const results = await Promise.all(runs)
  const insertData = results.map(r => ({
    team_id: null,
    location_id: locationId,
    // ... rest same
  }))

  // Insert and return
}

// ... existing team-wide logic unchanged
```

**Step 2: Add location param support to GET handler**

When `?location=` is present, query insights by `location_id` instead of `team_id`. When absent and no `?scope=all`, query team-wide insights only (location_id IS NULL). When `?scope=all`, return all insights for the team (both team-wide and per-location).

```typescript
// In GET handler:
const locationId = searchParams.get('location')
const scope = searchParams.get('scope') // 'all' to get everything

let query = supabase
  .schema('app')
  .from('insights')
  .select('*')
  .order('generated_at', { ascending: false })

if (locationId) {
  query = query.eq('location_id', locationId)
} else if (scope === 'all') {
  // Get all insights for this team — need to get location_ids first
  const { data: locations } = await supabase
    .schema('app')
    .from('locations')
    .select('id')
    .eq('team_id', params.teamId)
  const locationIds = (locations || []).map(l => l.id)
  // Team-wide OR any of this team's locations
  query = query.or(`team_id.eq.${params.teamId},location_id.in.(${locationIds.join(',')})`)
} else {
  query = query.eq('team_id', params.teamId).is('location_id', null)
}

if (periodWindow) {
  query = query.eq('period_window', periodWindow)
}
```

**Step 3: Verify the build compiles**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/teams/[teamId]/insights/run/route.ts
git commit -m "feat: add ?location= param support to team insights run API"
```

---

### Task 3: Update Frontend to Use Consolidated API Routes

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Update `loadData` to always use team API path**

Replace the `entityPath` branching logic. Always call `/api/teams/${teamId}/insights/*` and pass `?location=` as a query param when set.

```typescript
const loadData = useCallback(async () => {
  setLoading(true)
  try {
    const locParam = locationId ? `&location=${locationId}` : ''
    const [analyticsRes, insightsRes] = await Promise.all([
      apiGet<any>(`/api/teams/${teamId}/insights/data?period_start=${start}&period_end=${end}${locParam}`),
      apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?period_window=${period}${locParam}`),
    ])
    setAnalytics(analyticsRes.analytics)
    setAiInsights(insightsRes.insights || [])
  } catch (err: any) {
    setToast({ message: err.message || 'Failed to load insights', type: 'error' })
  } finally {
    setLoading(false)
  }
}, [teamId, locationId, start, end, period])
```

**Step 2: Update `handleGenerateInsights` similarly**

```typescript
const handleGenerateInsights = async () => {
  setGenerating(true)
  try {
    const locParam = locationId ? `?location=${locationId}` : ''
    await apiPost(`/api/teams/${teamId}/insights/run${locParam}`, {})
    setToast({ message: 'AI insights generated!', type: 'success' })
    const qp = locationId ? `?period_window=${period}&location=${locationId}` : `?period_window=${period}`
    const insightsRes = await apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run${qp}`)
    setAiInsights(insightsRes.insights || [])
  } catch (err: any) {
    setToast({ message: err.message || 'Failed to generate insights', type: 'error' })
  } finally {
    setGenerating(false)
  }
}
```

**Step 3: Verify the build compiles**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: switch insights frontend to consolidated team API routes"
```

---

### Task 4: Add Single-Location Auto-Collapse

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add auto-collapse logic**

After fetching team data, detect single-location teams and automatically scope to that location.

```typescript
// Add state for locations
const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])

// Fetch locations on mount
useEffect(() => {
  apiGet<{ locations: Array<{ id: string; name: string }> }>(`/api/teams/${teamId}/locations`)
    .then(res => setLocations(res.locations || []))
}, [teamId])

// Auto-scope for single-location teams
const effectiveLocationId = useMemo(() => {
  if (locationId) return locationId
  if (locations.length === 1) return locations[0].id
  return null
}, [locationId, locations])

const isTeamView = !effectiveLocationId
```

Then use `effectiveLocationId` instead of `locationId` throughout the component for API calls and rendering logic.

**Step 2: Verify the build compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: auto-collapse insights to single location for 1-location teams"
```

---

### Task 5: Add Tabbed Layout (Insights + Reports)

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add tab state and tab bar UI**

```typescript
type InsightsTab = 'insights' | 'reports'
const [activeTab, setActiveTab] = useState<InsightsTab>('insights')
```

Add a tab bar below the header, above the content:

```tsx
{/* Tab Bar */}
<div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-8 w-fit">
  <button
    onClick={() => setActiveTab('insights')}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
      activeTab === 'insights'
        ? 'bg-white shadow text-gray-900'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    Insights
  </button>
  <button
    onClick={() => setActiveTab('reports')}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
      activeTab === 'reports'
        ? 'bg-white shadow text-gray-900'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    Reports
    {!insightsEnabled && (
      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">PRO</span>
    )}
  </button>
</div>
```

**Step 2: Wrap existing analytics content in tab conditional**

```tsx
{activeTab === 'insights' && (
  <>
    {/* KPI Cards, Charts, Location Breakdown — existing code */}
  </>
)}

{activeTab === 'reports' && (
  <ReportsTab
    teamId={teamId}
    locationId={effectiveLocationId}
    aiInsights={aiInsights}
    insightsEnabled={insightsEnabled}
    generating={generating}
    onGenerate={handleGenerateInsights}
    period={period}
    tier={tier}
  />
)}
```

**Step 3: Move AI insights section into a `ReportsTab` component**

Extract the existing AI insights section (the generate button, upsell banner, AIInsightsPanel, and past reports accordion) into a new `ReportsTab` component at the bottom of the same file. This becomes the starting point for the report library.

**Step 4: Add CTA on Insights tab to go to Reports**

At the bottom of the Insights tab content, add a card nudging users to generate a report:

```tsx
{/* Report CTA at bottom of insights tab */}
<div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-100 p-6 flex items-center justify-between">
  <div>
    <h3 className="text-base font-semibold text-gray-900">Want deeper analysis?</h3>
    <p className="text-sm text-gray-500 mt-1">Generate an AI-powered report with sentiment analysis, recommendations, and more.</p>
  </div>
  <button
    onClick={() => setActiveTab('reports')}
    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium shrink-0"
  >
    View Reports
  </button>
</div>
```

**Step 5: Verify the build compiles**

Run: `npm run build`

**Step 6: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add tabbed Insights/Reports layout to insights page"
```

---

### Task 6: Build Report Library List View

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx` (the `ReportsTab` component)

**Step 1: Fetch all reports for the report library**

Load all reports (not just the current period) when the Reports tab is active. Use `?scope=all` to get both team-wide and per-location reports.

```typescript
const [allReports, setAllReports] = useState<AIInsight[]>([])
const [reportFilter, setReportFilter] = useState<string>('all') // 'all' | '30d' | '90d' | '6m' | '1y'
const [selectedReport, setSelectedReport] = useState<AIInsight | null>(null)

useEffect(() => {
  if (activeTab === 'reports') {
    const locParam = effectiveLocationId ? `&location=${effectiveLocationId}` : '&scope=all'
    apiGet<{ insights: AIInsight[] }>(`/api/teams/${teamId}/insights/run?${locParam}`)
      .then(res => setAllReports(res.insights || []))
  }
}, [activeTab, teamId, effectiveLocationId])
```

**Step 2: Render report list**

Each row shows: scope badge, period window, date generated, sentiment score badge.

```tsx
{/* Report list */}
<div className="space-y-2">
  {filteredReports.map(report => (
    <button
      key={report.id}
      onClick={() => setSelectedReport(report)}
      className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-teal-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-medium">
            {report.period_window || 'custom'}
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
        </div>
      </div>
    </button>
  ))}
</div>
```

**Step 3: Add period filter buttons**

```tsx
<div className="flex gap-2 mb-4">
  {['all', '30d', '90d', '6m', '1y'].map(f => (
    <button
      key={f}
      onClick={() => setReportFilter(f)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md ${
        reportFilter === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {f === 'all' ? 'All' : f}
    </button>
  ))}
</div>
```

**Step 4: Add report detail view**

When a report is selected, show it with the existing `AIInsightsPanel` component with a back button.

```tsx
{selectedReport ? (
  <div>
    <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
      ← Back to reports
    </button>
    <AIInsightsPanel insight={selectedReport} />
  </div>
) : (
  // ... list view
)}
```

**Step 5: Verify the build compiles**

Run: `npm run build`

**Step 6: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add report library list view with filtering and detail view"
```

---

### Task 7: Add New Standard Insights — Reply Gap Analysis

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add reply gap computation to team analytics API**

In both `computeTeamAnalytics` and `computeLocationAnalytics`, add a `replyGap` field that lists unanswered reviews sorted by urgency (low ratings first, then oldest first).

```typescript
// Add to analytics computation
const unanswered = reviews.filter(r =>
  !['posted', 'synced_external', 'dismissed'].includes(r.reply_status) && r.rating <= 3
)

const replyGap = unanswered
  .map(r => ({
    reviewDate: r.review_date,
    rating: r.rating,
    comment: r.comment?.slice(0, 120) || null,
    daysSince: Math.floor((Date.now() - new Date(r.review_date).getTime()) / (1000 * 60 * 60 * 24)),
    locationId: r.location_id || null,
    locationName: r.location_id ? (locationMap?.get(r.location_id) || null) : null,
  }))
  .sort((a, b) => a.rating - b.rating || b.daysSince - a.daysSince)
  .slice(0, 20) // Top 20 most urgent
```

Also need to update the review query to include `id` and `comment` fields for this (already included for team route).

**Step 2: Add reply gap UI section to Insights tab**

After the charts grid, add a reply gap section:

```tsx
{analytics.replyGap?.length > 0 && (
  <div className="bg-white rounded-2xl border border-gray-100 mb-8 overflow-hidden">
    <div className="p-5 border-b border-gray-100">
      <h3 className="text-base font-semibold text-gray-900">Reply Gap</h3>
      <p className="text-xs text-gray-400">Unanswered negative reviews needing attention</p>
    </div>
    <div className="divide-y divide-gray-50">
      {analytics.replyGap.map((item, i) => (
        <div key={i} className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
              item.rating <= 1 ? 'bg-red-100 text-red-700' :
              item.rating === 2 ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {item.rating}★
            </span>
            <span className="text-sm text-gray-700 truncate">{item.comment || 'No comment'}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isTeamView && item.locationName && (
              <span className="text-xs text-gray-400">{item.locationName}</span>
            )}
            <span className={`text-xs font-medium ${item.daysSince > 7 ? 'text-red-600' : 'text-gray-500'}`}>
              {item.daysSince}d ago
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 3: Update TypeScript interface for analytics**

Add `replyGap` to the `TeamAnalytics` interface.

**Step 4: Verify the build compiles**

Run: `npm run build`

**Step 5: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add reply gap analysis to standard insights"
```

---

### Task 8: Add New Standard Insights — Review Velocity Heatmap

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add review velocity computation**

Compute a day-of-week × time-of-day heatmap from review timestamps.

```typescript
// Days: 0 (Sun) - 6 (Sat), Hours: 0-23
const velocityMap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

for (const r of reviews) {
  const d = new Date(r.review_date)
  velocityMap[d.getDay()][d.getHours()]++
}

const reviewVelocity = {
  heatmap: velocityMap,
  peakDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    velocityMap.reduce((maxI, row, i, arr) =>
      row.reduce((s, v) => s + v, 0) > arr[maxI].reduce((s, v) => s + v, 0) ? i : maxI, 0)
  ],
  peakHour: velocityMap
    .reduce((totals, row) => row.map((v, h) => totals[h] + v), Array(24).fill(0))
    .reduce((maxH, v, h, arr) => v > arr[maxH] ? h : maxH, 0),
}
```

**Step 2: Add heatmap UI**

A simple grid visualization showing day × hour intensity.

```tsx
{analytics.reviewVelocity && (
  <ChartCard title="Review Velocity" subtitle={`Peak: ${analytics.reviewVelocity.peakDay}s around ${analytics.reviewVelocity.peakHour}:00`}>
    <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-0.5 text-[10px]">
      <div /> {/* empty corner */}
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="text-center text-gray-400">{h % 6 === 0 ? `${h}` : ''}</div>
      ))}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, d) => (
        <>
          <div key={`label-${d}`} className="text-gray-500 pr-1 text-right">{day}</div>
          {analytics.reviewVelocity!.heatmap[d].map((count, h) => {
            const max = Math.max(...analytics.reviewVelocity!.heatmap.flat())
            const intensity = max > 0 ? count / max : 0
            return (
              <div
                key={`${d}-${h}`}
                className="aspect-square rounded-sm"
                style={{ backgroundColor: `rgba(13, 148, 136, ${Math.max(intensity, 0.05)})` }}
                title={`${day} ${h}:00 — ${count} reviews`}
              />
            )
          })}
        </>
      ))}
    </div>
  </ChartCard>
)}
```

**Step 3: Update TypeScript interfaces**

**Step 4: Verify the build compiles**

Run: `npm run build`

**Step 5: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add review velocity heatmap to standard insights"
```

---

### Task 9: Add New Standard Insights — Keyword Themes

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add lightweight keyword theme extraction**

Simple approach: tokenize review comments, count word/bigram frequency, filter stop words, group by sentiment.

```typescript
function extractKeywordThemes(reviews: ReviewRow[]): Array<{
  theme: string
  count: number
  avgRating: number
  trend: 'up' | 'down' | 'stable'
}> {
  const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'was', 'were', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
    'or', 'if', 'while', 'about', 'up', 'it', 'its', 'i', 'my', 'me',
    'we', 'our', 'you', 'your', 'they', 'their', 'them', 'he', 'she',
    'his', 'her', 'this', 'that', 'these', 'those', 'what', 'which', 'who',
    'whom', 'get', 'got', 'really', 'also', 'much', 'even', 'back', 'still',
    'well', 'way', 'like', 'one', 'two', 'three', 'go', 'going', 'went',
    'come', 'came', 'make', 'made', 'know', 'say', 'said', 'take', 'took',
    'see', 'saw', 'think', 'thought', 'give', 'gave', 'tell', 'told'])

  // Extract bigrams from comments
  const themeMap = new Map<string, { count: number; ratings: number[]; dates: Date[] }>()

  for (const r of reviews) {
    if (!r.comment) continue
    const words = r.comment.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    // Count bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      if (!themeMap.has(bigram)) themeMap.set(bigram, { count: 0, ratings: [], dates: [] })
      const entry = themeMap.get(bigram)!
      entry.count++
      entry.ratings.push(r.rating)
      entry.dates.push(new Date(r.review_date))
    }
  }

  // Filter to themes mentioned 3+ times, sort by count
  const midDate = new Date((new Date(periodStart).getTime() + new Date(periodEnd).getTime()) / 2)

  return [...themeMap.entries()]
    .filter(([, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([theme, v]) => {
      const avgRating = v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length
      const firstHalf = v.dates.filter(d => d < midDate).length
      const secondHalf = v.dates.filter(d => d >= midDate).length
      const trend = secondHalf > firstHalf * 1.3 ? 'up' as const :
                    secondHalf < firstHalf * 0.7 ? 'down' as const : 'stable' as const
      return { theme, count: v.count, avgRating: Math.round(avgRating * 10) / 10, trend }
    })
}
```

**Step 2: Add keyword themes UI**

A grid of theme chips showing count, avg rating, and trend indicator.

**Step 3: Update TypeScript interfaces**

**Step 4: Verify the build compiles**

Run: `npm run build`

**Step 5: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add keyword theme analysis to standard insights"
```

---

### Task 10: Add New Standard Insights — Sentiment Momentum + Anonymous Ratio

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Add sentiment momentum to analytics computation**

Compare first-half avg rating to second-half avg rating within the period.

```typescript
const midDate = new Date((new Date(periodStart).getTime() + new Date(periodEnd).getTime()) / 2)
const firstHalf = reviews.filter(r => new Date(r.review_date) < midDate)
const secondHalf = reviews.filter(r => new Date(r.review_date) >= midDate)

const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, r) => s + r.rating, 0) / firstHalf.length : null
const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, r) => s + r.rating, 0) / secondHalf.length : null

const sentimentMomentum = firstAvg !== null && secondAvg !== null
  ? Math.round((secondAvg - firstAvg) * 100) / 100
  : null
```

Add to KPIs response.

**Step 2: Add anonymous review ratio**

```typescript
const anonymousReviews = reviews.filter(r => !r.reviewer_name || r.reviewer_name === 'Anonymous')
const anonymousRatio = totalReviews > 0 ? Math.round((anonymousReviews.length / totalReviews) * 10000) / 100 : 0
const anonymousNegativeCount = anonymousReviews.filter(r => r.rating <= 2).length
```

Note: This requires adding `reviewer_name` to the review query select. Currently the team data route doesn't select it — add it.

**Step 3: Update KPI cards in UI**

Replace or augment existing KPI cards with momentum indicator and add anonymous ratio to the location-scoped view.

**Step 4: Verify the build compiles**

Run: `npm run build`

**Step 5: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: add sentiment momentum and anonymous review ratio"
```

---

### Task 11: Delete Deprecated Location Insights API Routes

**Files:**
- Delete: `app/api/locations/[locationId]/insights/data/route.ts`
- Delete: `app/api/locations/[locationId]/insights/run/route.ts`

**Step 1: Verify no remaining references to old location API paths**

Search the codebase for `/api/locations/` references in insights context to confirm nothing else uses these routes.

**Step 2: Delete the files**

```bash
rm app/api/locations/[locationId]/insights/data/route.ts
rm app/api/locations/[locationId]/insights/run/route.ts
```

If the `insights/` directory is now empty under locations, clean up empty dirs too.

**Step 3: Verify the build compiles**

Run: `npm run build`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated location insights API routes"
```

---

### Task 12: Final Integration Verification

**Step 1: Run full build**

Run: `npm run build`

Ensure no TypeScript errors, no lint errors.

**Step 2: Manual smoke test checklist**

- [ ] Navigate to insights with 2+ location team → see team-wide Insights tab
- [ ] Switch to a location via ScopeBar → see location-scoped Insights tab
- [ ] Single-location team → auto-scopes to that location
- [ ] Click Reports tab → see report library (empty or with past reports)
- [ ] Generate report (if credits available) → appears in list
- [ ] Click a report → see full detail view with AIInsightsPanel
- [ ] Reply gap section shows unanswered negative reviews
- [ ] Review velocity heatmap renders
- [ ] Keyword themes display with trend indicators
- [ ] Sentiment momentum shows in KPIs
- [ ] Free tier → sees upsell on Reports tab

**Step 3: Final commit if any fixes needed**
