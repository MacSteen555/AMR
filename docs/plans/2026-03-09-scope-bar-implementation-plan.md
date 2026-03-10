# Scope Bar Navigation Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current dual-dropdown sidebar navigation with a fixed top scope bar and simplified sidebar, unifying all routes under `/teams/[teamId]/` with `?location=` query params.

**Architecture:** Extract scope selection (team + location) into a fixed top bar component. Simplify the sidebar to nav links + credits + user. Update Reviews and Insights pages to read `?location=` query param instead of using separate `/locations/` routes. Remove `/locations/` page routes and add redirect middleware.

**Tech Stack:** Next.js 14 App Router, React client components, `useSearchParams()`, `router.replace()`, Tailwind CSS

---

### Task 1: Create the ScopeBar top bar component

**Files:**
- Create: `components/ScopeBar.tsx`

**Step 1: Create the ScopeBar component**

This component is the fixed top bar. It renders:
- Logo (left) — links to `/teams/{teamId}/reviews`
- Team dropdown (only if `teams.length > 1`) — switches team via `router.push`
- Location dropdown (only on Reviews/Insights pages) — switches via `router.replace` with `?location=` param

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiGet } from '@/lib/api'

interface Location {
  id: string
  name: string
  google_place_id?: string
}

// Pages that support location-level filtering
const LOCATION_ENABLED_SECTIONS = ['reviews', 'insights']

function getCurrentSection(pathname: string | null): string {
  if (!pathname) return 'reviews'
  if (pathname.includes('/insights')) return 'insights'
  if (pathname.includes('/competitive')) return 'competitive'
  if (pathname.includes('/billing')) return 'billing'
  return 'reviews'
}

