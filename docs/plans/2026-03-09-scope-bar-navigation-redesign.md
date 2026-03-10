# Scope Bar Navigation Redesign

**Date:** 2026-03-09
**Status:** Approved

## Mental Model

Team is a scope, Location is a filter within that scope. One unified URL pattern replaces the current split between `/teams/` and `/locations/` routes.

**Scope hierarchy:** Team → Location

- **Team scope** ("All Locations") — aggregated view across all locations in a team
- **Location scope** — filtered to a single location

Pages declare which scopes they support:

| Page | Team scope | Location scope | Location dropdown visible |
|------|-----------|----------------|--------------------------|
| Reviews | ✓ | ✓ | Yes |
| Insights | ✓ | ✓ | Yes |
| Compete | ✓ | ✗ | No |
| Billing | ✓ | ✗ | No |
| Settings | N/A | N/A | No |

**Single-team users** see no team dropdown. The team is implicit. If they create a second team, the team dropdown appears automatically.

## URL Pattern (Unified)

```
/teams/{teamId}/reviews                    → All Locations, Reviews
/teams/{teamId}/reviews?location={locId}   → Specific Location, Reviews
/teams/{teamId}/insights                   → All Locations, Insights
/teams/{teamId}/insights?location={locId}  → Specific Location, Insights
/teams/{teamId}/competitive                → Team-wide (no location param)
/teams/{teamId}/billing                    → Team-wide (no location param)
```

The `/locations/[locationId]/...` route tree is retired entirely. Redirects from old URLs to new pattern via middleware.

## Top Bar Component

A single fixed bar at the top of the viewport (~48px). This IS the header — replaces the current header entirely.

**Layout (left to right):**

- **Logo/brand mark** — compact, links to current team's Reviews page
- **Team dropdown** — only rendered when user belongs to 2+ teams. Shows current team name. Selecting a team updates URL path, clears location filter, refetches locations list.
- **Location dropdown** — only rendered on pages that support location scope (Reviews, Insights). Shows "All Locations" by default with separator, individual locations listed below. Selecting a location adds `?location={id}` via `router.replace()` (no page reload). Selecting "All Locations" removes the param.

**No user avatar or menu in the top bar** — that stays in the sidebar.

**Switching behavior:**

- **Location switch** → `router.replace` with updated query param. Component stays mounted, data refetches. No reload.
- **Team switch** → `router.push` to new team path. Client-side navigation (fast, but page re-renders). Resets location to "All Locations".

## Sidebar (Simplified)

**Structure (top to bottom):**

1. **Nav links** — Reviews, Insights, Compete. Each links to `/teams/{selectedTeamId}/{section}`, preserving the current `?location=` param. Active state highlights based on pathname.
2. **Spacer**
3. **Credits display** — current team's credit balance
4. **Settings link** — `/settings`
5. **User info** — name/email, logout

**Removed from sidebar:**

- Team dropdown (moved to top bar)
- Location list with individual location buttons (replaced by top bar dropdown)
- "All Locations" button (replaced by top bar dropdown default)
- "Manage Teams" link (moved under Settings)

## Route Consolidation

**Keep (under `/teams/[teamId]/`):**

- `reviews/page.tsx` — reads `?location` param, calls appropriate API endpoint, passes `mode` + `entityId` to `ReviewsView`
- `insights/page.tsx` — same pattern with `AIInsightsPanel`
- `competitive/page.tsx` — team-only, no changes
- `billing/page.tsx` + `billing/success/page.tsx` — team-only, no changes
- `locations/page.tsx` — location management page, stays

**Remove:**

- `app/(app)/locations/[locationId]/reviews/page.tsx`
- `app/(app)/locations/[locationId]/insights/page.tsx`

**Add:**

- Redirect from `/locations/{locId}/*` → `/teams/{teamId}/*?location={locId}` (middleware or thin redirect page that looks up the team)

## State Management

No new context providers. URL is the single source of truth.

**Top bar reads:** `useAuth()` for teams list, `useParams()` for teamId, `useSearchParams()` for location, local state for fetched locations.

**Top bar writes:** `router.push` (team switch), `router.replace` (location switch).

**Page components read:** `useParams()` for teamId, `useSearchParams()` for location. Derive:

```typescript
const locationId = searchParams.get('location')
const mode = locationId ? 'location' : 'team'
const entityId = locationId || teamId
```

**API layer:** No changes. Existing `/api/teams/` and `/api/locations/` endpoints stay as-is. Pages call the right endpoint based on query param presence.
