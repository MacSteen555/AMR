# Review Digest Email — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send daily/weekly email digests to team members summarizing new reviews, with tier-gated frequency options and self-serve preferences.

**Architecture:** Two columns added to `team_memberships` for preference storage. A Vercel Cron job hits `/api/cron/review-digest` daily at 9am UTC, which queries all due digests, builds HTML emails from a template, and sends via Resend. Users manage their preference from the teams page UI. A tokenized unsubscribe link in the email footer allows one-click opt-out without login.

**Tech Stack:** Next.js API routes, Supabase (Postgres), Resend email, Vercel Cron, Node.js `crypto` for unsubscribe tokens.

**Design doc:** `docs/plans/2026-03-12-review-digest-email-design.md`

---

### Task 1: Database Migration — Add digest columns to team_memberships

**Files:**
- Create: `supabase/migrations/20260312000000_add_digest_columns.sql`

**Step 1: Write the migration**

```sql
-- Add digest preference columns to team_memberships
ALTER TABLE "app"."team_memberships"
  ADD COLUMN "digest_frequency" text NOT NULL DEFAULT 'off',
  ADD COLUMN "digest_last_sent_at" timestamp with time zone;

-- Add check constraint for valid values
ALTER TABLE "app"."team_memberships"
  ADD CONSTRAINT "team_memberships_digest_frequency_check"
  CHECK ("digest_frequency" IN ('off', 'daily', 'weekly'));

-- Index for cron query efficiency: find all active digest subscriptions
CREATE INDEX "idx_team_memberships_digest_active"
  ON "app"."team_memberships" ("digest_frequency")
  WHERE "digest_frequency" != 'off';
```

**Step 2: Apply migration locally**

