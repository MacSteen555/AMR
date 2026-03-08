# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (also runs linting + type checking)
npm run lint         # ESLint
npm run test         # Jest (no jest.config yet — needs setup)
npm run stripe       # Forward Stripe webhooks to localhost via CLI
```

## Architecture

**AutoMyReply** — a multi-tenant SaaS for managing Google Business Profile reviews with AI-generated replies.

**Stack:** Next.js 14 (App Router), TypeScript, Supabase (Postgres + RLS + Auth), OpenAI, Stripe, Resend, Upstash Redis.

**Path alias:** `@/*` maps to project root (`@/lib/auth/session`, `@/components/AppShell`).

### Data Model

Users → Teams → Locations → Reviews. Teams own subscriptions and credit balances. Locations have brand voice settings. Reviews flow: sync → draft → edit → post.

All tables live in the `app` schema (e.g., `app.users`, `app.teams`, `app.google_reviews`). Single migration file at `supabase/migrations/`.

### Request Flow

1. All `/api/*` requests hit `middleware.ts` first (rate limiting via Upstash Redis, 5 tiers)
2. API route handler runs: auth → RBAC → validate → execute → respond
3. Stripe webhook bypasses rate limiting

### API Route Handler Pattern

Every route follows this structure:

```typescript
import { requireUser } from '@/lib/auth/session'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const user = await requireUser()                    // Auth check
    await requireTeamMember(params.teamId)              // RBAC check
    const body = someZodSchema.parse(await request.json()) // Validate
    const serviceClient = createSupabaseServiceRoleClient()
    // ... business logic
    return NextResponse.json({ data })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

### Two Supabase Clients

- `createSupabaseServerClient()` — uses session cookies, enforces RLS. Use for user-scoped queries.
- `createSupabaseServiceRoleClient()` — bypasses RLS. Use only for webhooks, system operations, cross-tenant reads during RBAC checks.

### Auth

Google OAuth 2.0 with PKCE flow → Supabase session. `requireUser()` returns an `AppUser` or throws. `requireTeamMember()` / `requireTeamAdmin()` / `requireLocationAccess()` handle RBAC.

### Credit System

Operations cost credits (1 for drafts, 3 for insights, 5 for competitive analysis). `spendCredits()` in `lib/billing/credits.ts` atomically checks tier, balance, and deducts. Uses `Idempotency-Key` header to prevent double-charging. A database trigger auto-updates the balance table on transaction insert.

### Rate Limiting

`middleware.ts` classifies routes into 5 tiers: `strict` (10/min), `quick-ai` (40/min), `large-ai` (5/min), `write` (30/min), `read` (60/min). Keys by user ID (authenticated) or IP (anonymous). Skips when Upstash env vars are missing (local dev).

### Error Monitoring

Sentry (`@sentry/nextjs`) auto-captures unhandled errors. Use `captureRouteError()` from `lib/sentry.ts` to attach userId/teamId/route context in catch blocks.

### Validation

All input validation uses Zod. Schemas live in `lib/validation/schemas.ts`.

### Key Directories

- `app/(app)/` — authenticated pages (wrapped in AppShell layout)
- `app/api/` — ~56 API route handlers
- `lib/auth/` — session helpers, Google OAuth
- `lib/billing/` — credit system, tier checks
- `lib/openai/` — AI draft generation and insights
- `lib/google/` — Google Business Profile API, Places API
- `lib/stripe/` — checkout, webhook handler
- `lib/rbac.ts` — role and location access checks
- `components/` — AppShell, PostHogProvider, ReviewsView, Toast

### Security

- AES-256-GCM encryption for Google refresh tokens (`lib/crypto/encrypt.ts`)
- RLS on all tables for tenant isolation
- Security headers (CSP, HSTS, X-Frame-Options) in `next.config.js`
- Google token refresh handled in `lib/google/auth.ts`
