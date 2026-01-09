# AutoMyReply API Documentation

Complete API reference for the AutoMyReply backend.

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

All endpoints (except OAuth callbacks) require authentication via Supabase session cookie. The session is created during the Google OAuth flow.

## Response Format

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": { ... } // Optional, for validation errors
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `402` - Payment Required (insufficient credits or tier)
- `403` - Forbidden (no access)
- `404` - Not Found
- `409` - Conflict (idempotency key in progress)
- `500` - Internal Server Error

---

## Authentication & User

### Get Current User

**GET** `/api/me`

Returns the current authenticated user and their teams with subscription and credit balance information.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "avatar_url": "https://..."
  },
  "teams": [
    {
      "id": "uuid",
      "name": "Team Name",
      "role": "admin",
      "subscription": {
        "tier": "PRO",
        "status": "active",
        "monthly_credits": 100,
        "insights_enabled": true,
        "competitive_enabled": false
      },
      "creditBalance": 150
    }
  ]
}
```

---

## Google OAuth

### Start OAuth Flow

**GET** `/api/auth/google/start`

Initiates the Google OAuth flow. Returns a redirect URL.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Usage:**
1. Call this endpoint to get the OAuth URL
2. Redirect user to the returned URL
3. User authorizes the app
4. Google redirects to `/api/auth/google/callback`

### OAuth Callback

**GET** `/api/auth/google/callback?code=...&state=...`

Handles the OAuth callback from Google. This endpoint:
- Exchanges authorization code for tokens
- Creates/updates Supabase session
- Stores encrypted refresh token
- Redirects to app dashboard

**Query Parameters:**
- `code` - Authorization code from Google
- `state` - State parameter for CSRF protection

**Response:** Redirects to `${NEXT_PUBLIC_APP_URL}/dashboard`

---

## Teams

### List Teams

**GET** `/api/teams`

Returns all teams the current user is a member of.

**Response:**
```json
{
  "teams": [
    {
      "id": "uuid",
      "name": "Team Name",
      "slug": "team-name",
      "role": "admin",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Team

**POST** `/api/teams`

Creates a new team and adds the current user as admin.

**Request Body:**
```json
{
  "name": "My Team"
}
```

**Response:** `201 Created`
```json
{
  "team": {
    "id": "uuid",
    "name": "My Team",
    "slug": "my-team",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Get Team Members

**GET** `/api/teams/:teamId/members`

Lists all members of a team.

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "email": "member@example.com",
      "display_name": "Member Name",
      "avatar_url": "https://...",
      "role": "member",
      "joined_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Team Invite

**POST** `/api/teams/:teamId/invites`

Creates an invite for a user to join the team. Requires team admin.

**Request Body:**
```json
{
  "email": "invitee@example.com",
  "role": "member" // or "admin"
}
```

**Response:** `201 Created`
```json
{
  "invite": {
    "id": "uuid",
    "invited_email": "invitee@example.com",
    "role": "member",
    "expires_at": "2024-01-08T00:00:00Z",
    "token": "..." // Only in development
  }
}
```

### Update Team Member Role

**PATCH** `/api/teams/:teamId/members/:userId`

Updates a team member's role. Requires team admin.

**Request Body:**
```json
{
  "role": "admin" // or "member"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Google Location Entitlements

### List Accessible Locations

**GET** `/api/google/entitlements/locations`

Lists all Google Business Profile locations accessible to the current user's Google account. Also upserts entitlements in the database.

**Response:**
```json
{
  "locations": [
    {
      "account_id": "123456789",
      "account_name": "My Business Account",
      "location_id": "987654321",
      "location_name": "Main Store",
      "address": {
        "addressLines": ["123 Main St"],
        "locality": "City",
        "administrativeArea": "State",
        "postalCode": "12345"
      }
    }
  ]
}
```

---

## Locations

### Import Locations

**POST** `/api/teams/:teamId/locations/import`

Imports Google Business Profile locations into a team.

**Request Body:**
```json
{
  "google_location_ids": ["location-id-1", "location-id-2"],
  "account_id": "123456789" // Optional, helps with API calls
}
```

**Response:** `201 Created`
```json
{
  "locations": [
    {
      "id": "uuid",
      "name": "Main Store",
      "google_location_id": "location-id-1",
      "address": "123 Main St",
      "city": "City",
      "status": "active"
    }
  ]
}
```

### List Team Locations

**GET** `/api/teams/:teamId/locations`

Lists all locations for a team.

**Response:**
```json
{
  "locations": [
    {
      "id": "uuid",
      "name": "Main Store",
      "status": "active",
      "google_location_id": "...",
      "address": "123 Main St",
      "last_google_sync_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Update Location Settings

**PATCH** `/api/locations/:locationId/settings`

Updates location settings for AI reply generation. Requires location access.

**Request Body:**
```json
{
  "brand_voice": "Friendly and professional",
  "positive_sentiment": "Thankful and appreciative",
  "negative_sentiment": "Apologetic and solution-focused",
  "signature": "- The Team",
  "reply_language": "en"
}
```

All fields are optional and nullable.

**Response:**
```json
{
  "success": true
}
```

### Grant Location Access

**POST** `/api/locations/:locationId/access`

Grants a user access to a location. Requires team admin.

**Request Body:**
```json
{
  "user_id": "uuid",
  "can_manage": true
}
```

**Response:** `201 Created`
```json
{
  "success": true
}
```

---

## Reviews

### Sync Reviews

**POST** `/api/locations/:locationId/reviews/sync`

Syncs reviews from Google Business Profile. Requires location access.

**Request Body:**
```json
{
  "page_size": 50, // Optional, default 50
  "page_token": "..." // Optional, for pagination
}
```

**Response:**
```json
{
  "synced": 25
}
```

**Note:** Supports idempotency via `Idempotency-Key` header (optional but recommended).

### List Reviews

**GET** `/api/locations/:locationId/reviews`

Lists reviews for a location with filtering and pagination.

**Query Parameters:**
- `status` - Filter by reply status: `none`, `draft`, `posted`, `synced_external`, `post_failed`
- `since` - Filter reviews since date (ISO 8601)
- `limit` - Number of reviews to return (default: 50)
- `cursor` - Pagination cursor (review_date)

**Response:**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "comment": "Great service!",
      "reviewer_name": "John Doe",
      "review_date": "2024-01-01T00:00:00Z",
      "reply_status": "draft",
      "draft_text": "Thank you for your feedback!",
      "reply_text": null
    }
  ]
}
```

### Generate Draft Reply

**POST** `/api/reviews/:reviewId/draft`

Generates an AI-powered draft reply for a review. Costs 1 credit (FREE+ tier).

**Headers:**
- `Idempotency-Key` (optional) - Prevents duplicate credit charges

**Response:**
```json
{
  "draft_text": "Thank you for your feedback! We're glad you had a great experience."
}
```

**Errors:**
- `402` - Insufficient credits or tier mismatch

### Update Draft

**PATCH** `/api/reviews/:reviewId/draft`

Updates the draft text for a review.

**Request Body:**
```json
{
  "draft_text": "Updated draft reply text"
}
```

**Response:**
```json
{
  "success": true
}
```

### Post Reply to Google

**POST** `/api/reviews/:reviewId/post-reply`

Posts a reply to Google Business Profile. Uses draft text if comment not provided.

**Headers:**
- `Idempotency-Key` (optional) - Prevents duplicate posts

**Request Body:**
```json
{
  "comment": "Thank you for your feedback!" // Optional, uses draft if omitted
}
```

**Response:**
```json
{
  "success": true,
  "reply_text": "Thank you for your feedback!"
}
```

**Note:** Always records attempt in `reply_post_attempts` table, even on failure.

---

## Places Search

### Search Places

**POST** `/api/google/places/searchText`

Searches for places using Google Places API (New). Useful for competitor discovery.

**Request Body:**
```json
{
  "query": "coffee shop near me"
}
```

**Response:**
```json
{
  "places": [
    {
      "id": "place-id",
      "displayName": {
        "text": "Coffee Shop Name"
      },
      "formattedAddress": "123 Main St, City, State",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "rating": 4.5,
      "userRatingCount": 150
    }
  ]
}
```

---

## Competitors

### Create Competitor

**POST** `/api/teams/:teamId/competitors`

Creates a competitor entry for tracking.

**Request Body:**
```json
{
  "name": "Competitor Name",
  "place_id": "ChIJ...", // Required, from Places API
  "website": "https://competitor.com", // Optional
  "phone": "+1234567890", // Optional
  "address": "123 Competitor St", // Optional
  "latitude": 40.7128, // Optional
  "longitude": -74.0060 // Optional
}
```

**Response:** `201 Created`
```json
{
  "competitor": {
    "id": "uuid",
    "name": "Competitor Name",
    "place_id": "ChIJ...",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### List Competitors

**GET** `/api/teams/:teamId/competitors`

Lists all competitors for a team.

**Response:**
```json
{
  "competitors": [
    {
      "id": "uuid",
      "name": "Competitor Name",
      "place_id": "ChIJ...",
      "rating": 4.5,
      "review_count": 150,
      "last_serp_sync_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Sync Competitor Reviews

**POST** `/api/competitors/:competitorId/reviews/sync`

Syncs competitor reviews from SerpAPI. Fetches up to 10 pages, filters to reviews ≤1 year old.

**Response:**
```json
{
  "fetched": 250,
  "upserted": 245
}
```

---

## Insights

### Run Team Insights

**POST** `/api/teams/:teamId/insights/run`

Generates AI insights for all team locations. Costs 3 credits. Requires BUSINESS or higher tier.

**Headers:**
- `Idempotency-Key` (optional) - Prevents duplicate credit charges

**Request Body:**
```json
{
  "period_start": "2024-01-01",
  "period_end": "2024-01-31"
}
```

**Response:** `201 Created`
```json
{
  "insight": {
    "id": "uuid",
    "team_id": "uuid",
    "location_id": null,
    "period_start": "2024-01-01",
    "period_end": "2024-01-31",
    "data": {
      "summary": "Overall review trends...",
      "averageRating": 4.5,
      "totalReviews": 150,
      "ratingDistribution": { "5": 100, "4": 30, "3": 10, "2": 5, "1": 5 },
      "topThemes": ["service", "quality", "atmosphere"],
      "sentimentAnalysis": { "positive": 120, "neutral": 20, "negative": 10 },
      "recommendations": ["Improve response time", "Focus on quality"]
    },
    "generated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `402` - Insufficient credits or tier doesn't support team insights (requires BUSINESS+)

### List Team Insights

**GET** `/api/teams/:teamId/insights`

Lists all team-level insights.

**Response:**
```json
{
  "insights": [
    {
      "id": "uuid",
      "period_start": "2024-01-01",
      "period_end": "2024-01-31",
      "data": { ... },
      "generated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Run Location Insights

**POST** `/api/locations/:locationId/insights/run`

Generates AI insights for a specific location. Costs 3 credits. Requires PRO, BUSINESS, or ENTERPRISE tier.

**Note:** Location-level insights (single location) require PRO+. Team-level insights (all locations) require BUSINESS+.

**Headers:**
- `Idempotency-Key` (optional)

**Request Body:**
```json
{
  "period_start": "2024-01-01",
  "period_end": "2024-01-31"
}
```

**Response:** `201 Created` (same format as team insights, but with `location_id` set)

### List Location Insights

**GET** `/api/locations/:locationId/insights`

Lists all insights for a location.

**Response:** Same format as team insights list.

---

## Competitive Analysis (BUSINESS+)

### Create Competitive Run

**POST** `/api/teams/:teamId/competitive-runs`

Generates competitive analysis comparing owned locations and competitors. Costs 5 credits. Requires BUSINESS or higher tier.

**Headers:**
- `Idempotency-Key` (optional)

**Request Body:**
```json
{
  "name": "Q1 2024 Analysis", // Optional
  "period_start": "2024-01-01",
  "period_end": "2024-01-31",
  "owned_location_ids": ["uuid1", "uuid2"], // 1-3 locations
  "competitor_ids": ["uuid1", "uuid2", "uuid3"] // 1-3 competitors
}
```

**Response:** `201 Created`
```json
{
  "run": {
    "id": "uuid",
    "name": "Q1 2024 Analysis",
    "period_start": "2024-01-01",
    "period_end": "2024-01-31",
    "owned_location_ids": ["uuid1", "uuid2"],
    "competitor_ids": ["uuid1", "uuid2", "uuid3"],
    "data": {
      "summary": "Competitive positioning...",
      "ownedAverageRating": 4.5,
      "competitorAverageRating": 4.3,
      "strengths": ["Customer service", "Quality"],
      "weaknesses": ["Response time"],
      "opportunities": ["Online presence"],
      "recommendations": ["Improve response time"]
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `402` - Insufficient credits or tier doesn't support competitive analysis (requires BUSINESS+)

### List Competitive Runs

**GET** `/api/teams/:teamId/competitive-runs`

Lists all competitive runs for a team.

**Response:**
```json
{
  "runs": [
    {
      "id": "uuid",
      "name": "Q1 2024 Analysis",
      "period_start": "2024-01-01",
      "period_end": "2024-01-31",
      "data": { ... },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Billing

### Get Billing Info

**GET** `/api/teams/:teamId/billing`

Returns team subscription, credit balance, and available top-up products.

**Response:**
```json
{
  "subscription": {
    "tier": "PRO",
    "status": "active",
    "monthly_credits": 100,
    "insights_enabled": true,
    "competitive_enabled": false,
    "current_period_end": "2024-02-01T00:00:00Z"
  },
  "creditBalance": 150,
  "topupProducts": [
    {
      "id": "uuid",
      "stripe_price_id": "price_...",
      "credits": 50,
      "is_active": true
    }
  ]
}
```

### Create Subscription Checkout

**POST** `/api/teams/:teamId/billing/checkout`

Creates a Stripe checkout session for subscription upgrade. Requires team admin.

**Request Body:**
```json
{
  "tier": "PRO" // or "BUSINESS" or "ENTERPRISE"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

Redirect user to the returned URL to complete payment.

### Create Credit Top-Up Checkout

**POST** `/api/teams/:teamId/billing/topup`

Creates a Stripe checkout session for one-time credit purchase. Requires team admin.

**Request Body:**
```json
{
  "stripe_price_id": "price_..."
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### Create Customer Portal Session

**POST** `/api/teams/:teamId/billing/portal`

Creates a Stripe customer portal session for managing subscription. Requires team admin.

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

## Stripe Webhook

### Webhook Handler

**POST** `/api/stripe/webhook`

Handles Stripe webhook events. Verifies signature and ensures idempotency.

**Headers:**
- `stripe-signature` - Stripe webhook signature

**Note:** This endpoint is called by Stripe, not by your application. Configure the webhook URL in Stripe Dashboard.

**Handled Events:**
- `checkout.session.completed` - Subscription or top-up completed
- `customer.subscription.created` - New subscription
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_succeeded` - Monthly payment succeeded (grants credits)
- `invoice.payment_failed` - Payment failed
- `payment_intent.succeeded` - One-time payment succeeded

---

## Credit Consumption

| Action | Credits | Tier Required |
|--------|---------|---------------|
| Generate draft reply | 1 | FREE+ |
| Regenerate draft | 1 | FREE+ |
| Run location insights (single location) | 3 | PRO+ |
| Run team insights (all locations) | 3 | BUSINESS+ |
| Run competitive analysis | 5 | BUSINESS+ |

---

## Idempotency

The following endpoints support idempotency via the `Idempotency-Key` header:

- `POST /api/reviews/:reviewId/draft`
- `POST /api/reviews/:reviewId/post-reply`
- `POST /api/teams/:teamId/insights/run`
- `POST /api/locations/:locationId/insights/run`
- `POST /api/teams/:teamId/competitive-runs`

**Usage:**
```http
POST /api/reviews/123/draft
Idempotency-Key: unique-key-here
```

If the same key is used with the same request, the original response is returned without charging credits again.

**Idempotency States:**
- `started` - Request in progress
- `completed` - Request completed successfully
- `failed` - Request failed (can retry with same key if request unchanged)

---

## Error Handling

### Common Error Responses

**401 Unauthorized**
```json
{
  "error": "Not authenticated"
}
```

**402 Payment Required**
```json
{
  "error": "Insufficient credits"
}
```
or
```json
{
  "error": "Requires PRO tier"
}
```

**403 Forbidden**
```json
{
  "error": "Not a team member"
}
```

**404 Not Found**
```json
{
  "error": "Review not found"
}
```

**400 Bad Request (Validation)**
```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["name"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

**409 Conflict**
```json
{
  "error": "Request already in progress"
}
```

---

## Rate Limiting

Currently, there are no explicit rate limits. However:
- SerpAPI has its own rate limits (1 second delay between pages)
- Google APIs have quota limits
- OpenAI has rate limits based on your plan

---

## Best Practices

1. **Always use idempotency keys** for credit-consuming operations
2. **Handle 402 errors gracefully** - prompt user to upgrade or purchase credits
3. **Cache location entitlements** - don't call `/api/google/entitlements/locations` on every page load
4. **Use pagination** for large lists (reviews, insights, etc.)
5. **Store Stripe customer IDs** - they're returned in billing endpoints
6. **Monitor credit balances** - check before expensive operations
7. **Handle webhook retries** - Stripe will retry failed webhooks

---

## Support

For issues or questions, please refer to the main README.md or contact support.