Run: `npx supabase db push` (or apply via Supabase dashboard)
Expected: Migration applies successfully, no errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260312000000_add_digest_columns.sql
git commit -m "feat: add digest_frequency and digest_last_sent_at to team_memberships"
```

---

### Task 2: Digest Preference API — GET/PATCH endpoint

**Files:**
- Create: `app/api/teams/[teamId]/digest-preference/route.ts`

**Step 1: Create the GET and PATCH handlers**

```typescript
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await requireUser()
    await requireTeamMember(params.teamId)

    const supabase = createSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .schema('app')
      .from('team_memberships')
      .select('digest_frequency, digest_last_sent_at')
      .eq('team_id', params.teamId)
      .eq('user_id', user.id)
      .single()

    if (error) throw new Error(`Failed to fetch digest preference: ${error.message}`)

    return NextResponse.json({
      frequency: data.digest_frequency,
      lastSentAt: data.digest_last_sent_at,
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/digest-preference', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const user = await requireUser()
    await requireTeamMember(params.teamId)

    const body = await request.json()
    const { frequency } = body

    if (!['off', 'daily', 'weekly'].includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency. Must be off, daily, or weekly.' }, { status: 400 })
    }

    // Tier gate: check if the team's subscription allows the requested frequency
    if (frequency !== 'off') {
      const supabase = createSupabaseServiceRoleClient()
      const { data: sub } = await supabase
        .schema('app')
        .from('team_subscriptions')
        .select('tier')
        .eq('team_id', params.teamId)
        .single()

      const tier = sub?.tier || 'FREE'

      if (tier === 'FREE') {
        return NextResponse.json({ error: 'Email digests are not available on the Free plan.' }, { status: 403 })
      }
      if (frequency === 'daily' && !['BUSINESS', 'ENTERPRISE'].includes(tier)) {
        return NextResponse.json({ error: 'Daily digests require a Business or Enterprise plan.' }, { status: 403 })
      }
    }

    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase
      .schema('app')
      .from('team_memberships')
      .update({ digest_frequency: frequency })
      .eq('team_id', params.teamId)
      .eq('user_id', user.id)

    if (error) throw new Error(`Failed to update digest preference: ${error.message}`)

    return NextResponse.json({ frequency })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/teams/[teamId]/digest-preference', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add app/api/teams/\[teamId\]/digest-preference/route.ts
git commit -m "feat: add GET/PATCH endpoint for digest preference"
```

---

### Task 3: Unsubscribe Token Utility

**Files:**
- Create: `lib/email/digest-token.ts`

**Step 1: Create the token signing/verification utility**

Uses the existing `TOKEN_ENCRYPTION_SECRET` env var from `lib/crypto/encrypt.ts`.

```typescript
import crypto from 'crypto'

const SECRET = process.env.TOKEN_ENCRYPTION_SECRET!

interface DigestTokenPayload {
  userId: string
  teamId: string
}

/**
 * Creates a signed, URL-safe unsubscribe token.
 * Format: base64url(JSON payload + "." + HMAC signature)
 */
export function createUnsubscribeToken(payload: DigestTokenPayload): string {
  const data = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64url')
  const token = Buffer.from(`${data}.${signature}`).toString('base64url')
  return token
}

/**
 * Verifies and decodes an unsubscribe token.
 * Returns the payload if valid, null if tampered.
 */
export function verifyUnsubscribeToken(token: string): DigestTokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot === -1) return null

    const data = decoded.slice(0, lastDot)
    const signature = decoded.slice(lastDot + 1)

    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(data)
      .digest('base64url')

    if (signature !== expectedSig) return null

    return JSON.parse(data) as DigestTokenPayload
  } catch {
    return null
  }
}
```

**Step 2: Commit**

```bash
git add lib/email/digest-token.ts
git commit -m "feat: add signed token utility for digest unsubscribe"
```

---

### Task 4: Unsubscribe API Endpoint

**Files:**
- Create: `app/api/digest/unsubscribe/route.ts`

**Step 1: Create the unsubscribe handler**

```typescript
import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/digest-token'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid or has been tampered with.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .schema('app')
    .from('team_memberships')
    .update({ digest_frequency: 'off' })
    .eq('user_id', payload.userId)
    .eq('team_id', payload.teamId)

  if (error) {
    return new NextResponse(renderPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new NextResponse(
    renderPage('Unsubscribed', 'You have been unsubscribed from review digest emails for this team. You can re-enable them from your team settings at any time.'),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — AutoMyReply</title></head>
<body style="margin:0;padding:60px 20px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">${title}</h1>
    <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`
}
```

**Step 2: Commit**

```bash
git add app/api/digest/unsubscribe/route.ts
git commit -m "feat: add one-click unsubscribe endpoint for digest emails"
```

---

### Task 5: Email Template — Review Digest

**Files:**
- Create: `lib/email/templates/review-digest.ts`

**Step 1: Create the HTML email template**

Follow the exact same HTML structure as `lib/email/templates/team-invite.ts` (table-based layout, teal gradient header, white card body, gray footer).

```typescript
interface DigestReview {
  reviewerName: string
  rating: number
  comment: string
  locationName: string
  replyStatus: string
}

interface ReviewDigestEmailParams {
  teamName: string
  newReviewCount: number
  needsReplyCount: number
  avgRating: string
  reviews: DigestReview[]
  teamUrl: string
  unsubscribeUrl: string
}

export function buildReviewDigestEmail(params: ReviewDigestEmailParams): { subject: string; html: string } {
  const { teamName, newReviewCount, needsReplyCount, avgRating, reviews, teamUrl, unsubscribeUrl } = params

  const subject = `AutoMyReply — ${newReviewCount} new review${newReviewCount !== 1 ? 's' : ''} for ${teamName}`

  const starHtml = (rating: number) => {
    return [1, 2, 3, 4, 5]
      .map(s => `<span style="color:${s <= rating ? '#f59e0b' : '#d1d5db'};font-size:14px;">★</span>`)
      .join('')
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
      none: { bg: '#fef3c7', text: '#92400e', label: 'Needs Reply' },
      draft: { bg: '#e0f2fe', text: '#075985', label: 'Draft Ready' },
      posted: { bg: '#d1fae5', text: '#065f46', label: 'Replied' },
      dismissed: { bg: '#f3f4f6', text: '#6b7280', label: 'Dismissed' },
    }
    const c = colors[status] || colors.none
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${c.bg};color:${c.text};">${c.label}</span>`
  }

  const truncate = (text: string, len: number) =>
    text.length > len ? text.slice(0, len).trim() + '…' : text

  const reviewRows = reviews.slice(0, 15).map(r => `
    <tr>
      <td style="padding:16px 20px;border-bottom:1px solid #f3f4f6;">
        <div style="margin-bottom:6px;">
          ${starHtml(r.rating)}
          <span style="margin-left:8px;color:#9ca3af;font-size:12px;">${r.locationName}</span>
          <span style="float:right;">${statusBadge(r.replyStatus)}</span>
        </div>
        <div style="color:#374151;font-size:14px;font-weight:600;margin-bottom:4px;">${r.reviewerName}</div>
        <div style="color:#6b7280;font-size:13px;line-height:1.5;">${truncate(r.comment || 'No comment', 120)}</div>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Review Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                AutoMyReply
              </h1>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <h2 style="margin:0 0 4px 0;color:#111827;font-size:20px;font-weight:700;">
                ${newReviewCount} new review${newReviewCount !== 1 ? 's' : ''}
              </h2>
              <p style="margin:0 0 20px 0;color:#6b7280;font-size:14px;">
                for <strong style="color:#374151;">${teamName}</strong>
              </p>

              <!-- Stats Row -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#111827;font-size:20px;font-weight:700;">${newReviewCount}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">New</div>
                  </td>
                  <td style="width:8px;"></td>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#d97706;font-size:20px;font-weight:700;">${needsReplyCount}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">Needs Reply</div>
                  </td>
                  <td style="width:8px;"></td>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#111827;font-size:20px;font-weight:700;">${avgRating}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">Avg Rating</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Review List -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${reviewRows}
              </table>
              ${reviews.length > 15 ? `<p style="margin:12px 0 0;color:#9ca3af;font-size:13px;text-align:center;">and ${reviews.length - 15} more...</p>` : ''}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 40px 36px;text-align:center;">
              <a href="${teamUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                Open in AutoMyReply
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 8px 0;color:#9ca3af;font-size:12px;">
                Sent by <strong>AutoMyReply</strong> &middot; Automated Review Management
              </p>
              <p style="margin:0;color:#d1d5db;font-size:11px;">
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${teamUrl}" style="color:#9ca3af;text-decoration:underline;">Manage preferences</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html }
}
```

**Step 2: Commit**

```bash
git add lib/email/templates/review-digest.ts
git commit -m "feat: add review digest HTML email template"
```

---

### Task 6: Cron Endpoint — Review Digest Sender

**Files:**
- Create: `app/api/cron/review-digest/route.ts`

**Step 1: Create the cron handler**

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { buildReviewDigestEmail } from '@/lib/email/templates/review-digest'
import { createUnsubscribeToken } from '@/lib/email/digest-token'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceRoleClient()
  const now = new Date()
  const isMonday = now.getUTCDay() === 1

  // Fetch all active digest preferences with user + team + subscription data
  const { data: preferences, error: prefError } = await supabase
    .schema('app')
    .from('team_memberships')
    .select(`
      user_id,
      team_id,
      digest_frequency,
      digest_last_sent_at,
      created_at,
      user:users(email, display_name),
      team:teams(name, deleted_at)
    `)
    .neq('digest_frequency', 'off')

  if (prefError || !preferences) {
    return NextResponse.json({ error: 'Failed to fetch preferences', details: prefError?.message }, { status: 500 })
  }

  // Filter: daily runs every day, weekly runs on Mondays only
  const duePreferences = preferences.filter((p: any) => {
    if (p.team?.deleted_at) return false
    if (p.digest_frequency === 'daily') return true
    if (p.digest_frequency === 'weekly') return isMonday
    return false
  })

  // Verify tiers in bulk
  const teamIds = [...new Set(duePreferences.map((p: any) => p.team_id))]
  const { data: subscriptions } = await supabase
    .schema('app')
    .from('team_subscriptions')
    .select('team_id, tier')
    .in('team_id', teamIds)

  const tierMap = new Map((subscriptions || []).map((s: any) => [s.team_id, s.tier]))

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const pref of duePreferences) {
    const p = pref as any
    const tier = tierMap.get(p.team_id) || 'FREE'

    // Tier gate: FREE gets nothing, PRO gets weekly only
    if (tier === 'FREE') { skipped++; continue }
    if (p.digest_frequency === 'daily' && !['BUSINESS', 'ENTERPRISE'].includes(tier)) { skipped++; continue }

    try {
      // Query new reviews since last digest (or since membership creation)
      const since = p.digest_last_sent_at || p.created_at
      const { data: reviews } = await supabase
        .schema('app')
        .from('google_reviews')
        .select('reviewer_name, rating, comment, reply_status, location:locations(name)')
        .eq('location.team_id', p.team_id)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!reviews || reviews.length === 0) { skipped++; continue }

      // Filter out reviews where location join failed (null)
      const validReviews = reviews.filter((r: any) => r.location)

      if (validReviews.length === 0) { skipped++; continue }

      const needsReply = validReviews.filter((r: any) => r.reply_status === 'none').length
      const avgRating = (validReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / validReviews.length).toFixed(1)

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://automyreply.com'
      const teamUrl = `${appBaseUrl}/teams/${p.team_id}/reviews`
      const unsubToken = createUnsubscribeToken({ userId: p.user_id, teamId: p.team_id })
      const unsubscribeUrl = `${appBaseUrl}/api/digest/unsubscribe?token=${unsubToken}`

      const { subject, html } = buildReviewDigestEmail({
        teamName: p.team?.name || 'Your Team',
        newReviewCount: validReviews.length,
        needsReplyCount: needsReply,
        avgRating,
        reviews: validReviews.map((r: any) => ({
          reviewerName: r.reviewer_name,
          rating: r.rating,
          comment: r.comment || '',
          locationName: r.location?.name || 'Unknown',
          replyStatus: r.reply_status,
        })),
        teamUrl,
        unsubscribeUrl,
      })

      await sendEmail({ to: p.user?.email, subject, html })

      // Update last_sent_at
      await supabase
        .schema('app')
        .from('team_memberships')
        .update({ digest_last_sent_at: now.toISOString() })
        .eq('user_id', p.user_id)
        .eq('team_id', p.team_id)

      sent++
    } catch (err: any) {
      errors.push(`${p.user_id}/${p.team_id}: ${err.message}`)
    }
  }

  return NextResponse.json({ sent, skipped, errors: errors.length > 0 ? errors : undefined })
}
```

**Step 2: Commit**

```bash
git add app/api/cron/review-digest/route.ts
git commit -m "feat: add cron endpoint for sending review digest emails"
```

---

### Task 7: Vercel Cron Configuration

**Files:**
- Create: `vercel.json`

**Step 1: Create the Vercel cron config**

```json
{
  "crons": [
    {
      "path": "/api/cron/review-digest",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs daily at 9:00 AM UTC. The endpoint itself handles daily vs. weekly logic internally.

**Step 2: Add `CRON_SECRET` to environment variables**

Add to `.env.local` for local testing:
```
CRON_SECRET=local-dev-cron-secret
```

Add to `.env.example` for documentation:
```
CRON_SECRET=            # Secret for Vercel Cron auth (auto-set by Vercel)
```

Note: Vercel automatically sets `CRON_SECRET` and sends it as `Authorization: Bearer <secret>` for cron jobs.

**Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "feat: add Vercel Cron config for daily digest at 9am UTC"
```

---

### Task 8: Members API — Include digest_frequency in response

**Files:**
- Modify: `app/api/teams/[teamId]/members/route.ts`

**Step 1: Update the members endpoint to return digest_frequency**

In the select query, `digest_frequency` is already on the `team_memberships` row (the `*` in `.select('*, user:users(...)')` includes it). Just add it to the mapped response:

Change the mapping (line 21-28) from:

```typescript
const members = (memberships || []).map((m: any) => ({
  id: m.user.id,
  email: m.user.email,
  display_name: m.user.display_name,
  avatar_url: m.user.avatar_url,
  role: m.role,
  joined_at: m.created_at,
}))
```

To:

```typescript
const members = (memberships || []).map((m: any) => ({
  id: m.user.id,
  email: m.user.email,
  display_name: m.user.display_name,
  avatar_url: m.user.avatar_url,
  role: m.role,
  joined_at: m.created_at,
  digest_frequency: m.digest_frequency,
}))
```

**Step 2: Commit**

```bash
git add app/api/teams/\[teamId\]/members/route.ts
git commit -m "feat: include digest_frequency in members API response"
```

---

### Task 9: Teams Page UI — Digest Preference Dropdown

**Files:**
- Modify: `app/(app)/teams/page.tsx`

**Step 1: Update the Member interface**

At the top of the file (around line 33), add `digest_frequency` to the `Member` interface:

```typescript
interface Member {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: string
  digest_frequency?: string
}
```

**Step 2: Add state and handler for digest preference**

Add a handler function in the component (near the other team action handlers):

```typescript
const handleDigestChange = async (teamId: string, frequency: string) => {
  try {
    await apiPatch(`/api/teams/${teamId}/digest-preference`, { frequency })
    // Update local member state to reflect the change
    setMembers(prev => prev.map(m =>
      m.id === user?.id ? { ...m, digest_frequency: frequency } : m
    ))
    setToast({ message: `Digest set to ${frequency}`, type: 'success' })
  } catch (err: any) {
    setToast({ message: err.message || 'Failed to update digest preference', type: 'error' })
  }
}
```

Note: You'll need access to `user` from `useAuth()`. The teams page already destructures `const { teams, loading } = useAuth()` — update it to also get `user`:

```typescript
const { user, teams, loading } = useAuth()
```

**Step 3: Add the digest dropdown to the current user's member row**

In the members list (around line 654-686), add a digest dropdown after the role badge, but only for the current user's own row. Find the `<div className="flex items-center gap-2">` block inside the member map and update it:

```typescript
<div className="flex items-center gap-2">
  {/* Digest preference — only show for the current user */}
  {member.id === user?.id && selectedTeamId && (
    <select
      value={member.digest_frequency || 'off'}
      onChange={(e) => handleDigestChange(selectedTeamId, e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
    >
      <option value="off">Digest: Off</option>
      {(() => {
        const team = teams.find(t => t.id === selectedTeamId)
        const tier = team?.subscription?.tier || 'FREE'
        const canWeekly = tier !== 'FREE'
        const canDaily = ['BUSINESS', 'ENTERPRISE'].includes(tier)
        return (
          <>
            <option value="weekly" disabled={!canWeekly}>
              {canWeekly ? 'Weekly' : 'Weekly (PRO+)'}
            </option>
            <option value="daily" disabled={!canDaily}>
              {canDaily ? 'Daily' : 'Daily (Business+)'}
            </option>
          </>
        )
      })()}
    </select>
  )}
  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
    {member.role}
  </span>
  {isTeamAdmin && member.role !== 'admin' && (
    <button
      onClick={() => handlePromoteAdmin(member.id)}
      className="text-xs text-teal-600 hover:text-teal-800 underline px-2"
    >
      Make Admin
    </button>
  )}
</div>
```

**Step 4: Commit**

```bash
git add app/\(app\)/teams/page.tsx
git commit -m "feat: add digest preference dropdown to teams member list"
```

---

### Task 10: Add NEXT_PUBLIC_APP_URL to env

**Files:**
- Modify: `.env.example`

**Step 1: Add the app URL env var**

Add this line to `.env.example`:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Production: https://automyreply.com
```

Also add to `.env.local` for local dev.

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add NEXT_PUBLIC_APP_URL to env example"
```

---

### Task 11: Manual Testing Checklist

Run the dev server: `npm run dev`

**API tests (via curl or browser):**

1. **PATCH digest preference** — Set to weekly:
   ```
   PATCH /api/teams/{teamId}/digest-preference
   Body: { "frequency": "weekly" }
   Expected: 200 { "frequency": "weekly" }
   ```

2. **PATCH digest preference — tier gate** — Set to daily on PRO:
   ```
   PATCH /api/teams/{teamId}/digest-preference
   Body: { "frequency": "daily" }
   Expected: 403 { "error": "Daily digests require a Business or Enterprise plan." }
   ```

3. **GET digest preference:**
   ```
   GET /api/teams/{teamId}/digest-preference
   Expected: 200 { "frequency": "weekly", "lastSentAt": null }
   ```

4. **Cron endpoint** — Test locally:
   ```
   curl -H "Authorization: Bearer local-dev-cron-secret" http://localhost:3000/api/cron/review-digest
   Expected: 200 { "sent": N, "skipped": N }
   ```

5. **Unsubscribe** — Generate a token manually or trigger a digest, then click the unsubscribe link.
   Expected: HTML page saying "You have been unsubscribed..."

**UI tests:**
6. Open teams page → expand a team → find your member row → verify digest dropdown appears
7. Change digest to "weekly" → verify toast success
8. Change digest to "daily" on a FREE team → verify the option is disabled

**Step: Final commit**

```bash
git add -A
git commit -m "feat: review digest email service — complete implementation"
```
