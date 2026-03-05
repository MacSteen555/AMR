# AutoMyReply

> AI-powered Google Business Profile review management — generate professional, on-brand replies in seconds.

AutoMyReply is a full-stack SaaS application that helps businesses respond to Google reviews with AI-generated replies. It supports multi-tenant teams, location-level brand voice customization, competitive intelligence, and credit-based billing via Stripe.

## Features

- **AI Reply Generation** — Context-aware, brand-voice-aligned replies to positive, neutral, and negative reviews
- **Google Integration** — OAuth-based sync with Google Business Profile; post replies directly back to Google
- **Team Collaboration** — Multi-tenant teams with role-based access (admin / member), email invitations via Resend
- **Multi-Location** — Import and manage multiple locations per team, each with its own brand voice settings
- **AI Insights** — Location-level and team-level trend analysis with actionable recommendations
- **Competitive Intelligence** — Track competitor reviews via SerpAPI, run competitive analysis reports
- **Credit-Based Billing** — Stripe-powered subscriptions (Free / Pro / Business / Enterprise) with credit top-ups
- **Idempotent Operations** — Safe retry logic for all credit-consuming API calls
- **Onboarding Wizard** — Guided setup for new users (brand voice extraction, sample review generation)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase Postgres with Row-Level Security |
| Auth | Supabase Auth + Google OAuth |
| AI | OpenAI GPT |
| Payments | Stripe (subscriptions + one-time top-ups) |
| Email | Resend |
| APIs | Google My Business, Google Places, SerpAPI |
| Validation | Zod |

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── login/                      # Google OAuth login
├── invites/[token]/            # Team invite acceptance
├── (app)/                      # Authenticated route group (AppShell layout)
│   ├── layout.tsx              # Persistent AppShell wrapper
│   ├── dashboard/              # Dashboard / redirect
│   ├── teams/                  # Team management, creation
│   ├── settings/               # User settings
│   └── locations/              # Location management & reviews
├── api/
│   ├── auth/                   # Google OAuth start + callback
│   ├── me/                     # Current user info
│   ├── teams/                  # CRUD, members, invites, leave
│   ├── invites/                # Validate + accept invite tokens
│   ├── locations/              # Settings, reviews, access
│   ├── reviews/                # Draft generation, posting
│   ├── competitors/            # Competitor tracking
│   ├── google/                 # Places search, entitlements
│   ├── onboarding/             # Brand voice, sample reviews
│   └── stripe/                 # Webhook handler
components/
├── AppShell.tsx                # Sidebar nav, team switcher
lib/
├── auth/                       # Session helpers
├── api.ts                      # Typed fetch wrapper
├── rbac.ts                     # Role-based access control
├── email/                      # Resend integration + templates
└── supabase/                   # Client factories
```

## Prerequisites

- Node.js 18+
- Supabase project with migrations applied
- Google Cloud project with OAuth credentials + Business Profile API enabled
- Stripe account with webhook configured
- OpenAI API key
- SerpAPI key
- Resend API key (for team invitation emails)

## Environment Variables

Create a `.env.local` file:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Maps
GOOGLE_MAPS_API_KEY=your-maps-api-key
PLACES_API_URL=https://places.googleapis.com/v1/places:searchText

# SerpAPI
SERP_API_KEY=your-serpapi-key

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=AutoMyReply <noreply@yourdomain.com>

# Token Encryption
TOKEN_ENCRYPTION_SECRET=your-32-char-secret-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

### 1. Repository Setup

```bash
# Clone the repository
git clone <repository-url>
cd AMR-Backend_Experiments

# Install dependencies
npm install
```

### 2. Local Supabase Setup
This project uses the Supabase CLI for local development and database migrations.

```bash
# Start the local Supabase stack (Database, Auth, Storage, Studio)
npx supabase start
```
*Note: This will automatically apply all migrations in `supabase/migrations` to your local database.*

After starting, you will see local URLs in your terminal, such as:
- **Studio (Local DB Dashboard):** `http://127.0.0.1:54323`
- **Edges & API:** `http://127.0.0.1:54321`

### 3. Environment Variables
Create a `.env.local` file for your local environment overrides. The local Supabase stack uses standard local keys:

```bash
# .env.local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # (Get from `npx supabase status` output)
```
*(Leave your production API keys in `.env`)*

