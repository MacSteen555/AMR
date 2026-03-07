# Production Hardening Guide

Phase 1 production hardening for AutoMyReply. Covers rate limiting, error monitoring, and security headers.

---

## 1. Rate Limiting (Upstash Redis)

### How It Works

Every `/api/*` request passes through `middleware.ts` before reaching your route handler.

```
Request hits /api/*
  -> middleware.ts intercepts
  -> Classifies route into tier (strict / ai / write / read)
  -> Extracts user ID from Supabase session cookie (falls back to IP)
  -> Calls Upstash Redis: "has this key exceeded N requests in 60s?"
  -> YES -> returns 429 with Retry-After header
  -> NO  -> passes through, sets X-RateLimit-Remaining header
```

### Route Tiers

| Tier | Routes | Limit | Window | Rationale |
|------|--------|-------|--------|-----------|
| **strict** | `/api/auth/*`, `/api/onboarding/*` | 10 req | 60s | Auth abuse, brute force prevention |
| **quick-ai** | `*/generate`, `*/regenerate`, `*/stream` (POST) | 40 req | 60s | Single review drafts, 1 credit each |
| **large-ai** | `*/bulk-generate`, `*/insights/run`, `*/competitive-runs` (POST) | 5 req | 60s | Expensive batch operations, 3-5 credits each |
| **write** | All other POST/PATCH/DELETE | 30 req | 60s | General mutation protection |
| **read** | All GET requests | 60 req | 60s | Generous but bounded |

### Bypasses

- `/api/stripe/webhook` is excluded — Stripe retries on 429 and we don't want to miss payment events
- Rate limiting is skipped entirely when `UPSTASH_REDIS_REST_URL` is not set (local dev without Redis)

### Rate Limit Key

- **Authenticated requests**: keyed by Supabase user ID (`user:<userId>`)
- **Unauthenticated requests**: keyed by IP address (`ip:<x-forwarded-for>`)

### Response Headers

Every API response includes:
- `X-RateLimit-Limit` — max requests allowed in window
- `X-RateLimit-Remaining` — requests remaining

On rate limit exceeded (HTTP 429):
- `Retry-After` — seconds until the limit resets

### Files

- `middleware.ts` — route matching, tier classification, Redis client, rate limit enforcement

### Testing Locally

Keep your Upstash env vars in `.env`, then:

```bash
# Hit an auth endpoint 11 times — the 11th should return 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/google/start
done
```

Check rate limit headers on any request:

```bash
curl -I http://localhost:3000/api/teams
# Look for: X-RateLimit-Limit: 60, X-RateLimit-Remaining: 59
```

### Upstash Dashboard

