# Insights Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Insights page with cleaner KPIs, previous-period comparison deltas, theme mentions from DB, and split AI Reports into a separate nav route. Restore concurrent report generation.

**Architecture:** The `/insights` page becomes a clean analytics dashboard with 5 metric cards (Total Reviews, Avg Rating, Response Rate, Avg Response Time, Themes), a single rating-over-time area chart, and a theme mentions section. AI Reports move to a new `/aireports` route with its own nav item. The data API gains previous-period comparison. The run API restores concurrent 4-period generation via `Promise.all`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Recharts, Supabase, Tailwind CSS

---

## Brand Color Reference

Use these exact values throughout. Do not invent colors.

| Token | Hex | Usage |
|-------|-----|-------|
| Teal 600 | `#0D9B8A` | Primary action, active tabs, links, chart lines, positive trend |
| Teal 500 | `#14B8A6` | Chart fills (with opacity), selected segment backgrounds |
| Teal 100 | `#CCFBF1` | Positive badges, area chart fill |
| Teal 50 | `#F0FDFA` | Hover states, subtle wash |
| Orange 500 | `#F97316` | Accent only — logo, primary CTA. Never data/charts |
| Orange 100 | `#FFEDD5` | Warning badge bg |
| Gray 900 | `#111827` | Primary text, large metric numbers |
| Gray 600 | `#4B5563` | Secondary text, card labels |
| Gray 400 | `#9CA3AF` | Tertiary text, chart axis labels |
| Gray 200 | `#E5E7EB` | Borders, dividers, chart grid lines |
| Gray 100 | `#F3F4F6` | Metric card backgrounds (flat, no border) |
| White | `#FFFFFF` | Raised card backgrounds |
| Green 600 / Green 50 | `#059669` / `#ECFDF5` | Positive deltas, success badges |
| Red 600 / Red 50 | `#DC2626` / `#FEF2F2` | Negative deltas, danger states |
| Amber 600 / Amber 50 | `#D97706` / `#FFFBEB` | Warning states |

**Chart rules:** Teal 500 only. 2px stroke + Teal 100 fill for area. Grid = Gray 200. Axis labels = Gray 400.
**Delta badges:** Green 600 on Green 50 for positive. Red 600 on Red 50 for negative. Always `+` or `-` prefix.
**Metric numbers:** Always Gray 900. Delta badge carries sentiment.

---

### Task 1: Remove console.log from ReviewsView

**Files:**
- Modify: `components/ReviewsView.tsx:582,587`

**Step 1: Remove the two console.log lines**

In `components/ReviewsView.tsx`, delete these two lines:
- Line 582: `console.log('Reviews data (team):', data)`
- Line 587: `console.log('Reviews data (location):', data)`

**Step 2: Verify build**

Run: `npm run build`
Expected: No errors related to ReviewsView

**Step 3: Commit**

```bash
git add components/ReviewsView.tsx
git commit -m "chore: remove debug console.log from ReviewsView"
```

---

### Task 2: Add previous-period comparison to the data API

**Files:**
- Modify: `app/api/teams/[teamId]/insights/data/route.ts`

**Context:** Currently the data API takes `period_start` and `period_end` and returns analytics for that range only. We need it to also accept `previous_start` and `previous_end`, compute KPIs for the previous period, and return deltas. The frontend will always send both ranges.

**Step 1: Update the GET handler to accept previous period params**

In `app/api/teams/[teamId]/insights/data/route.ts`, update the GET handler:

```typescript
const previousStart = searchParams.get('previous_start')
const previousEnd = searchParams.get('previous_end')
```

**Step 2: Add a lightweight `computePeriodKPIs` helper**

Extract the KPI computation (totalReviews, avgRating, responseRate, avgResponseTimeHours) into a small helper that both `computeTeamAnalytics` and the new comparison path can use. This helper takes a `ReviewRow[]` and returns:

```typescript
interface PeriodKPIs {
  totalReviews: number
  averageRating: number
  responseRate: number
  averageResponseTimeHours: number | null
}
```

**Step 3: Fetch previous-period reviews and compute deltas**

