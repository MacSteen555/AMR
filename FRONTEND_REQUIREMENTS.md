# Frontend Requirements for AutoMyReply

This document outlines all frontend requirements beyond the API documentation for building the AutoMyReply frontend.

## Overview

AutoMyReply is a team-based SaaS application for managing Google Business Profile reviews, generating AI-powered replies, and running competitive analysis. The frontend should be built using the API endpoints documented in `APIdoc.md`.

## Frontend Environment Variables

The frontend needs these environment variables (in addition to backend variables):

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (for client-side auth if needed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe (for checkout if using Stripe.js)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

**Note:** The backend handles all API calls server-side, so the frontend primarily needs `NEXT_PUBLIC_APP_URL` for OAuth redirects and API calls.

## Authentication Flow

### Initial Authentication (Google OAuth)

1. **User clicks "Sign in with Google"**
   - Frontend calls: `GET /api/auth/google/start`
   - Receives: `{ url: "https://accounts.google.com/..." }`
   - Redirects user to the returned URL

2. **Google redirects back**
   - Google redirects to: `/api/auth/google/callback?code=...&state=...`
   - Backend handles callback, creates Supabase session
   - Backend redirects to: `${NEXT_PUBLIC_APP_URL}/dashboard`

3. **Session Management**
   - Session is stored in HTTP-only cookies (handled by backend)
   - Frontend checks auth status via: `GET /api/me`
   - If `401`, redirect to login

### Session Persistence

- Sessions are managed via Supabase cookies (server-side)
- Frontend should call `GET /api/me` on app load to check auth status
- No need to manage tokens client-side

## Key Frontend Features & Pages

### 1. Authentication Pages

**Login Page** (`/login`)
- "Sign in with Google" button
- Calls `/api/auth/google/start` and redirects

**Dashboard** (`/dashboard`)
- Redirect target after OAuth callback
- Shows user's teams
- Team selection/switching

### 2. Team Management

**Team List** (`/teams`)
- List all teams user belongs to
- Create new team button
- Shows: team name, role, subscription tier, credit balance

**Team Detail** (`/teams/:teamId`)
- Team overview
- Members list
- Billing info
- Settings

**Team Members** (`/teams/:teamId/members`)
- List members with roles
- Invite members (admin only)
- Update member roles (admin only)

### 3. Location Management

**Locations List** (`/teams/:teamId/locations`)
- List all team locations
- Import locations button
- Location status, last sync time

**Import Locations** (`/teams/:teamId/locations/import`)
- Call `/api/google/entitlements/locations` to fetch available locations
- Show list of Google Business Profile locations
- Select locations to import
- Call `/api/teams/:teamId/locations/import`

**Location Detail** (`/locations/:locationId`)
- Location info and settings
- Reviews list
- Insights (if available)
- Settings: brand voice, sentiment, signature, language

**Location Settings** (`/locations/:locationId/settings`)
- Form to update:
  - Brand voice
  - Positive sentiment approach
  - Negative sentiment approach
  - Signature
  - Reply language

### 4. Reviews Management

**Reviews List** (`/locations/:locationId/reviews`)
- List reviews with filters:
  - Status: none, draft, posted, synced_external, post_failed
  - Date range (since parameter)
  - Pagination (cursor-based)
- Show: rating, comment, reviewer, date, reply status
- Actions: Generate draft, Edit draft, Post reply

**Review Detail** (`/reviews/:reviewId`)
- Full review details
- Draft text (editable)
- Reply history
- Generate draft button (costs 1 credit)
- Post reply button
- Show credit cost warnings

**Sync Reviews** (`/locations/:locationId/reviews/sync`)
- Button to trigger sync
- Show sync progress/status
- Call `/api/locations/:locationId/reviews/sync`

### 5. Competitor Management

**Competitors List** (`/teams/:teamId/competitors`)
- List all competitors
- Add competitor button
- Sync reviews button per competitor

**Add Competitor** (`/teams/:teamId/competitors/add`)
- Search places using `/api/google/places/searchText`
- Select place from results
- Create competitor entry

**Competitor Detail** (`/competitors/:competitorId`)
- Competitor info
- Reviews list
- Sync reviews button

### 6. Insights & Analytics

**Team Insights** (`/teams/:teamId/insights`)
- List all team insights
- Run insights button (requires BUSINESS+)
- Show insights data: summary, ratings, themes, recommendations
- Cost: 3 credits

**Location Insights** (`/locations/:locationId/insights`)
- List location-specific insights
- Run insights button (requires PRO+)
- Cost: 3 credits

**Competitive Analysis** (`/teams/:teamId/competitive-runs`)
- List competitive runs
- Create competitive run button (requires BUSINESS+)
- Select owned locations (1-3)
- Select competitors (1-3)
- Set date range
- Cost: 5 credits

### 7. Billing & Credits

**Billing Page** (`/teams/:teamId/billing`)
- Current subscription tier
- Credit balance
- Subscription status
- Upgrade/downgrade buttons
- Credit top-up options
- Transaction history (if implemented)

**Checkout Flow**
- Select tier: PRO, BUSINESS, or ENTERPRISE
- Call `/api/teams/:teamId/billing/checkout`
- Redirect to Stripe checkout URL
- Handle success/cancel redirects

**Credit Top-Up**
- Show available top-up products
- Select product
- Call `/api/teams/:teamId/billing/topup`
- Redirect to Stripe checkout

**Customer Portal**
- Link to Stripe customer portal
- Call `/api/teams/:teamId/billing/portal`
- Redirect to portal URL

## UI/UX Requirements

### Credit System Display

- **Always show credit balance** in header/navigation
- **Show credit cost** before actions that consume credits:
  - Generate draft: "This will cost 1 credit"
  - Run insights: "This will cost 3 credits"
  - Competitive run: "This will cost 5 credits"
- **Handle 402 errors gracefully**: Show upgrade prompt or purchase credits option

### Tier-Based Feature Gating

- **Hide/disable features** based on tier:
  - FREE: Only draft generation
  - PRO: Draft + location insights
  - BUSINESS: Draft + location insights + team insights + competitive
  - ENTERPRISE: Same as BUSINESS
- **Show upgrade prompts** when users try to access gated features

### Error Handling

- **401 Unauthorized**: Redirect to login
- **402 Payment Required**: Show billing/upgrade modal
- **403 Forbidden**: Show "Access denied" message
- **404 Not Found**: Show "Resource not found"
- **409 Conflict**: Show "Request already in progress" (idempotency)
- **500 Server Error**: Show generic error, allow retry

### Loading States

- Show loading indicators for:
  - API calls
  - Review sync (can take time)
  - Insights generation (can take 10-30 seconds)
  - Competitive analysis (can take 30-60 seconds)

### Idempotency

- **Generate unique keys** for credit-consuming operations:
  - Use UUID or timestamp-based keys
  - Include in `Idempotency-Key` header
- **Handle retries**: If request fails, retry with same key
- **Show progress**: For long-running operations, poll status

## Data Models (TypeScript Interfaces)

```typescript
// User
interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
}

// Team
interface Team {
  id: string
  name: string
  slug: string
  role: 'admin' | 'member'
  subscription: Subscription | null
  creditBalance: number
}

// Subscription
interface Subscription {
  tier: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
  monthly_credits: number
  insights_enabled: boolean
  competitive_enabled: boolean
  current_period_end: string | null
}

// Location
interface Location {
  id: string
  name: string
  status: 'active' | 'paused' | 'disconnected' | 'archived'
  google_location_id: string
  address: string | null
  city: string | null
  brand_voice: string | null
  positive_sentiment: string | null
  negative_sentiment: string | null
  signature: string | null
  reply_language: string | null
  last_google_sync_at: string | null
}

// Review
interface Review {
  id: string
  rating: number
  comment: string | null
  reviewer_name: string | null
  review_date: string
  reply_status: 'none' | 'draft' | 'posted' | 'synced_external' | 'post_failed'
  draft_text: string | null
  reply_text: string | null
  replied_at: string | null
}

// Competitor
interface Competitor {
  id: string
  name: string
  place_id: string
  rating: number | null
  review_count: number | null
  last_serp_sync_at: string | null
}

// Insight
interface Insight {
  id: string
  team_id: string | null
  location_id: string | null
  period_start: string
  period_end: string
  data: {
    summary: string
    averageRating: number
    totalReviews: number
    ratingDistribution: { [key: string]: number }
    topThemes: string[]
    sentimentAnalysis: { positive: number; neutral: number; negative: number }
    recommendations: string[]
  }
  generated_at: string
}

// Competitive Run
interface CompetitiveRun {
  id: string
  name: string | null
  period_start: string
  period_end: string
  owned_location_ids: string[]
  competitor_ids: string[]
  data: {
    summary: string
    ownedAverageRating: number
    competitorAverageRating: number
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    recommendations: string[]
  }
  created_at: string
}
```

## API Integration Patterns

### Making API Calls

```typescript
// Example: Fetch teams
async function getTeams() {
  const response = await fetch('/api/teams', {
    credentials: 'include', // Important: include cookies
  })
  
  if (response.status === 401) {
    // Redirect to login
    window.location.href = '/login'
    return
  }
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  
  return response.json()
}
```

### Handling Credit-Consuming Operations

```typescript
// Example: Generate draft with idempotency
async function generateDraft(reviewId: string) {
  const idempotencyKey = crypto.randomUUID()
  
  const response = await fetch(`/api/reviews/${reviewId}/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    credentials: 'include',
  })
  
  if (response.status === 402) {
    // Show upgrade/purchase credits modal
    showBillingModal()
    return
  }
  
  return response.json()
}
```

### Polling for Long Operations

```typescript
// Example: Sync reviews (may take time)
async function syncReviews(locationId: string) {
  const response = await fetch(`/api/locations/${locationId}/reviews/sync`, {
    method: 'POST',
    credentials: 'include',
  })
  
  // Show progress indicator
  showLoading('Syncing reviews...')
  
  // Poll for completion or show success
  const result = await response.json()
  showSuccess(`Synced ${result.synced} reviews`)
}
```

## Required Routes/Pages

### Public Routes
- `/login` - Google OAuth login

### Protected Routes (require auth)
- `/dashboard` - Main dashboard
- `/teams` - Teams list
- `/teams/:teamId` - Team detail
- `/teams/:teamId/members` - Team members
- `/teams/:teamId/locations` - Team locations
- `/teams/:teamId/locations/import` - Import locations
- `/teams/:teamId/competitors` - Competitors list
- `/teams/:teamId/insights` - Team insights
- `/teams/:teamId/competitive-runs` - Competitive runs
- `/teams/:teamId/billing` - Billing & credits
- `/locations/:locationId` - Location detail
- `/locations/:locationId/settings` - Location settings
- `/locations/:locationId/reviews` - Reviews list
- `/locations/:locationId/insights` - Location insights
- `/reviews/:reviewId` - Review detail
- `/competitors/:competitorId` - Competitor detail

## Important Notes for Lovable

1. **Cookie-based Auth**: All API calls must include `credentials: 'include'` to send cookies
2. **Error Handling**: Always check for 402 (Payment Required) and show billing UI
3. **Tier Gating**: Check subscription tier before showing features
4. **Credit Display**: Always show credit balance prominently
5. **Idempotency**: Generate unique keys for credit operations
6. **Loading States**: Show progress for long operations (insights, syncs)
7. **Redirects**: OAuth callback redirects to `/dashboard` - ensure this route exists
8. **Stripe Integration**: Use Stripe checkout URLs returned from API (don't use Stripe.js directly)

## Testing Checklist

- [ ] Google OAuth flow works end-to-end
- [ ] Session persists across page refreshes
- [ ] Credit balance displays correctly
- [ ] Tier-based feature gating works
- [ ] 402 errors show upgrade prompts
- [ ] Idempotency prevents duplicate charges
- [ ] Long operations show loading states
- [ ] Error handling works for all status codes
- [ ] Stripe checkout redirects work
- [ ] All CRUD operations work (create, read, update, delete)

## Additional Resources

- **API Documentation**: See `APIdoc.md` for complete API reference
- **Backend README**: See `README.md` for backend setup
- **Database Schema**: Refer to database migrations for data structure

