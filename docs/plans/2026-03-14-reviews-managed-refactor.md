# Reviews Managed Refactor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dwindling credit counter UX with a "reviews managed" value metric, showing an upgrade popup when users hit their monthly limit.

**Architecture:** Credits still function under the hood (1 credit per reply post, monthly resets). We add a lifetime `reviews_managed` counter incremented on each successful post, surface it prominently in the UI, and de-emphasize the credit balance. An upgrade modal appears when credits are exhausted.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres), React, TypeScript

---

### Task 1: Add `reviewsManaged` to `/api/me` response

**Files:**
- Modify: `app/api/me/route.ts:34-44`
- Modify: `hooks/useAuth.tsx:14-26`

**Step 1: Update the balance query in `/api/me` to also fetch `reviews_managed`**

In `app/api/me/route.ts`, change lines 34-44 from:

```typescript
const { data: balance } = await supabase
  .schema('app')
  .from('team_credit_balances')
  .select('balance')
  .eq('team_id', team.id)
  .single()

return {
  ...team,
  subscription: subscription || null,
  creditBalance: balance?.balance || 0,
}
```

to:

```typescript
const { data: balance } = await supabase
  .schema('app')
  .from('team_credit_balances')
  .select('balance, reviews_managed')
  .eq('team_id', team.id)
  .single()

return {
  ...team,
  subscription: subscription || null,
  creditBalance: balance?.balance || 0,
  reviewsManaged: balance?.reviews_managed || 0,
}
```

**Step 2: Update the `Team` interface in `hooks/useAuth.tsx`**

In `hooks/useAuth.tsx`, add `reviewsManaged` to the `Team` interface (line 25):

```typescript
export interface Team {
  id: string
  name: string
  role: string
  subscription: {
    tier: string
    status: string
    monthly_credits: number
    insights_enabled: boolean
    competitive_enabled: boolean
  } | null
  creditBalance: number
  reviewsManaged: number
}
```

**Step 3: Verify the dev server compiles without errors**

Run: `npm run build` (or check dev server for type errors)
Expected: No type errors related to `reviewsManaged`

**Step 4: Commit**

```bash
git add app/api/me/route.ts hooks/useAuth.tsx
git commit -m "feat: add reviewsManaged to /api/me response and Team interface"
```

---

### Task 2: Increment `reviews_managed` on reply post

**Files:**
- Modify: `app/api/reviews/[reviewId]/post-reply/route.ts:67-81`
- Modify: `app/api/reviews/[reviewId]/publish/route.ts:44-55`
- Modify: `app/api/teams/[teamId]/reviews/bulk-publish/route.ts:53-63`

**Step 1: Add increment logic to `post-reply/route.ts`**

After the successful Google post + review update (after line 81), add:

```typescript
// Increment reviews_managed counter
const { data: review_for_team } = await serviceClient
  .schema('app')
  .from('locations')
  .select('team_id')
  .eq('id', review.location_id)
  .single()

if (review_for_team) {
  await serviceClient.rpc('increment_reviews_managed', {
    p_team_id: review_for_team.team_id,
  })
}
```

Note: We need the team_id from the location. The review query at line 26 already joins `locations` — we can get `team_id` from there. Alternatively, since the join uses `locations!inner`, we can add `team_id` to that select. Updated approach — modify the select at line 26-27:

Change:
```typescript
.select('*, location:locations!inner(google_location_id, google_account_hint)')
```
to:
```typescript
.select('*, location:locations!inner(team_id, google_location_id, google_account_hint)')
```

Then after the successful post (after line 81, inside the `success = true` block):

```typescript
// Increment reviews_managed counter
await serviceClient.rpc('increment_reviews_managed', {
  p_team_id: review.location.team_id,
})
```

**Step 2: Add increment logic to `publish/route.ts`**

The publish route already has `locations(google_location_id, google_account_hint)` at line 16. Add `team_id`:

Change:
```typescript
.select('*, locations(google_location_id, google_account_hint)')
```
to:
```typescript
.select('*, locations(team_id, google_location_id, google_account_hint)')
```

After the successful DB update (after line 55), add:

```typescript
// Increment reviews_managed counter
if (review.locations?.team_id) {
  await serviceClient.rpc('increment_reviews_managed', {
    p_team_id: review.locations.team_id,
  })
}
```

**Step 3: Add increment logic to `bulk-publish/route.ts`**

The bulk-publish route already has `params.teamId`. After each successful post (after line 63, inside the try block after the DB update):

```typescript
// Increment reviews_managed counter
await serviceClient.rpc('increment_reviews_managed', {
  p_team_id: params.teamId,
})
```