When `previous_start` and `previous_end` are provided:
1. Fetch reviews from that range (same location/team filter)
2. Compute `PeriodKPIs` for both current and previous
3. Return a `comparison` object alongside `analytics`:

```typescript
comparison: {
  totalReviews: { current: number; previous: number; deltaPercent: number | null }
  averageRating: { current: number; previous: number; delta: number }
  responseRate: { current: number; previous: number; deltaPercent: number | null }
  averageResponseTimeHours: { current: number | null; previous: number | null; deltaPercent: number | null }
}
```

Delta percent formula: `previous > 0 ? ((current - previous) / previous) * 100 : null`

**Step 4: Remove `sentimentMomentum`, `anonymousRatio`, `anonymousNegativeCount` from both compute functions**

Delete the momentum calculation (lines ~266-276 in `computeTeamAnalytics`, lines ~453-463 in `computeLocationAnalytics`).
Delete the anonymous ratio calculation (lines ~278-281 in team, lines ~465-468 in location).
Remove those fields from the KPIs return objects and from the empty-state returns.

**Step 5: Remove `volumeOverTime` from both compute functions**

Delete the `volumeOverTime` computation and return field from both `computeTeamAnalytics` and `computeLocationAnalytics`.

**Step 6: Add theme_dictionary lookup**

When `previous_start` is provided, also fetch themes from the `theme_dictionary` table for the relevant team and include a `themeMentions` array in the response. Query `google_reviews` for the current period to count mentions:

```typescript
// Fetch AI-classified themes from reviews in the current period
const reviewsWithThemes = reviews.filter(r => r.themes && r.themes.length > 0)
const themeCountMap = new Map<string, number>()
for (const r of reviewsWithThemes) {
  for (const theme of r.themes) {
    themeCountMap.set(theme, (themeCountMap.get(theme) || 0) + 1)
  }
}
const themeMentions = [...themeCountMap.entries()]
  .map(([label, count]) => ({ label, count }))
  .sort((a, b) => b.count - a.count)
```

To do this, the review query must also select `themes` column. Update the `.select()` calls to include `themes`.

**Step 7: Commit**

```bash
git add app/api/teams/[teamId]/insights/data/route.ts
git commit -m "feat: add previous-period comparison and theme mentions to insights data API"
```

---

### Task 3: Redesign the Insights page UI

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

This is the largest task. The page needs a complete overhaul of the insights tab content.

**Step 1: Update TypeScript interfaces**

Remove from `KPIs`:
- `sentimentMomentum`
- `anonymousRatio`
- `anonymousNegativeCount`
- `positivePercent`, `negativePercent` (not needed as separate KPIs anymore)

Add `Comparison` interface:
```typescript
interface Comparison {
  totalReviews: { current: number; previous: number; deltaPercent: number | null }
  averageRating: { current: number; previous: number; delta: number }
  responseRate: { current: number; previous: number; deltaPercent: number | null }
  averageResponseTimeHours: { current: number | null; previous: number | null; deltaPercent: number | null }
}

interface ThemeMention {
  label: string
  count: number
}
```

Remove `VolumePoint` interface (no longer used).

Update `TeamAnalytics` to remove `volumeOverTime`, `sentimentBreakdown`, `reviewVelocity`, `keywordThemes` and add `comparison?: Comparison` and `themeMentions?: ThemeMention[]`.

**Step 2: Update `getPeriodDates` to also return previous-period dates**

```typescript
function getPeriodDates(key: PeriodKey): { start: string; end: string; previousStart: string; previousEnd: string } {
  const end = new Date()
  const endStr = end.toISOString().split('T')[0]
  const start = new Date()
  switch (key) {
    case '30d': start.setDate(start.getDate() - 30); break
    case '90d': start.setDate(start.getDate() - 90); break
    case '6m': start.setMonth(start.getMonth() - 6); break
    case '1y': start.setFullYear(start.getFullYear() - 1); break
    case 'all': start.setFullYear(start.getFullYear() - 5); break
  }
  const startStr = start.toISOString().split('T')[0]
  // Previous period: same duration ending at start
  const prevEnd = new Date(start)
  const prevStart = new Date(start)
  switch (key) {
    case '30d': prevStart.setDate(prevStart.getDate() - 30); break
    case '90d': prevStart.setDate(prevStart.getDate() - 90); break
    case '6m': prevStart.setMonth(prevStart.getMonth() - 6); break
    case '1y': prevStart.setFullYear(prevStart.getFullYear() - 1); break
    case 'all': prevStart.setFullYear(prevStart.getFullYear() - 5); break
  }
  return {
    start: startStr,
    end: endStr,
    previousStart: prevStart.toISOString().split('T')[0],
    previousEnd: prevEnd.toISOString().split('T')[0],
  }
}
```