export function ScopeBar() {
  const { teams } = useAuth()
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const teamId = params?.teamId as string | undefined
  const currentTeam = teams.find(t => t.id === teamId) || teams[0] || null
  const selectedLocationId = searchParams?.get('location') || null
  const section = getCurrentSection(pathname)
  const showLocationDropdown = LOCATION_ENABLED_SECTIONS.includes(section)

  const [locations, setLocations] = useState<Location[]>([])
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [locationsOpen, setLocationsOpen] = useState(false)
  const teamDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)

  // Fetch locations when team changes
  useEffect(() => {
    if (!currentTeam) return
    apiGet<{ locations: Location[] }>(`/api/teams/${currentTeam.id}/locations`)
      .then(res => setLocations(res.locations || []))
      .catch(() => setLocations([]))
  }, [currentTeam?.id])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(event.target as Node)) {
        setTeamsOpen(false)
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setLocationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTeamSwitch = (newTeamId: string) => {
    setTeamsOpen(false)
    setLocations([])
    // Navigate to same section on new team, drop location param
    router.push(`/teams/${newTeamId}/${section}`)
  }

  const handleLocationSwitch = (locationId: string | null) => {
    setLocationsOpen(false)
    if (!teamId) return
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (locationId) {
      params.set('location', locationId)
    } else {
      params.delete('location')
    }
    const qs = params.toString()
    router.replace(`/teams/${teamId}/${section}${qs ? `?${qs}` : ''}`)
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId)

  // Don't render on pages without a team context (e.g., /settings, /teams management)
  if (!teamId || !currentTeam) return null

  return (
    <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0 z-50">
      {/* Logo */}
      <button
        onClick={() => router.push(`/teams/${currentTeam.id}/reviews`)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer shrink-0"
      >
        <img src="/images/amber_teal-logo.png" alt="AutoMyReply" className="h-7 w-auto" />
        <span className="text-base font-bold text-gray-900 hidden sm:block">AutoMyReply</span>
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Team Dropdown — only if 2+ teams */}
      {teams.length > 1 && (
        <div className="relative" ref={teamDropdownRef}>
          <button
            onClick={() => setTeamsOpen(!teamsOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium text-gray-700"
          >
            <div className="w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">{currentTeam.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="max-w-[140px] truncate">{currentTeam.name}</span>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${teamsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {teamsOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[200px]" style={{ animation: 'fadeSlideUp 0.15s ease-out' }}>
              <div className="px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch team</span>
              </div>
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSwitch(team.id)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${team.id === currentTeam.id ? 'bg-teal-50/60' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${team.id === currentTeam.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`truncate ${team.id === currentTeam.id ? 'text-teal-700 font-medium' : 'text-gray-700'}`}>{team.name}</span>
                  </div>
                  {team.id === currentTeam.id && (
                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Location Dropdown — only on location-enabled pages */}
      {showLocationDropdown && (
        <>
          {teams.length > 1 && <div className="w-px h-6 bg-gray-200" />}
          <div className="relative" ref={locationDropdownRef}>
            <button
              onClick={() => setLocationsOpen(!locationsOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium text-gray-700"
            >
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="max-w-[180px] truncate">
                {selectedLocation ? selectedLocation.name : 'All Locations'}
              </span>
              {locations.length > 0 && (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{locations.length}</span>
              )}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${locationsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {locationsOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 min-w-[220px]" style={{ animation: 'fadeSlideUp 0.15s ease-out' }}>
                {/* All Locations */}
                <button
                  onClick={() => handleLocationSwitch(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer ${!selectedLocationId ? 'bg-teal-50/60 text-teal-700 font-medium' : 'text-gray-700'}`}
                >
                  All Locations
                  {!selectedLocationId && (
                    <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Separator */}
                {locations.length > 0 && <div className="border-t border-gray-100 my-1" />}

                {/* Individual locations */}
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => handleLocationSwitch(loc.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between cursor-pointer truncate ${selectedLocationId === loc.id ? 'bg-teal-50/60 text-teal-700 font-medium' : 'text-gray-700'}`}
                    title={loc.name}
                  >
                    <span className="truncate">{loc.name}</span>
                    {selectedLocationId === loc.id && (
                      <svg className="w-4 h-4 text-teal-600 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}

                {locations.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400 italic">No locations yet</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: Verify file was created**

Run: `ls -la components/ScopeBar.tsx`
Expected: file exists

**Step 3: Commit**

```bash
git add components/ScopeBar.tsx
git commit -m "feat: create ScopeBar top bar component for team/location scope selection"
```

---

### Task 2: Rewrite AppShell to use ScopeBar + simplified sidebar

**Files:**
- Modify: `components/AppShell.tsx`

**Step 1: Rewrite AppShell**

Remove: logo section, team dropdown, location selector from sidebar.
Add: `<ScopeBar />` rendered above the sidebar+content layout.
Keep: nav links, credits, user section in sidebar.
Update: nav link URLs to use `/teams/{teamId}/{section}` and preserve `?location=` param.

Replace the entire `AppShell` component body with this structure:

```tsx
// New structure:
<div className="flex flex-col h-screen bg-gray-50/80">
  {/* Top scope bar */}
  <ScopeBar />

  <div className="flex flex-1 overflow-hidden">
    {/* Simplified sidebar */}
    <aside className="w-[240px] bg-white border-r border-gray-200/80 flex flex-col shrink-0">
      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {/* Reviews, Insights, Compete nav items */}
        {/* Settings, Teams links */}
      </nav>

      {/* Credits & User (same as current) */}
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-auto">
      <div className="page-enter">{children}</div>
    </main>
  </div>
</div>
```

Key changes to `NavItem` href generation:
- Read `teamId` from `useParams()` and `searchParams` from `useSearchParams()`
- Reviews href: `/teams/${teamId}/reviews${locationParam}`
- Insights href: `/teams/${teamId}/insights${locationParam}`
- Compete href: `/teams/${teamId}/competitive` (no location param)
- Where `locationParam` = `searchParams.get('location') ? '?location=' + searchParams.get('location') : ''`

For the `LoadingScreen`, update the skeleton to match the new layout (top bar + simplified sidebar).

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: No type errors related to AppShell or ScopeBar

**Step 3: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat: rewrite AppShell with ScopeBar top bar and simplified sidebar"
```

---

### Task 3: Update team reviews page to support `?location=` param

**Files:**
- Modify: `app/(app)/teams/[teamId]/reviews/page.tsx`

**Step 1: Update the page to read the location query param**

```tsx
'use client'

import { useParams, useSearchParams } from 'next/navigation'
import ReviewsView from '@/components/ReviewsView'

export default function TeamReviewsPage() {
  const { teamId } = useParams() as { teamId: string }
  const searchParams = useSearchParams()
  const locationId = searchParams?.get('location') || null

  const mode = locationId ? 'location' : 'team'
  const entityId = locationId || teamId

  return (
    <ReviewsView
      mode={mode}
      entityId={entityId}
      title={locationId ? 'Location Reviews' : 'Team Reviews'}
      subtitle={locationId ? 'Manage customer feedback for this location.' : 'Manage feedback across all your locations.'}
    />
  )
}
```

**Step 2: Verify it renders**

Run: `npm run dev`, navigate to `/teams/{teamId}/reviews` and `/teams/{teamId}/reviews?location={locId}`
Expected: Team view without param, location view with param

**Step 3: Commit**

```bash
git add app/\(app\)/teams/\[teamId\]/reviews/page.tsx
git commit -m "feat: team reviews page now supports ?location= query param"
```

---

### Task 4: Update team insights page to support `?location=` param

**Files:**
- Modify: `app/(app)/teams/[teamId]/insights/page.tsx`

**Step 1: Update the page to support both modes**

This page is more complex. When `?location=` is present, it should:
- Call `/api/locations/{locationId}/insights/data` and `/api/locations/{locationId}/insights/run` (instead of team endpoints)
- Show 4 KPI cards (no "Locations" card) instead of 5
- Use `AreaChart` for response rate (instead of `ComposedChart` with per-location lines)
- Hide the per-location breakdown table
- Use single-line rating chart (no per-location overlay lines)
- Adjust header text to "Insights" vs "Team Insights"
- Use `locationId` for AI insights generate/fetch calls

Add these near the top of the component:

```tsx
const searchParams = useSearchParams()
const locationId = searchParams?.get('location') || null
const mode = locationId ? 'location' : 'team'
const isTeamView = !locationId
```

Then branch the data fetching:

```tsx
const loadData = async () => {
  setLoading(true)
  try {
    const entityPath = locationId
      ? `/api/locations/${locationId}`
      : `/api/teams/${teamId}`
    const [analyticsRes, insightsRes] = await Promise.all([
      apiGet(`${entityPath}/insights/data?period_start=${start}&period_end=${end}`),
      apiGet(`${entityPath}/insights/run?period_window=${period}`),
    ])
    // ...set state
  } catch { /* ... */ }
}
```

Update the `useEffect` dependency array to include `locationId` so data refetches on location switch:

```tsx
useEffect(() => { loadData() }, [teamId, locationId, start, end])
```

Conditionally render the team-specific UI pieces:
- KPI grid: `grid-cols-2 lg:grid-cols-${isTeamView ? '5' : '4'}` — hide Locations KPI when in location mode
- Charts: hide per-location overlay lines when in location mode
- Per-location breakdown table: only render when `isTeamView`
- Response rate chart: use `AreaChart` for location mode, `ComposedChart` for team mode
- Update per-location table row click to use `handleLocationSwitch` instead of `router.push('/locations/...')`

Update the per-location table row click handler:

```tsx
// Old:
onClick={() => router.push(`/locations/${loc.locationId}/insights`)}
// New:
onClick={() => {
  const params = new URLSearchParams(searchParams?.toString() || '')
  params.set('location', loc.locationId)
  router.replace(`/teams/${teamId}/insights?${params.toString()}`)
}}
```

**Step 2: Verify both modes work**

Run dev server, test:
- `/teams/{teamId}/insights` — team view with 5 KPIs, per-location table, multi-line charts
- `/teams/{teamId}/insights?location={locId}` — location view with 4 KPIs, single-line charts, no per-location table

**Step 3: Commit**

```bash
git add app/\(app\)/teams/\[teamId\]/insights/page.tsx
git commit -m "feat: team insights page supports ?location= query param for location-level analytics"
```

---

### Task 5: Remove old `/locations/` page routes

**Files:**
- Delete: `app/(app)/locations/[locationId]/reviews/page.tsx`
- Delete: `app/(app)/locations/[locationId]/insights/page.tsx`
- Delete: any empty directories under `app/(app)/locations/[locationId]/` (reviews/, insights/)

**Step 1: Delete the files**

```bash
rm app/\(app\)/locations/\[locationId\]/reviews/page.tsx
rm app/\(app\)/locations/\[locationId\]/insights/page.tsx
# Remove empty directories
rmdir app/\(app\)/locations/\[locationId\]/reviews 2>/dev/null
rmdir app/\(app\)/locations/\[locationId\]/insights 2>/dev/null
rmdir app/\(app\)/locations/\[locationId\] 2>/dev/null
```

Note: Do NOT delete `app/(app)/teams/[teamId]/locations/` — that's the location management page and is unrelated.

**Step 2: Verify no imports reference deleted files**

Run: `grep -r "locations/\[locationId\]/reviews" app/ components/ --include="*.tsx" --include="*.ts"`
Run: `grep -r "locations/\[locationId\]/insights" app/ components/ --include="*.tsx" --include="*.ts"`
Expected: No matches (or only this plan file)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated /locations/[locationId] page routes"
```

---

### Task 6: Add redirect for old `/locations/` URLs

**Files:**
- Create: `app/(app)/locations/[locationId]/redirect/page.tsx` (catch-all redirect)

Or simpler: add a redirect in `middleware.ts`.

**Step 1: Add redirect logic to middleware**

Add this block in `middleware.ts` BEFORE the API rate-limiting section (after the `pathname` extraction). This handles page navigation redirects for old bookmarked URLs:

```typescript
// Redirect old /locations/:id/... URLs to /teams/:teamId/...?location=:id
const locationMatch = pathname.match(/^\/locations\/([^/]+)\/(reviews|insights)/)
if (locationMatch) {
  const [, locationId, section] = locationMatch
  // Look up team from API — for now, redirect to a client-side handler
  const url = request.nextUrl.clone()
  url.pathname = '/location-redirect'
  url.searchParams.set('locationId', locationId)
  url.searchParams.set('section', section)
  return NextResponse.redirect(url)
}
```

Then create a small client page at `app/location-redirect/page.tsx` that:
1. Reads `locationId` and `section` from search params
2. Calls `/api/locations/{locationId}` (or `/api/me`) to get the team ID
3. Redirects to `/teams/{teamId}/{section}?location={locationId}`

```tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api'

export default function LocationRedirectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locationId = searchParams?.get('locationId')
  const section = searchParams?.get('section') || 'reviews'

  useEffect(() => {
    if (!locationId) { router.replace('/dashboard'); return }

    apiGet<{ teamId: string }>(`/api/locations/${locationId}/team`)
      .then(res => {
        router.replace(`/teams/${res.teamId}/${section}?location=${locationId}`)
      })
      .catch(() => {
        router.replace('/dashboard')
      })
  }, [locationId, section, router])

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
    </div>
  )
}
```

Also create a simple API route to look up a location's team:

**File:** `app/api/locations/[locationId]/team/route.ts`

```typescript
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { locationId: string } }
) {
  await requireUser()
  const supabase = createSupabaseServiceRoleClient()
  const { data } = await supabase
    .from('locations')
    .select('team_id')
    .eq('id', params.locationId)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  return NextResponse.json({ teamId: data.team_id })
}
```

**Step 2: Test redirect**

Navigate to `/locations/{locId}/reviews` — should redirect to `/teams/{teamId}/reviews?location={locId}`

**Step 3: Commit**

```bash
git add middleware.ts app/location-redirect/page.tsx app/api/locations/\[locationId\]/team/route.ts
git commit -m "feat: add redirect from old /locations/ URLs to new ?location= pattern"
```

---

### Task 7: Clean up stale references across codebase

**Files:**
- Modify: any files that reference `/locations/${locationId}/reviews` or `/locations/${locationId}/insights`

**Step 1: Search for stale URL patterns**

```bash
grep -rn "/locations/" app/ components/ lib/ --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v "/api/locations/" | grep -v "teams/\[teamId\]/locations"
```

Common places to fix:
- `components/AppShell.tsx` — `buildLocationUrl()` function (should be removed already in Task 2)
- `app/(app)/teams/[teamId]/insights/page.tsx` — per-location table row click (should be fixed in Task 4)

**Step 2: Fix any remaining references**

Update each reference to use the `?location=` pattern instead.

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up remaining /locations/ URL references"
```

---

### Task 8: Verify and test the full flow

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Test each flow**

1. Navigate to `/dashboard` — should redirect to team reviews
2. On Reviews page, location dropdown visible in top bar — select a location
3. URL updates to `?location={id}`, content swaps without reload
4. Click "All Locations" — URL drops param, shows team view
5. Navigate to Insights via sidebar — `?location=` param preserved
6. Navigate to Compete via sidebar — no location dropdown shown, location param dropped
7. Navigate back to Reviews — location dropdown reappears (no location pre-selected)
8. If 2+ teams: team dropdown shows, switch team — navigates to new team, location resets
9. If 1 team: no team dropdown visible
10. Old URL `/locations/{id}/reviews` — redirects to `/teams/{teamId}/reviews?location={id}`
11. Credits display in sidebar still works
12. User info / settings in sidebar still works

**Step 3: Run build**

```bash
npm run build
```

Expected: Clean build

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during scope bar integration testing"
```