**Step 4: Create the `increment_reviews_managed` RPC function**

We need a Supabase RPC function to atomically increment the counter. Create via SQL migration or run directly:

```sql
CREATE OR REPLACE FUNCTION app.increment_reviews_managed(p_team_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE app.team_credit_balances
  SET reviews_managed = COALESCE(reviews_managed, 0) + 1,
      updated_at = now()
  WHERE team_id = p_team_id;
$$;
```

Add this to the migration file or run via Supabase dashboard. If adding to codebase, create a new migration file:
`supabase/migrations/20260314_increment_reviews_managed.sql`

**Step 5: Commit**

```bash
git add app/api/reviews/[reviewId]/post-reply/route.ts app/api/reviews/[reviewId]/publish/route.ts app/api/teams/[teamId]/reviews/bulk-publish/route.ts supabase/migrations/20260314_increment_reviews_managed.sql
git commit -m "feat: increment reviews_managed counter on successful reply post"
```

---

### Task 3: Update AppShell sidebar — replace credits with reviews managed

**Files:**
- Modify: `components/AppShell.tsx:36,173-211`

**Step 1: Add `reviewsManaged` variable alongside `credits`**

At line 36 in `AppShell.tsx`, add:

```typescript
const reviewsManaged = navTeam?.reviewsManaged || 0
```

**Step 2: Replace the credits display (lines 176-211) with reviews managed**

Replace the entire credits section (collapsed + expanded variants) with:

```typescript
{/* Reviews Managed */}
{isCollapsed ? (
  <div
    className="w-full flex flex-col items-center gap-0.5 bg-gray-50 rounded-xl border border-gray-100 py-2.5"
    title={`${reviewsManaged} reviews managed`}
  >
    <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <div className="text-sm font-bold text-teal-600 leading-none">{reviewsManaged}</div>
  </div>
) : (
  <div className="flex items-center justify-between bg-gray-50 rounded-2xl border border-gray-100 px-3.5 py-2.5">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <div className="text-lg font-bold text-teal-600 leading-none">{reviewsManaged}</div>
        <div className="text-[10px] text-gray-400 font-medium">reviews managed</div>
      </div>
    </div>
  </div>
)}
```

This removes the "Top up" button and coin icon, replacing with a checkmark icon and "reviews managed" label.

**Step 3: Verify visually in dev server**

Run: `npm run dev`
Expected: Sidebar shows "X reviews managed" instead of "X credits left". No "Top up" button.

**Step 4: Commit**

```bash
git add components/AppShell.tsx
git commit -m "feat: replace credits display with reviews managed in sidebar"
```

---

### Task 4: Add "Reviews Managed" KPI card to dashboard

**Files:**
- Modify: `app/(app)/teams/[teamId]/page.tsx:90-94,231-254`

**Step 1: Get `reviewsManaged` from the team data**

At line 94, after `const tier = ...`, add:

```typescript
const reviewsManaged = currentTeam?.reviewsManaged || 0
```

**Step 2: Update the KPI grid from 3 to 4 columns**

Change line 232:

```typescript
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```
to:
```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Step 3: Add the Reviews Managed KPI card**

Add as the first card (before "Locations"), inside the grid:

```typescript
<KpiCard
  label="Reviews Managed"
  value={reviewsManaged.toString()}
  icon={<CheckCircleIcon />}
  sub="Lifetime replies posted"
  color="teal"
/>
```

**Step 4: Add the `CheckCircleIcon` component**

Add near the other icon components at the bottom of the file:

```typescript
function CheckCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
```

**Step 5: Verify visually**

Run: `npm run dev`
Expected: Dashboard shows 4 KPI cards — "Reviews Managed", "Locations", "Avg Rating", "Needs Reply"

**Step 6: Commit**

```bash
git add app/(app)/teams/[teamId]/page.tsx
git commit -m "feat: add Reviews Managed KPI card to dashboard"
```

---

### Task 5: Reframe billing page credit display

**Files:**
- Modify: `app/(app)/teams/[teamId]/billing/page.tsx:301-324`

**Step 1: Update the credit balance card to show usage framing**

Replace lines 301-324 with:

```typescript
{/* Monthly Usage */}
<div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl shadow-sm p-6 text-white">
  <h2 className="text-lg font-semibold mb-4 opacity-90">Monthly Usage</h2>
  <div className="text-5xl font-bold mb-2">{billing?.creditBalance || 0}</div>
  <div className="opacity-80">
    of {billing?.subscription?.monthly_credits || 5} replies remaining this month
  </div>

  {billing?.topupProducts && billing.topupProducts.length > 0 && (
    <div className="mt-6">
      <div className="text-sm opacity-80 mb-2">Need more replies?</div>
      <div className="flex gap-2">
        {billing.topupProducts.map(product => (
          <button
            key={product.id}
            onClick={() => handleTopup(product.stripe_price_id)}
            disabled={actionLoading === product.stripe_price_id}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {actionLoading === product.stripe_price_id ? '...' : `+${product.credits}`}
          </button>
        ))}
      </div>
    </div>
  )}