**Step 3: Update `loadData` to pass previous period params**

```typescript
const locParam = effectiveLocationId ? `&location=${effectiveLocationId}` : ''
const analyticsRes = await apiGet<any>(
  `/api/teams/${teamId}/insights/data?period_start=${start}&period_end=${end}&previous_start=${previousStart}&previous_end=${previousEnd}${locParam}`
)
```

**Step 4: Remove the tab bar (Insights/Reports toggle)**

Delete the entire tab bar JSX block (lines ~262-287). The `activeTab` state, `allReports`, `reportFilter`, `selectedReport`, `showPeriodPicker` state variables, and the `handleGenerateInsights` function, and all the Reports tab JSX (lines ~681-866) — all of this moves to the new `/aireports` page in Task 5.

Remove the `AIInsightsPanel` import since it won't be used on this page anymore.

**Step 5: Rebuild KPI cards section**

Replace the existing KPI cards grid with exactly 4 cards in a clean row. Use the new `MetricCard` component (replaces old `KPICard`):

```tsx
function MetricCard({ label, value, suffix, delta, deltaLabel }: {
  label: string
  value: string
  suffix?: string
  delta?: number | null
  deltaLabel?: string
}) {
  return (
    <div className="bg-[#F3F4F6] rounded-2xl p-5">
      <p className="text-sm font-medium text-[#4B5563] mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#111827] tracking-tight">{value}</span>
        {suffix && <span className="text-lg text-[#9CA3AF] font-medium">{suffix}</span>}
      </div>
      {delta != null && (
        <div className="mt-2">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            delta > 0 ? 'bg-[#ECFDF5] text-[#059669]' : delta < 0 ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
          }`}>
            {delta > 0 ? '+' : ''}{typeof delta === 'number' ? (deltaLabel === 'pts' ? delta.toFixed(1) + ' pts' : delta.toFixed(0) + '%') : '—'}
          </span>
        </div>
      )}
    </div>
  )
}
```

Render 4 metric cards:
1. **Total Reviews** — value: `comparison.totalReviews.current`, delta: `comparison.totalReviews.deltaPercent`
2. **Average Rating** — value: `comparison.averageRating.current.toFixed(1)`, suffix: `/ 5`, delta: `comparison.averageRating.delta` (show as pts, with trend arrow if non-zero)
3. **Response Rate** — value: `comparison.responseRate.current.toFixed(0) + '%'`, delta: `comparison.responseRate.deltaPercent`
4. **Avg. Response Time** — value: format hours nicely (e.g., "4.2h" or "2.1d"), delta: `comparison.averageResponseTimeHours.deltaPercent` (NOTE: for response time, negative delta is good — flip the color: negative = green, positive = red)

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
  <MetricCard label="Total Reviews" value={comp.totalReviews.current.toLocaleString()} delta={comp.totalReviews.deltaPercent} />
  <MetricCard label="Average Rating" value={comp.averageRating.current.toFixed(1)} suffix="/ 5" delta={comp.averageRating.delta} deltaLabel="pts" />
  <MetricCard label="Response Rate" value={`${comp.responseRate.current.toFixed(0)}%`} delta={comp.responseRate.deltaPercent} />
  <MetricCard label="Avg. Response Time" value={formatResponseTime(comp.averageResponseTimeHours.current)} delta={comp.averageResponseTimeHours.deltaPercent} invertColor />
</div>
```

Add an `invertColor` prop to `MetricCard` that flips green/red meaning (for response time, lower is better).

**Step 6: Rating Over Time — single area chart**

