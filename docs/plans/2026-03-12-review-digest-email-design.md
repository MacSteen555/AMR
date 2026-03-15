# Review Digest Email Service — Design

## Overview

A cron-triggered email digest that notifies team members about new reviews. Users self-serve their digest preference (daily/weekly/off) per team. Frequency options are tier-gated.

## Tier Gating

| Tier | Available Frequencies |
|------|----------------------|
| FREE | None (digest unavailable) |
| PRO | Weekly only |
| BUSINESS | Daily or weekly |
| ENTERPRISE | Daily or weekly |

## Data Model

Two new columns on `app.team_memberships`:

- `digest_frequency text DEFAULT 'off'` — values: `'daily'`, `'weekly'`, `'off'`
- `digest_last_sent_at timestamptz` — null until first digest is sent

No new tables. Preference is tied to team membership — if a user leaves a team, the preference is automatically removed.

## Email Content

**Subject:** `AutoMyReply — 4 new reviews for {teamName}`

**Body structure:**
1. Header — AutoMyReply branding (matches existing email templates)
2. Summary stats — new review count, needs-reply count, average rating of new reviews
3. Review list — each new review shows:
   - Reviewer name
   - Star rating (visual)
   - Location name
   - First ~100 characters of comment
   - Reply status badge (none / draft / posted)
4. CTA button — "Open in AutoMyReply" deep link to `/teams/{teamId}/reviews`
5. Footer — unsubscribe link (sets preference to `'off'`), manage preferences link

## Cron Endpoint

`GET /api/cron/review-digest` — protected by `CRON_SECRET` bearer token via `Authorization: Bearer {secret}`.

Called once daily at 9:00 AM UTC by Vercel Cron.

**Logic:**
1. Query `team_memberships` where `digest_frequency != 'off'`
2. For daily: select rows where `frequency = 'daily'`
3. For weekly: select rows where `frequency = 'weekly'` AND it's Monday (or `last_sent_at` is >7 days ago)
4. Join with `team_subscriptions` to verify tier still allows the frequency
5. For each eligible user-team pair, query `google_reviews` where `created_at > COALESCE(last_sent_at, team_memberships.created_at)`
6. Skip if zero new reviews
7. Build and send email via Resend (`lib/email/send.ts`)
8. Update `digest_last_sent_at` to now

**Downgrade handling:** If a team downgrades from BUSINESS to PRO, daily preferences are silently treated as weekly (cron skips them on non-Monday days). No data migration needed.

## User Settings UI

On the teams page, each member sees a digest dropdown in their team settings area:
- **Off** (default)
- **Weekly** (available for PRO+)
- **Daily** (available for BUSINESS+ only, disabled with tooltip otherwise)

Changes hit `PATCH /api/teams/{teamId}/digest-preference` which updates the authenticated user's `team_memberships` row.

## Unsubscribe Flow

Email footer contains a tokenized unsubscribe link: `/api/digest/unsubscribe?token={signedToken}`.

The token encodes `user_id` + `team_id` and is signed with a server secret. Clicking it sets `digest_frequency = 'off'` and shows a confirmation page. No login required (CAN-SPAM compliance).

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/teams/{teamId}/digest-preference` | Get current user's digest preference for this team |
| PATCH | `/api/teams/{teamId}/digest-preference` | Update preference (`{ frequency: 'daily' \| 'weekly' \| 'off' }`) |
| GET | `/api/cron/review-digest` | Cron handler — sends all due digests |
| GET | `/api/digest/unsubscribe?token=...` | One-click unsubscribe from email |

## New Files

- `supabase/migrations/..._add_digest_columns.sql` — ALTER team_memberships
- `lib/email/templates/review-digest.ts` — HTML email template
- `app/api/cron/review-digest/route.ts` — cron handler
- `app/api/teams/[teamId]/digest-preference/route.ts` — GET/PATCH preference
- `app/api/digest/unsubscribe/route.ts` — tokenized unsubscribe
- `vercel.json` — cron schedule config
- UI changes to teams page for digest preference dropdown
