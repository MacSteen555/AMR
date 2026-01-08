# AutoMyReply Backend

A Next.js backend for managing Google Business Profile reviews, generating AI-powered replies, and running competitive analysis.

## Features

- **Google OAuth Integration**: Secure authentication with Google Business Profile API access
- **Team-based Multi-tenancy**: Isolated teams with role-based access control
- **Review Management**: Sync and manage Google reviews with AI-generated draft replies
- **Competitive Intelligence**: Track competitor reviews via SerpAPI
- **AI Insights**: Generate insights and competitive analysis using OpenAI
- **Credit-based Billing**: Flexible credit system with Stripe subscriptions and top-ups
- **Idempotency**: Safe retry logic for credit-consuming operations

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase Postgres with RLS
- **Authentication**: Supabase Auth + Google OAuth
- **APIs**: Google My Business, Google Places, SerpAPI, OpenAI, Stripe
- **Language**: TypeScript
- **Validation**: Zod

## Prerequisites

- Node.js 18+
- Supabase project with migrations applied
- Google Cloud Project with OAuth credentials
- Stripe account
- OpenAI API key
- SerpAPI key

## Environment Variables

Create a `.env.local` file with the following variables:

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
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Google Maps API
GOOGLE_MAPS_API_KEY=your-maps-api-key

# SerpAPI
SERP_API_KEY=your-serpapi-key

# Token Encryption
TOKEN_ENCRYPTION_SECRET=your-32-char-secret-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd AMR-Backend_Experiments
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables (see above)

4. Run database migrations (ensure Migration 003 is applied)

5. Start the development server:
```bash
npm run dev
```

## Database Setup

Ensure the following migrations are applied to your Supabase database:

- Migration 001: Core schema (users, teams, locations, reviews, etc.)
- Migration 002: Additional tables (competitors, insights, etc.)
- Migration 003: Google tokens encryption, idempotency, Stripe events, credit topups

The database uses:
- Schema: `app` for application tables
- Schema: `authz` for RLS helper functions
- Extensions: `pgcrypto` (encryption), `citext` (case-insensitive emails)

## API Routes

### Authentication
- `GET /api/me` - Get current user and teams
- `GET /api/auth/google/start` - Start Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler

### Teams
- `GET /api/teams` - List user's teams
- `POST /api/teams` - Create team
- `GET /api/teams/:teamId/members` - List team members
- `POST /api/teams/:teamId/invites` - Create team invite
- `PATCH /api/teams/:teamId/members/:userId` - Update member role

### Locations
- `GET /api/google/entitlements/locations` - List accessible Google locations
- `POST /api/teams/:teamId/locations/import` - Import locations
- `GET /api/teams/:teamId/locations` - List team locations
- `PATCH /api/locations/:locationId/settings` - Update location settings
- `POST /api/locations/:locationId/access` - Grant location access

### Reviews
- `POST /api/locations/:locationId/reviews/sync` - Sync Google reviews
- `GET /api/locations/:locationId/reviews` - List reviews
- `POST /api/reviews/:reviewId/draft` - Generate draft reply (1 credit)
- `PATCH /api/reviews/:reviewId/draft` - Update draft
- `POST /api/reviews/:reviewId/post-reply` - Post reply to Google

### Competitors
- `POST /api/google/places/searchText` - Search for places
- `POST /api/teams/:teamId/competitors` - Create competitor
- `GET /api/teams/:teamId/competitors` - List competitors
- `POST /api/competitors/:competitorId/reviews/sync` - Sync competitor reviews

### Insights (PRO/ENTERPRISE)
- `POST /api/teams/:teamId/insights/run` - Run team insights (3 credits)
- `GET /api/teams/:teamId/insights` - List team insights
- `POST /api/locations/:locationId/insights/run` - Run location insights (3 credits)
- `GET /api/locations/:locationId/insights` - List location insights

### Competitive Analysis (ENTERPRISE)
- `POST /api/teams/:teamId/competitive-runs` - Create competitive run (5 credits)
- `GET /api/teams/:teamId/competitive-runs` - List competitive runs

### Billing
- `GET /api/teams/:teamId/billing` - Get billing info
- `POST /api/teams/:teamId/billing/checkout` - Create subscription checkout
- `POST /api/teams/:teamId/billing/topup` - Create credit top-up checkout
- `POST /api/teams/:teamId/billing/portal` - Create Stripe portal session
- `POST /api/stripe/webhook` - Stripe webhook handler

## Credit Consumption

- **Draft Generate**: 1 credit (FREE+)
- **Draft Regenerate**: 1 credit (FREE+)
- **Insights Run**: 3 credits (PRO/ENTERPRISE)
- **Competitive Run**: 5 credits (ENTERPRISE)

## Idempotency

Endpoints that consume credits support idempotency via the `Idempotency-Key` header:
- `/api/reviews/:reviewId/draft` (POST)
- `/api/reviews/:reviewId/post-reply` (POST)
- `/api/teams/:teamId/insights/run` (POST)
- `/api/locations/:locationId/insights/run` (POST)
- `/api/teams/:teamId/competitive-runs` (POST)

## Testing

Run tests:
```bash
npm test
```

## Production Deployment

1. Set all environment variables in your hosting platform
2. Ensure database migrations are applied
3. Configure Stripe webhook endpoint: `https://your-domain.com/api/stripe/webhook`
4. Update `NEXT_PUBLIC_APP_URL` to your production URL
5. Build and deploy:
```bash
npm run build
npm start
```

## Security Notes

- Never log tokens or sensitive data
- Refresh tokens are encrypted using `pgcrypto` before storage
- RLS policies enforce data isolation at the database level
- Use service role client only for webhooks and background jobs
- All API routes validate authentication and authorization

## License

[Your License Here]