Go to [console.upstash.com](https://console.upstash.com) -> your Redis database -> Analytics tab.

What to look for:
- Which prefixes (`rl:strict`, `rl:ai`, `rl:write`, `rl:read`) are getting hit
- If `rl:ai` is getting throttled often, users may need higher limits or the UX should batch requests
- If `rl:strict` is getting hammered from one IP, that's likely abuse

### Tuning Limits

Edit `lib/rate-limit.ts` to adjust. Current values are conservative for early-stage traffic. If real users hit 429s, increase the limits.

---

## 2. Error Monitoring (Sentry)

### How It Works

The `@sentry/nextjs` SDK wraps the app at build time via `withSentryConfig` in `next.config.js`. Three initialization points:

- `instrumentation.ts` — server-side and edge runtime (API routes, middleware)
- `instrumentation-client.ts` — client-side (React errors, browser JS)
- `app/global-error.tsx` — root-level React error boundary

Sentry is only active in production (`enabled: process.env.NODE_ENV === 'production'`).

### What Gets Captured Automatically

Without changing any route handler code:
- Unhandled exceptions in API routes (full stack trace + source maps)
- Client-side React rendering errors
- Unhandled promise rejections in the browser
- Root-level crashes via `global-error.tsx`

### Custom Context with `captureRouteError`

`lib/sentry.ts` exports a helper that attaches business context to errors:

```typescript
import { captureRouteError } from '@/lib/sentry'

// In any API route's catch block:
catch (error: any) {
  captureRouteError(error, {
    userId: user.id,
    teamId: teamId,
    route: '/api/reviews/[reviewId]/generate',
    extra: { reviewId: params.reviewId }
  })
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

This lets you search in Sentry by:
- `teamId:abc123` — all errors for a specific team
- `route:/api/stripe/webhook` — all webhook failures
- `user.id:xyz` — all errors for a specific user

Currently instrumented on:
- `app/api/stripe/webhook/route.ts` — captures payment-related errors with context

### Testing Sentry

Create a temporary test route:

```typescript
// app/api/test-sentry/route.ts (delete after testing)
export async function GET() {
  throw new Error('Sentry test - delete this route')
}
```

Hit `/api/test-sentry` on your production deployment. The error appears in your Sentry dashboard within ~10 seconds.

Sentry does not capture errors locally (dev mode) unless you remove the `enabled` check.

### Sentry Dashboard

Go to [sentry.io](https://sentry.io) -> your project.

**Issues page** — errors grouped by type. Check daily or set up alerts.

**Recommended alerts** (Settings -> Alerts -> Create Alert Rule):
- New issue on any route -> email notification
- Any error with >5 events in 10 minutes -> email (something broke badly)
- New issue matching `route:/api/stripe/webhook` -> email (payment failures are critical)

**Release tracking** — Sentry auto-detects Vercel deployments. You can see which deploy introduced which errors.

### Files

- `instrumentation.ts` — server + edge Sentry init
- `instrumentation-client.ts` — client Sentry init
- `lib/sentry.ts` — `captureRouteError` helper with userId/teamId/route context
- `app/global-error.tsx` — React error boundary with Sentry capture
- `next.config.js` — `withSentryConfig` wrapper for source map uploads

---

## 3. Security Headers

### How It Works

Security headers are defined in `next.config.js` via the `headers()` function. They're applied to every response (`/(.*)`). No dependencies required.

### Headers

| Header | Value | What It Prevents |
|--------|-------|-----------------|
| **Strict-Transport-Security** | `max-age=63072000; includeSubDomains; preload` | MITM attacks — browser forces HTTPS for 2 years |
| **X-Frame-Options** | `DENY` | Clickjacking — nobody can embed the app in an iframe |
| **X-Content-Type-Options** | `nosniff` | MIME confusion — browser won't execute CSS as JavaScript |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | URL leakage — internal URLs with team IDs/tokens don't leak to external sites |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` | Disables browser APIs the app doesn't need |
| **Content-Security-Policy** | See below | XSS — blocks scripts/resources from non-allowlisted domains |

### CSP Allowlist

The Content-Security-Policy restricts which domains can serve resources:

| Directive | Allowed Sources | Why |
|-----------|----------------|-----|
| `default-src` | `'self'` | Only own domain by default |
| `script-src` | `'self'`, `'unsafe-eval'`, `'unsafe-inline'`, `js.stripe.com`, `accounts.google.com`, `us.i.posthog.com` | Stripe.js, Google OAuth, PostHog |
| `style-src` | `'self'`, `'unsafe-inline'`, `fonts.googleapis.com` | Google Fonts, inline styles (Tailwind) |
| `font-src` | `'self'`, `fonts.gstatic.com` | Google Fonts files |
| `img-src` | `'self'`, `data:`, `https:`, `blob:` | User avatars, external images |
| `connect-src` | `'self'`, `*.supabase.co`, `wss://*.supabase.co`, `*.sentry.io`, `api.stripe.com`, `accounts.google.com`, `us.i.posthog.com` | API calls to all services |
| `frame-src` | `js.stripe.com`, `accounts.google.com` | Stripe checkout iframe, Google OAuth popup |
| `object-src` | `'none'` | Block Flash/Java plugins |

### The CSP Gotcha

If you add a new third-party service and it silently doesn't load, **check the browser console**. You'll see a CSP violation error like:

```
Refused to load the script 'https://cdn.example.com/widget.js'
because it violates the Content-Security-Policy directive: "script-src 'self' ..."
```

Fix it by adding the domain to the relevant CSP directive in `next.config.js`.

### Testing Headers

```bash
curl -I http://localhost:3000
# or after deploying:
curl -I https://your-app.vercel.app
```

Look for all 6 headers in the response.

Use [securityheaders.com](https://securityheaders.com) after deploying to get a grade (A through F). You should get an **A**.

---

## Environment Variables

Phase 1 added these variables:

| Variable | Where to Get It | Purpose |
|----------|----------------|---------|
| `UPSTASH_REDIS_REST_URL` | [console.upstash.com](https://console.upstash.com) -> Redis -> REST API | Rate limiting Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above | Rate limiting Redis auth |
| `NEXT_PUBLIC_SENTRY_DSN` | [sentry.io](https://sentry.io) -> Project Settings -> Client Keys | Tells SDK where to send errors |
| `SENTRY_AUTH_TOKEN` | Sentry -> Settings -> Auth Tokens | Source map uploads at build time |
| `SENTRY_ORG` | Sentry org slug (in URL) | Source map uploads |
| `SENTRY_PROJECT` | Sentry -> Settings -> Projects | Source map uploads |

Add these to your Vercel project: Settings -> Environment Variables.

---

## 4. Analytics (PostHog)

### How It Works

PostHog is initialized client-side via `components/PostHogProvider.tsx`, which wraps the app in `app/layout.tsx`. It only runs in production.

### What Gets Tracked Automatically

- Page views (`capture_pageview: true`)
- Page leaves (`capture_pageleave: true`)
- User sessions (identified users only — `person_profiles: 'identified_only'`)

### Files

- `components/PostHogProvider.tsx` — client component, initializes PostHog in production only
- `app/layout.tsx` — wraps `{children}` with `<PostHogProvider>`

### Environment Variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Your `phc_` project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |

### Identifying Users

To link PostHog sessions to your users (so you can see which user did what), call `posthog.identify()` after login:

```typescript
import posthog from 'posthog-js'

// After successful auth:
posthog.identify(user.id, {
  email: user.email,
  name: user.display_name,
})
```

This is optional but recommended — without it, PostHog tracks anonymous sessions only.

---

## Day-to-Day Workflow

1. **Deploy to Vercel** — everything activates automatically
2. **Check Sentry** daily for new issues (or set up email/Slack alerts)
3. **Check Upstash dashboard** weekly to see if rate limits need tuning
4. **If a user reports a bug** — search Sentry by their team ID
5. **If you add a new third-party service** — add its domain to the CSP in `next.config.js`
6. **If users complain about 429 errors** — increase limits in `middleware.ts` (`TIER_CONFIGS`)
7. **Check PostHog** for user behavior patterns and feature adoption

---

## Adding Sentry Context to More Routes

To get the most value from Sentry, add `captureRouteError` to catch blocks in your most critical routes. Priority order:

1. Billing routes (`/api/teams/[teamId]/billing/*`) — payment failures
2. Review generation (`/api/reviews/[reviewId]/generate`) — core feature
3. Google sync (`/api/locations/[locationId]/reviews/sync`) — data pipeline
4. Auth routes (`/api/auth/*`) — login failures

Example:

```typescript
import { captureRouteError } from '@/lib/sentry'

// In the catch block:
captureRouteError(error, {
  userId: user.id,
  teamId: params.teamId,
  route: '/api/teams/[teamId]/billing/checkout',
})
```