Replace the existing line chart with a single Recharts `AreaChart`. Use Teal 500 stroke (`#14B8A6`, 2px) and Teal 100 fill (`#CCFBF1`). Grid lines Gray 200 (`#E5E7EB`). Axis labels Gray 400 (`#9CA3AF`).

```tsx
<div className="bg-white rounded-2xl p-5 mb-8">
  <h3 className="text-base font-semibold text-[#111827] mb-1">Rating Over Time</h3>
  <p className="text-xs text-[#9CA3AF] mb-4">Monthly average rating</p>
  <ResponsiveContainer width="100%" height={280}>
    <AreaChart data={analytics.ratingOverTime.filter(d => d.averageRating !== null)}>
      <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 12, fill: '#9CA3AF' }} stroke="#E5E7EB" />
      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: '#9CA3AF' }} stroke="#E5E7EB" />
      <Tooltip ... />
      <defs>
        <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#CCFBF1" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#CCFBF1" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="averageRating" stroke="#14B8A6" strokeWidth={2} fill="url(#ratingFill)" dot={{ fill: '#14B8A6', r: 3 }} />
    </AreaChart>
  </ResponsiveContainer>
</div>
```

**Step 7: Theme Mentions section**

Below the chart, add a themes section using `analytics.themeMentions`. Display as a clean grid of pills showing label and count:

```tsx
{analytics.themeMentions && analytics.themeMentions.length > 0 && (
  <div className="bg-white rounded-2xl p-5 mb-8">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold text-[#111827]">Review Themes</h3>
        <p className="text-xs text-[#9CA3AF]">{analytics.themeMentions.length} themes detected across reviews</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {analytics.themeMentions.map((t, i) => (
        <div key={i} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F3F4F6]">
          <span className="text-sm font-medium text-[#111827]">{t.label}</span>
          <span className="text-xs font-medium text-[#4B5563] bg-white px-2 py-0.5 rounded-full">{t.count}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 8: Remove the charts/sections we're dropping**

Delete from the JSX:
- Review Volume bar chart
- Response Rate Over Time chart
- Rating Distribution chart
- Review Velocity heatmap
- Reply Gap section
- Keyword Themes section (replaced by new Theme Mentions from DB)
- "Want deeper analysis?" CTA banner at the bottom
- All Reports tab JSX (`activeTab === 'reports'` block)
- Per-location breakdown table (keep this — it's useful for team view)

**Step 9: Remove unused icon components and imports**

Delete icon components no longer referenced:
- `ThumbsUpIcon`, `LocationIcon`, `TrendUpIcon`, `TrendDownIcon`, `TrendNeutralIcon`, `AnonymousIcon`, `SparklesIcon`
- Remove `BarChart, Bar, ComposedChart` from recharts imports if no longer used
- Remove `AIInsightsPanel` import

Keep: `ChatIcon`, `StarIcon`, `ReplyIcon` (for potential future use), or remove if no longer referenced.

Remove the old `KPICard` component entirely (replaced by `MetricCard`).
Remove the old `ChartCard` component if no longer used.

**Step 10: Clean up unused state**

Remove state variables: `activeTab`, `allReports`, `reportFilter`, `selectedReport`, `showPeriodPicker`, `aiInsights`, `generating`.
Remove `handleGenerateInsights` callback.
Remove the `REPORT_CREDITS` and `REPORT_LABELS` constants.
Remove `InsightsTab` type, `SENTIMENT_COLORS`, `RATING_COLORS` if unused.

**Step 11: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx
git commit -m "feat: redesign insights page with comparison deltas, theme mentions, and clean metrics"
```

---

### Task 4: Add AI Reports nav item to AppShell

**Files:**
- Modify: `components/AppShell.tsx`

**Step 1: Add a ReportsIcon component**

```tsx
function ReportsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
```

**Step 2: Add NavItem for AI Reports between Insights and Compete**

After the Insights NavItem (line ~122), add:

```tsx
<NavItem
  href={`/teams/${navTeam.id}/aireports${locationQs}`}
  icon={<ReportsIcon />}
  label="AI Reports"
  active={pathname?.includes('/aireports')}
  badge={tier === 'FREE' ? 'PRO' : undefined}
  collapsed={isCollapsed}
/>
```