</div>
```

**Step 2: Update PLANS feature text to say "reviews/month" instead of "credits/month"**

Change the PLANS array (lines 27-57) feature strings:

- `'5 credits/month'` → `'5 reviews/month'`
- `'50 credits/month'` → `'50 reviews/month'`
- `'200 credits/month'` → `'200 reviews/month'`
- `'1,000 credits/month'` → `'1,000 reviews/month'`

**Step 3: Commit**

```bash
git add app/(app)/teams/[teamId]/billing/page.tsx
git commit -m "feat: reframe billing page from credits to monthly usage"
```

---

### Task 6: Create UpgradeLimitModal component

**Files:**
- Create: `components/UpgradeLimitModal.tsx`

**Step 1: Create the modal component**

```typescript
'use client'

import { useRouter } from 'next/navigation'

interface UpgradeLimitModalProps {
  teamId: string
  reviewsManaged: number
  onClose: () => void
}

export function UpgradeLimitModal({ teamId, reviewsManaged, onClose }: UpgradeLimitModalProps) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          You&apos;ve reached your monthly reply limit
        </h2>
        <p className="text-gray-500 mb-6">
          You&apos;ve managed <span className="font-semibold text-teal-600">{reviewsManaged}</span> reviews so far!
          Upgrade your plan to reply to more reviews each month.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onClose()
              router.push(`/teams/${teamId}/billing`)
            }}
            className="w-full px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-all duration-200 cursor-pointer active:scale-[0.98]"
          >
            Upgrade Plan
          </button>
          <button
            onClick={onClose}
            className="w-full px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/UpgradeLimitModal.tsx
git commit -m "feat: add UpgradeLimitModal component for reply limit upsell"
```

---

### Task 7: Wire UpgradeLimitModal into the reviews UI

**Files:**
- Modify: The component that handles reply posting in the UI (likely in `components/ReviewsView.tsx` or wherever the "Post reply" button lives)

**Step 1: Find where post-reply is called from the UI**

Search for fetch calls to `/api/reviews/` with `post-reply` or `publish` in the components directory. The modal should be triggered when the API returns a 402 or an error containing "Insufficient credits".

**Step 2: Add modal state and trigger**

In the component that calls the post-reply API, add:

```typescript
import { UpgradeLimitModal } from '@/components/UpgradeLimitModal'

// State
const [showUpgradeModal, setShowUpgradeModal] = useState(false)
```

**Step 3: Catch insufficient credits in the post handler**

In the error handler for the post-reply API call, add:

```typescript
if (error.message?.includes('Insufficient credits') || response.status === 402) {
  setShowUpgradeModal(true)
  return
}
```

**Step 4: Render the modal**

Add at the bottom of the component's return:

```typescript
{showUpgradeModal && (
  <UpgradeLimitModal
    teamId={teamId}
    reviewsManaged={reviewsManaged}
    onClose={() => setShowUpgradeModal(false)}
  />
)}
```

**Step 5: Verify by testing with 0 credits**

Expected: Clicking "Post reply" with 0 credits shows the upgrade modal instead of a generic error.

**Step 6: Commit**

```bash
git add components/ReviewsView.tsx  # or wherever the integration is
git commit -m "feat: wire UpgradeLimitModal into review reply flow"
```

---

### Task 8: Remove "3 credits" label from dashboard Quick Actions

**Files:**
- Modify: `app/(app)/teams/[teamId]/page.tsx:483`

**Step 1: Remove the `sub` prop from the "Run insights" quick action**

Change line 479-484:

```typescript
<QuickAction
  label="Run insights"
  icon={<InsightsIcon />}
  onClick={() => router.push(`/teams/${teamId}/insights`)}
  sub="3 credits"
/>
```

to:

```typescript
<QuickAction
  label="Run insights"
  icon={<InsightsIcon />}
  onClick={() => router.push(`/teams/${teamId}/insights`)}
/>
```

**Step 2: Commit**

```bash
git add app/(app)/teams/[teamId]/page.tsx
git commit -m "chore: remove credit cost label from dashboard quick actions"
```