### 4. Run the Application

```bash
# Start the Next.js development server
npm run dev
```

### Supabase Workflow Commands
- `npx supabase migration new <name>`: Create a new database migration.
- `npx supabase db reset`: Reset your local database and re-apply all migrations.
- `npx supabase db push`: Push local migrations to the production remote database.

## API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/me` | Current user + teams |
| `GET` | `/api/auth/google/start` | Start Google OAuth flow |
| `GET` | `/api/auth/google/callback` | OAuth callback handler |

### Teams
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/teams` | List user's teams |
| `POST` | `/api/teams` | Create a team |
| `GET` | `/api/teams/:id` | Get team details |
| `GET` | `/api/teams/:id/members` | List team members |
| `PATCH` | `/api/teams/:id/members/:userId` | Update member role |
| `POST` | `/api/teams/:id/invites` | Send team invitation email |
| `DELETE` | `/api/teams/:id/invites/:inviteId` | Revoke pending invite |
| `POST` | `/api/teams/:id/leave` | Leave a team |

### Invitations
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/invites/validate?token=xxx` | Validate invite token (public) |
| `POST` | `/api/invites/accept` | Accept invite (authenticated) |

### Locations
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/google/entitlements/locations` | List accessible Google locations |
| `POST` | `/api/teams/:id/locations/import` | Import locations to team |
| `GET` | `/api/teams/:id/locations` | List team locations |
| `PATCH` | `/api/locations/:id/settings` | Update location settings/brand voice |
| `POST` | `/api/locations/:id/access` | Grant location access to member |

### Reviews
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/locations/:id/reviews/sync` | Sync reviews from Google |
| `GET` | `/api/locations/:id/reviews` | List location reviews |
| `GET` | `/api/teams/:id/reviews` | List all team reviews |
| `POST` | `/api/reviews/:id/draft` | Generate AI draft reply (1 credit) |
| `PATCH` | `/api/reviews/:id/draft` | Edit draft |
| `POST` | `/api/reviews/:id/post-reply` | Post reply to Google |

### Insights & Competitive Analysis
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/locations/:id/insights/run` | Run location insights (3 credits, PRO+) |
| `GET` | `/api/locations/:id/insights` | List location insights |
| `POST` | `/api/teams/:id/insights/run` | Run team insights (3 credits, BUSINESS+) |
| `GET` | `/api/teams/:id/insights` | List team insights |
| `POST` | `/api/teams/:id/competitive-runs` | Run competitive analysis (5 credits, BUSINESS+) |
| `GET` | `/api/teams/:id/competitive-runs` | List competitive runs |

### Billing
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/teams/:id/billing` | Get billing info + credits |
| `POST` | `/api/teams/:id/billing/checkout` | Create Stripe checkout session |
| `POST` | `/api/teams/:id/billing/topup` | Create credit top-up checkout |
| `POST` | `/api/teams/:id/billing/portal` | Create Stripe customer portal session |
| `POST` | `/api/stripe/webhook` | Stripe webhook handler |

## Credit System

| Operation | Cost | Required Tier |
|-----------|------|--------------|
| Draft Reply (generate/regenerate) | 1 credit | Free+ |
| Location Insights | 3 credits | Pro+ |
| Team Insights | 3 credits | Business+ |
| Competitive Analysis | 5 credits | Business+ |

All credit-consuming endpoints support idempotency via the `Idempotency-Key` header.

## Database

- **Schema**: `app` for application tables, `authz` for RLS helper functions
- **Extensions**: `citext` (case-insensitive emails)
- **Security**: AES-256-GCM encryption for Google refresh tokens (Node.js `crypto`, not pgcrypto)
- **RLS**: Row-Level Security policies enforce data isolation at the database level

## Deployment

1. Set all environment variables on your hosting platform
2. Apply database migrations to Supabase
3. Configure Stripe webhook endpoint: `https://your-domain.com/api/stripe/webhook`
4. Set `NEXT_PUBLIC_APP_URL` to your production URL

```bash
npm run build
npm start
```

## Security

- Google refresh tokens encrypted with AES-256-GCM before storage
- RLS policies enforce tenant-level data isolation
- Service role client used only for webhooks and background operations
- All API routes validate authentication and RBAC authorization
- Sensitive data is never logged

## License

MIT