**Step 3: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat: add AI Reports nav item to sidebar"
```

---

### Task 5: Create the AI Reports page

**Files:**
- Create: `app/(app)/teams/[teamId]/aireports/page.tsx`

**Step 1: Create the aireports page**

This page is essentially the Reports tab content extracted from the old insights page. It should be a standalone page with:

1. Header: "AI Reports" with subtitle
2. Period filter pills (30d, 90d, 6m, 1y)
3. "Generate Report" button with period picker dropdown
4. Report list (cards showing period, date, sentiment score)
5. Report detail view using `<AIInsightsPanel />`
6. Free-tier upsell gate

Import `AIInsightsPanel` from `@/components/AIInsightsPanel`.

The page needs its own state for:
- `allReports`, `reportFilter`, `selectedReport`, `showPeriodPicker`, `generating`
- Fetch reports on mount via `apiGet(/api/teams/${teamId}/insights/run?...)`
- Generate via `apiPost(/api/teams/${teamId}/insights/run, { period_window })`

Keep the same styling/structure from the old Reports tab, but apply brand colors:
- Period filter pills: active = `bg-[#0D9B8A] text-white`, inactive = `bg-[#F3F4F6] text-[#4B5563]`
- Generate button: `bg-[#0D9B8A] hover:bg-[#0D9B8A]/90 text-white`
- Report cards: `bg-white` with `border border-[#E5E7EB]`, hover `border-[#0D9B8A]/30`

Use the same `useAuth`, `useParams`, `useSearchParams` pattern as the insights page. The `effectiveLocationId` logic (auto-selecting single location) should be duplicated here.

**Step 2: Commit**

```bash
git add app/(app)/teams/[teamId]/aireports/page.tsx
git commit -m "feat: create standalone AI Reports page at /aireports"
```

---

### Task 6: Restore concurrent report generation

**Files:**
- Modify: `app/api/teams/[teamId]/insights/run/route.ts`
- Modify: `lib/validation/schemas.ts`

**Context:** Commit `88b4935` changed from generating all 4 periods concurrently (via `Promise.all`) to single-period generation. We need to restore concurrent generation.

**Step 1: Update the validation schema**

In `lib/validation/schemas.ts`, make `period_window` optional or add a `generate_all` boolean. The simplest approach: keep the current single-period endpoint working AND add a new mode. When `period_window` is `'all'`, generate all 4 concurrently.

```typescript
export const runInsightsSchema = z.object({
  period_window: z.enum(['30d', '90d', '6m', '1y', 'all']),
})
```

**Step 2: Update the POST handler in `insights/run/route.ts`**

When `period_window === 'all'`:
1. Charge the sum of all credits: 3 + 4 + 7 + 10 = 24 credits
2. Fetch reviews from 1 year ago to now (single DB query)
3. For each of the 4 periods, filter reviews in memory and call `insightsRun()` concurrently via `Promise.all`
4. Insert all 4 results at once

When `period_window` is a specific period (30d/90d/6m/1y), keep the current single-period behavior unchanged.

The concurrent block should look like:

```typescript
if (periodWindow === 'all') {
  const totalCost = 3 + 4 + 7 + 10
  await spendCredits(params.teamId, user.id, 'insight_run', totalCost, scope, scopeId, idempotencyKey, { feature: 'insights' })

  // Fetch all reviews from 1 year ago
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const fetchStartStr = toDateStr(oneYearAgo)
  const fetchEndStr = toDateStr(now)

  const { data: reviews } = await serviceClient.schema('app').from('google_reviews')
    .select('id, rating, comment, review_date, reply_status, reviewer_name')
    .eq('location_id', locationId) // or .in('location_id', locationIds) for team
    .gte('review_date', fetchStartStr)
    .lte('review_date', fetchEndStr)

  const allReviews = (reviews || []).map(...)

  const periods: { key: PeriodWindow; current: number; previous: number; unit: 'days' | 'months' }[] = [
    { key: '30d', current: 30, previous: 30, unit: 'days' },
    { key: '90d', current: 90, previous: 90, unit: 'days' },
    { key: '6m', current: 6, previous: 6, unit: 'months' },
    { key: '1y', current: 12, previous: 0, unit: 'months' },
  ]

  const runs = periods.map(async (p) => {
    const cStart = subtractFromDate(now, p.current, p.unit)
    const pEnd = cStart
    const pStart = p.previous > 0 ? subtractFromDate(cStart, p.previous, p.unit) : cStart

    const currentReviews = allReviews.filter(r => new Date(r.review_date) >= cStart)
    const previousReviews = p.previous > 0
      ? allReviews.filter(r => new Date(r.review_date) >= pStart && new Date(r.review_date) < cStart)
      : []

    const data = await insightsRun({
      reviews: currentReviews,
      previousReviews: p.key === '1y' ? undefined : previousReviews,
      periodStart: toDateStr(cStart),
      periodEnd: toDateStr(now),
      previousPeriodStart: toDateStr(pStart),
      previousPeriodEnd: toDateStr(pEnd),
      scope, locationName, periodWindow: p.key,
    })

    return { period_window: p.key, period_start: toDateStr(cStart), period_end: toDateStr(now), data }
  })

  const results = await Promise.all(runs)

  const insertData = results.map(r => ({
    team_id: locationId ? null : params.teamId,
    location_id: locationId || null,
    period_start: r.period_start,
    period_end: r.period_end,
    period_window: r.period_window,
    kind: 'standard',
    data: r.data,
    generated_by_user_id: user.id,
    model: 'gpt-5-mini',
  }))

  const { data: inserted, error } = await serviceClient.schema('app').from('insights').insert(insertData).select()
  if (error) throw new Error(`Failed to save insights: ${error.message}`)

  return NextResponse.json({ insights: inserted }, { status: 201 })
}
```

**Step 3: Update the AI Reports page to use `period_window: 'all'`**

In the `aireports` page, the "Generate All Reports" button should POST with `{ period_window: 'all' }`. Keep the individual period buttons as well, posting with the specific period.

**Step 4: Commit**

```bash
git add app/api/teams/[teamId]/insights/run/route.ts lib/validation/schemas.ts app/(app)/teams/[teamId]/aireports/page.tsx
git commit -m "feat: restore concurrent report generation with 'all' period option"
```

---

### Task 7: Apply brand colors to remaining UI elements

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`
- Modify: `app/(app)/teams/[teamId]/aireports/page.tsx`

**Step 1: Audit and update all color values**

Go through both pages and ensure:

- Period picker pills: active = `bg-white shadow text-[#111827]` (keep current), but ensure inactive uses `text-[#4B5563]`
- Any teal references use exact hex: `#0D9B8A` for Teal 600, `#14B8A6` for Teal 500
- Metric card backgrounds: `bg-[#F3F4F6]` (flat, no border)
- Chart uses `#14B8A6` stroke, `#CCFBF1` fill, `#E5E7EB` grid, `#9CA3AF` axis
- Delta badges: `bg-[#ECFDF5] text-[#059669]` for positive, `bg-[#FEF2F2] text-[#DC2626]` for negative
- Per-location table uses `text-[#111827]`, `text-[#4B5563]`, borders `#E5E7EB`

**Step 2: Commit**

```bash
git add app/(app)/teams/[teamId]/insights/page.tsx app/(app)/teams/[teamId]/aireports/page.tsx
git commit -m "style: apply brand color system to insights and reports pages"
```

---

### Task 8: Final verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build with no TypeScript errors.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No new lint errors.

**Step 3: Manual smoke test checklist**

- [ ] Navigate to `/teams/{id}/insights` — see 4 metric cards with deltas
- [ ] Period picker changes data and comparison deltas update
- [ ] Rating over time chart renders with teal area fill
- [ ] Theme mentions section shows labels with counts
- [ ] Per-location breakdown table shows for team view
- [ ] Navigate to `/teams/{id}/aireports` — see reports list
- [ ] Generate report works (single period)
- [ ] Generate all reports works (concurrent)
- [ ] Sidebar shows both "Insights" and "AI Reports" nav items
- [ ] No console.log in ReviewsView

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for insights overhaul"
```
