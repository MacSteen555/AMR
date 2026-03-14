# Tone Calibration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace onboarding step 3 (professional/friendly/witty picker) with an A/B taste test that calibrates brand voice from 5 review reply picks.

**Architecture:** New calibration API endpoints generate 5 industry-relevant sample reviews with paired replies (10 total, concurrent). User picks A or B for each. A synthesis prompt turns the 5 picks into a directional brand voice prompt. The reply generation prompt (`draft.ts`) is restructured into 4 layers and the variety query is updated to check posted replies first.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres), OpenAI gpt-4o-mini, Zod validation

**Design doc:** `docs/plans/2026-03-14-tone-calibration-design.md`

---

### Task 1: Database Migration — Add New Columns to `app.locations`

**Files:**
- Create: `supabase/migrations/20260314000000_tone_calibration.sql`

**Step 1: Write the migration**

```sql
-- Add tone calibration columns to locations
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS tone_calibration jsonb;
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS negative_contact_email text;
ALTER TABLE app.locations ADD COLUMN IF NOT EXISTS google_primary_category text;
```

**Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase dashboard if remote)

**Step 3: Commit**

```bash
git add supabase/migrations/20260314000000_tone_calibration.sql
git commit -m "feat: add tone_calibration, negative_contact_email, google_primary_category columns to locations"
```

---

### Task 2: Store Google Primary Category During Import

**Files:**
- Modify: `app/api/teams/[teamId]/locations/import/route.ts` (line 56-70, the insert object)
- Modify: `app/api/google/entitlements/locations/route.ts` (line 53-59, the allLocations.push)

**Step 1: Update the entitlements endpoint to pass category**

In `app/api/google/entitlements/locations/route.ts`, update the `allLocations.push` (line 53-59) to include the primary category:

```typescript
allLocations.push({
  account_id: accountId,
  account_name: account.accountName || account.name,
  location_id: googleLocationId,
  location_name: location.storefrontAddress?.addressLines?.[0] || location.title || '',
  address: location.storefrontAddress,
  primary_category: location.categories?.primaryCategory?.displayName || null,
})
```

**Step 2: Update the import endpoint to store category**

In `app/api/teams/[teamId]/locations/import/route.ts`, add `google_primary_category` to the insert object (line 56-70):

```typescript
.insert({
  team_id: params.teamId,
  google_location_id: googleLocationId,
  google_account_hint: data.account_id || null,
  name: locationData.title || locationData.storefrontAddress?.addressLines?.[0] || 'Unknown Location',
  address: locationData.storefrontAddress?.addressLines?.join(', ') || null,
  city: locationData.storefrontAddress?.locality || null,
  region: locationData.storefrontAddress?.administrativeArea || null,
  country: locationData.storefrontAddress?.regionCode || null,
  postal_code: locationData.storefrontAddress?.postalCode || null,
  phone: locationData.primaryPhone || null,
  website: locationData.websiteUri || null,
  latitude: locationData.storefrontAddress?.coordinates?.latitude || null,
  longitude: locationData.storefrontAddress?.coordinates?.longitude || null,
  google_primary_category: locationData.categories?.primaryCategory?.displayName || null,
})
```

**Step 3: Update the GoogleLocation type in the onboarding page**

In `app/(app)/teams/new/page.tsx`, update the `GoogleLocation` type (line 8-14) to include:

```typescript
type GoogleLocation = {
  account_id: string
  location_id: string
  location_name: string
  address: any
  account_name?: string
  primary_category?: string | null
}
```

**Step 4: Commit**

```bash
git add app/api/google/entitlements/locations/route.ts app/api/teams/[teamId]/locations/import/route.ts app/(app)/teams/new/page.tsx
git commit -m "feat: capture google_primary_category during location import"
```

---

### Task 3: Create `POST /api/onboarding/generate-calibration` Endpoint

**Files:**
- Create: `app/api/onboarding/generate-calibration/route.ts`

**Step 1: Write the endpoint**

This endpoint takes a `location_id`, looks up the location's name and category, then generates 5 reviews with 10 replies (all concurrent). Each reply pair is designed to test a specific tone dimension.

```typescript
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { captureRouteError } from '@/lib/sentry'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const CALIBRATION_SPECS = [
  {
    index: 0,
    stars: 5,
    dimension: 'warmth',
    review_instruction: 'A glowing 5-star review (2-3 sentences) from a very happy customer praising the experience.',
    reply_a_instruction: 'Enthusiastic and high-energy. Use exclamation marks, show genuine excitement, warm and effusive. The reply should feel like the business owner is truly thrilled.',
    reply_b_instruction: 'Warm but measured. Appreciative and sincere, but calm and composed. No exclamation marks. The reply should feel grounded and genuine without being over-the-top.',
  },
  {
    index: 1,
    stars: 4,
    dimension: 'personalization',
    review_instruction: 'A positive 4-star review (2-3 sentences) mentioning specific details about what they liked (name a specific service, staff member, or product).',
    reply_a_instruction: 'Highly personalized. Reference the specific details the reviewer mentioned. Mirror their language. Make them feel truly heard and individually acknowledged.',
    reply_b_instruction: 'Gracious but general. Thank them warmly without referencing specific details from the review. Keep it appreciative but broadly applicable.',
  },
  {
    index: 2,
    stars: 3,
    dimension: 'criticism_handling',
    review_instruction: 'A mixed 3-star review (2-3 sentences) that praises one aspect but criticizes another.',
    reply_a_instruction: 'Acknowledge the concern briefly, then pivot to the positive aspect they mentioned. End on an optimistic, forward-looking note. Lighter touch on the negative.',
    reply_b_instruction: 'Address the criticism head-on with a straightforward explanation or acknowledgment. Be transparent about what happened and what the business does differently. Then thank them for the positive feedback.',
  },
  {
    index: 3,
    stars: 1,
    dimension: 'defensiveness',
    review_instruction: 'A harsh 1-star review (2-3 sentences) with a specific complaint about a bad experience.',
    reply_a_instruction: 'Factual and direct. Stand your ground respectfully. Explain the business\'s perspective or what actually happened without being combative. Professional but not apologetic. Offer to discuss further.',
    reply_b_instruction: 'Fully empathetic. Take responsibility, apologize sincerely, and express genuine concern. Do not explain or justify. Focus entirely on the customer\'s feelings and offer to make it right.',
  },
  {
    index: 4,
    stars: 5,
    dimension: 'length_formality',
    review_instruction: 'A 5-star rating with NO written review text. Rating only.',
    reply_a_instruction: 'Brief and casual. 1-2 short sentences. Feels like a quick, genuine thank-you from a real person. Conversational tone.',
    reply_b_instruction: 'Polished and structured. 2-3 well-crafted sentences. More formal language, complete thoughts, professional but warm.',
  },
]

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json()
    const { location_id } = body

    if (!location_id) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
    }

    // Get location details
    const serviceClient = createSupabaseServiceRoleClient()
    const { data: location } = await serviceClient
      .schema('app')
      .from('locations')
      .select('name, google_primary_category')
      .eq('id', location_id)
      .single()

    const businessName = location?.name || 'a local business'
    const businessType = location?.google_primary_category || 'local business'

    // Generate all 5 reviews + 10 replies concurrently
    const reviewPromises = CALIBRATION_SPECS.map(async (spec) => {
      // Generate the review first
      const reviewCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are generating realistic Google reviews for a business. Output ONLY valid JSON, no markdown.',
          },
          {
            role: 'user',
            content: `Generate a realistic ${spec.stars}-star Google review for "${businessName}" (a ${businessType}).

${spec.review_instruction}

Return JSON: { "reviewer_name": "FirstName L.", "comment": "..." }
${spec.stars === 5 && spec.dimension === 'length_formality' ? 'For this one, set comment to null (rating only, no text).' : ''}
Do NOT use em dashes. Make the review feel authentic, not generic.`,
          },
        ],
        max_completion_tokens: 300,
        response_format: { type: 'json_object' },
      })

      const review = JSON.parse(reviewCompletion.choices[0].message.content || '{}')

      // Generate both replies concurrently
      const [replyACompletion, replyBCompletion] = await Promise.all([
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are writing a review reply for "${businessName}" (a ${businessType}). Output ONLY the reply text, nothing else. No quotes, no labels. Do NOT use em dashes. 2-4 sentences unless instructed otherwise.`,
            },
            {
              role: 'user',
              content: `Review (${spec.stars}/5) from ${review.reviewer_name}: ${review.comment || '(rating only, no text)'}

TONE DIRECTION: ${spec.reply_a_instruction}

Write the reply.`,
            },
          ],
          max_completion_tokens: 300,
        }),
        openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are writing a review reply for "${businessName}" (a ${businessType}). Output ONLY the reply text, nothing else. No quotes, no labels. Do NOT use em dashes. 2-4 sentences unless instructed otherwise.`,
            },
            {
              role: 'user',
              content: `Review (${spec.stars}/5) from ${review.reviewer_name}: ${review.comment || '(rating only, no text)'}

TONE DIRECTION: ${spec.reply_b_instruction}

Write the reply.`,
            },
          ],
          max_completion_tokens: 300,
        }),
      ])

      return {
        index: spec.index,
        stars: spec.stars,
        dimension: spec.dimension,
        reviewer_name: review.reviewer_name,
        comment: review.comment || null,
        reply_a: replyACompletion.choices[0].message.content?.trim() || '',
        reply_b: replyBCompletion.choices[0].message.content?.trim() || '',
      }
    })

    const reviews = await Promise.all(reviewPromises)

    return NextResponse.json({ reviews, business_type: businessType })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/onboarding/generate-calibration' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add app/api/onboarding/generate-calibration/route.ts
git commit -m "feat: add generate-calibration endpoint for tone A/B testing"
```

---

### Task 4: Create `POST /api/onboarding/save-calibration` Endpoint

**Files:**
- Create: `app/api/onboarding/save-calibration/route.ts`

**Step 1: Write the endpoint**

This endpoint takes the 5 A/B picks, synthesizes them into a brand voice prompt + sentiment prompts via GPT, and saves everything to the location.

```typescript
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { captureRouteError } from '@/lib/sentry'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const saveCalibrationSchema = z.object({
  location_id: z.string().uuid(),
  picks: z.array(z.object({
    review_index: z.number().int().min(0).max(4),
    dimension: z.enum(['warmth', 'personalization', 'criticism_handling', 'defensiveness', 'length_formality']),
    choice: z.enum(['a', 'b']),
  })).length(5),
  negative_contact_email: z.string().email().nullable().optional(),
  business_type: z.string().optional(),
})

const DIMENSION_DESCRIPTIONS: Record<string, { a: string; b: string }> = {
  warmth: {
    a: 'Enthusiastic and high-energy replies with exclamation marks and genuine excitement',
    b: 'Warm but measured replies that are sincere and composed without being over-the-top',
  },
  personalization: {
    a: 'Highly personalized replies that reference specific details the reviewer mentioned',
    b: 'Gracious but general replies that are appreciative without referencing specifics',
  },
  criticism_handling: {
    a: 'Acknowledges concerns briefly then pivots to the positive, ending on an optimistic note',
    b: 'Addresses criticism head-on with transparent explanation before thanking for positive feedback',
  },
  defensiveness: {
    a: 'Factual and direct on negative reviews, explaining the business\'s perspective respectfully without being overly apologetic',
    b: 'Fully empathetic on negative reviews, taking responsibility and focusing entirely on the customer\'s feelings',
  },
  length_formality: {
    a: 'Brief and casual replies that feel like a quick, genuine thank-you from a real person',
    b: 'Polished and structured replies with formal language and well-crafted sentences',
  },
}

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json()
    const data = saveCalibrationSchema.parse(body)

    const serviceClient = createSupabaseServiceRoleClient()

    // Build the synthesis prompt from picks
    const pickDescriptions = data.picks.map((pick) => {
      const dim = DIMENSION_DESCRIPTIONS[pick.dimension]
      const chosen = pick.choice === 'a' ? dim.a : dim.b
      const dimensionLabel = pick.dimension.replace(/_/g, ' ').toUpperCase()
      return `${dimensionLabel}: Chose "${chosen}"`
    })

    const businessType = data.business_type || 'local business'

    // Synthesize brand voice + sentiments concurrently
    const [voiceCompletion, sentimentCompletion] = await Promise.all([
      // Brand voice synthesis
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a brand voice analyst. You've observed a business owner choose between pairs of review replies. Each pair tested a specific dimension of their communication style. Your job is to synthesize their choices into a natural, directional description of how this business communicates.

RULES:
- Write in second person ("You" / "Your voice")
- Be directional, not prescriptive. Say "you lean warm and casual" not "always use exclamation marks"
- 3-5 sentences maximum
- Never mention the calibration process, dimensions, or A/B testing
- The output should read like a creative brief, not a rulebook
- Capture the FEELING of their preferred style, not mechanical rules
- Output ONLY the brand voice description, no labels or preamble`,
          },
          {
            role: 'user',
            content: `Business type: ${businessType}

The business owner made these choices:

${pickDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Write their brand voice description.`,
          },
        ],
        max_completion_tokens: 400,
      }),

      // Sentiment-specific guidance synthesis
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are generating sentiment-specific reply instructions for a business based on their communication preferences. Return valid JSON only, no markdown.`,
          },
          {
            role: 'user',
            content: `Business type: ${businessType}

The business owner's communication preferences:
${pickDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Generate specific instructions for how to handle each sentiment type. Return JSON:
{
  "positive_sentiment": "1-2 sentences on how to reply to positive reviews (4-5 stars) given their preferences",
  "negative_sentiment": "1-2 sentences on how to reply to negative reviews (1-2 stars) given their preferences",
  "neutral_sentiment": "1-2 sentences on how to reply to neutral/mixed reviews (3 stars) given their preferences"
}`,
          },
        ],
        max_completion_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    ])

    const brandVoice = voiceCompletion.choices[0].message.content?.trim() || ''
    const sentiments = JSON.parse(sentimentCompletion.choices[0].message.content || '{}')

    // Save everything to the location
    const updateData: Record<string, any> = {
      tone_calibration: {
        business_type: businessType,
        picks: data.picks,
      },
      brand_voice: brandVoice,
      positive_sentiment: sentiments.positive_sentiment || null,
      negative_sentiment: sentiments.negative_sentiment || null,
    }

    if (data.negative_contact_email !== undefined) {
      updateData.negative_contact_email = data.negative_contact_email || null
    }

    const { error } = await serviceClient
      .schema('app')
      .from('locations')
      .update(updateData)
      .eq('id', data.location_id)

    if (error) {
      throw new Error(`Failed to save calibration: ${error.message}`)
    }

    return NextResponse.json({
      brand_voice: brandVoice,
      positive_sentiment: sentiments.positive_sentiment,
      negative_sentiment: sentiments.negative_sentiment,
      neutral_sentiment: sentiments.neutral_sentiment,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/onboarding/save-calibration' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add app/api/onboarding/save-calibration/route.ts
git commit -m "feat: add save-calibration endpoint with brand voice synthesis"
```

---

### Task 5: Update `draft.ts` — Variety Query + Contact Email + Prompt Refinement

**Files:**
- Modify: `lib/openai/draft.ts`

**Step 1: Replace `getRecentDrafts` with `getRecentReplies`**

Replace the function at lines 70-92 with a new version that prioritizes posted replies:

```typescript
/**
 * Fetch recent replies for this location to ensure variety.
 * Prioritizes posted replies (what's live on Google), falls back to drafts.
 */
async function getRecentReplies(locationId?: string, currentReviewId?: string): Promise<string[]> {
  if (!locationId) return []
  try {
    const client = createSupabaseServiceRoleClient()

    // First get posted replies (what's actually live on Google)
    let postedQuery = client
      .schema('app')
      .from('google_reviews')
      .select('reply_text')
      .eq('location_id', locationId)
      .eq('reply_status', 'posted')
      .not('reply_text', 'is', null)
      .order('replied_at', { ascending: false })
      .limit(5)

    if (currentReviewId) {
      postedQuery = postedQuery.neq('id', currentReviewId)
    }

    const { data: postedData } = await postedQuery
    const posted = (postedData?.map(r => r.reply_text).filter(Boolean) as string[]) || []

    // If we have fewer than 5 posted, fill with drafts
    if (posted.length < 5) {
      let draftQuery = client
        .schema('app')
        .from('google_reviews')
        .select('draft_text')
        .eq('location_id', locationId)
        .not('draft_text', 'is', null)
        .neq('reply_status', 'posted')
        .order('draft_updated_at', { ascending: false })
        .limit(5 - posted.length)

      if (currentReviewId) {
        draftQuery = draftQuery.neq('id', currentReviewId)
      }

      const { data: draftData } = await draftQuery
      const drafts = (draftData?.map(r => r.draft_text).filter(Boolean) as string[]) || []
      return [...posted, ...drafts]
    }

    return posted
  } catch (e) {
    return []
  }
}
```

**Step 2: Update `LocationSettings` interface to include `negative_contact_email`**

At line 8-16, add the new field:

```typescript
export interface LocationSettings {
  brand_voice?: string | null
  positive_sentiment?: string | null
  negative_sentiment?: string | null
  neutral_sentiment?: string | null
  signature?: string | null
  reply_language?: string | null
  location_id?: string
  negative_contact_email?: string | null
}
```

**Step 3: Update callers of `getRecentDrafts` to use `getRecentReplies`**

In `draftReply` (line 99) and `draftReplyStream` (line 125), change:
- `getRecentDrafts(` → `getRecentReplies(`

**Step 4: Update `buildGuidelines` to inject contact email**

At the end of the `buildGuidelines` function (before `return rules.join('\n')`), add:

```typescript
// Contact email for negative reviews
if (review.rating <= 2 && settings.negative_contact_email) {
  rules.push(`For this negative review, invite the reviewer to reach out directly at ${settings.negative_contact_email} to resolve the issue.`)
}
```

**Step 5: Update the variety section label in `buildPrompt`**

In `buildPrompt` (line 192-197), update the label from "RECENTLY GENERATED DRAFTS" to "RECENT REPLIES" and update the text:

```typescript
if (recentReplies && recentReplies.length > 0) {
  sections.push(
    `=== RECENT REPLIES FROM THIS BUSINESS ===\nTo ensure variety, you MUST use different opening phrases, varied sentence structures, and distinct vocabulary from these recent replies:\n\n` +
    recentReplies.map((d, i) => `[Recent Reply ${i + 1}]: "${d}"`).join('\n\n')
  )
}
```

**Step 6: Commit**

```bash
git add lib/openai/draft.ts
git commit -m "feat: update draft.ts with variety from posted replies + contact email support"
```

---

### Task 6: Update Location PATCH Endpoint + Validation Schema

**Files:**
- Modify: `app/api/teams/[teamId]/locations/[locationId]/route.ts` (lines 49-68)
- Modify: `lib/validation/schemas.ts` (lines 21-27)

**Step 1: Update the Zod schema**

In `lib/validation/schemas.ts`, update `updateLocationSettingsSchema` (lines 21-27):

```typescript
export const updateLocationSettingsSchema = z.object({
  brand_voice: z.string().nullable().optional(),
  positive_sentiment: z.string().nullable().optional(),
  negative_sentiment: z.string().nullable().optional(),
  signature: z.string().nullable().optional(),
  reply_language: z.string().nullable().optional(),
  tone_calibration: z.any().nullable().optional(),
  negative_contact_email: z.string().email().nullable().optional(),
})
```

**Step 2: Update the PATCH handler to accept new fields**

In `app/api/teams/[teamId]/locations/[locationId]/route.ts`, update the destructuring (lines 49-56) and the update object (lines 63-68):

```typescript
const {
  brand_voice,
  positive_sentiment,
  negative_sentiment,
  reply_language,
  signature,
  tone_calibration,
  negative_contact_email,
} = body

// ...

const { data, error } = await serviceClient
  .schema('app')
  .from('locations')
  .update({
    brand_voice,
    positive_sentiment,
    negative_sentiment,
    reply_language,
    signature,
    tone_calibration,
    negative_contact_email,
  })
  .eq('id', params.locationId)
  .eq('team_id', params.teamId)
  .select()
  .single()
```

**Step 3: Commit**

```bash
git add lib/validation/schemas.ts app/api/teams/[teamId]/locations/[locationId]/route.ts
git commit -m "feat: accept tone_calibration and negative_contact_email in location settings"
```

---

### Task 7: Rewrite Onboarding Step 3 UI — A/B Calibration Flow

**Files:**
- Modify: `app/(app)/teams/new/page.tsx`

This is the largest task. Replace the entire step 3 section (the ReviewColumn component, the voice picker, the sample review loading) with the new calibration flow.

**Step 1: Update types and state at the top of the file**

Remove old types: `SampleReviews`, `BrandVoiceOption`

Add new types:

```typescript
type CalibrationReview = {
  index: number
  stars: number
  dimension: string
  reviewer_name: string
  comment: string | null
  reply_a: string
  reply_b: string
}

type CalibrationData = {
  reviews: CalibrationReview[]
  business_type: string
}

type CalibrationPick = {
  review_index: number
  dimension: string
  choice: 'a' | 'b'
}
```

Replace old state variables (positiveVoice, negativeVoice, positiveReplyText, negativeReplyText, positiveOriginal, negativeOriginal, sampleReviews, loadingSamples, userEditedPrompt, isInferringPrompt, reviewCacheRef, activeFetchesRef) with:

```typescript
const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
const [loadingCalibration, setLoadingCalibration] = useState(false)
const [picks, setPicks] = useState<Record<number, 'a' | 'b'>>({})
const [negativeContactEmail, setNegativeContactEmail] = useState('')
const [calibrationStep, setCalibrationStep] = useState<'picking' | 'email' | 'review'>('picking')
const [generatedVoice, setGeneratedVoice] = useState('')
const [savingCalibration, setSavingCalibration] = useState(false)
```

**Step 2: Replace `loadSampleReviews` with `loadCalibration`**

```typescript
const loadCalibration = async (locationId: string) => {
  setLoadingCalibration(true)
  setCalibrationData(null)
  setPicks({})
  setCalibrationStep('picking')
  try {
    const data = await apiPost<CalibrationData>('/api/onboarding/generate-calibration', { location_id: locationId })
    setCalibrationData(data)
  } catch (err: any) {
    setError(err.message || 'Failed to generate calibration reviews')
  } finally {
    setLoadingCalibration(false)
  }
}
```

Update the call sites:
- In `handleImportLocations` (around line 200): change `loadSampleReviews(result.locations[0].name)` → `loadCalibration(result.locations[0].id)`
- In the step 2 skip button onClick: change `loadSampleReviews(importedLocationIds[0].name)` → `loadCalibration(importedLocationIds[0].id)`
- Remove the prefetch `useEffect` at lines 241-248 (or update to prefetch calibration)

**Step 3: Replace `handleSaveBrandVoice` with `handleSaveCalibration`**

```typescript
const handleSaveCalibration = async () => {
  if (!teamId || importedLocationIds.length === 0) return
  const currentLocation = importedLocationIds[currentLocationIdx]
  if (!currentLocation) return

  try {
    setSavingCalibration(true)
    setError(null)

    if (calibrationStep === 'picking') {
      // Move to email step
      setCalibrationStep('email')
      setSavingCalibration(false)
      return
    }

    if (calibrationStep === 'email') {
      // Submit calibration and get brand voice
      const picksArray: CalibrationPick[] = Object.entries(picks).map(([idx, choice]) => {
        const review = calibrationData!.reviews[Number(idx)]
        return {
          review_index: Number(idx),
          dimension: review.dimension,
          choice,
        }
      })

      const result = await apiPost<{ brand_voice: string }>('/api/onboarding/save-calibration', {
        location_id: currentLocation.id,
        picks: picksArray,
        negative_contact_email: negativeContactEmail.trim() || null,
        business_type: calibrationData?.business_type,
      })

      setGeneratedVoice(result.brand_voice)
      setCalibrationStep('review')
      setSavingCalibration(false)
      return
    }

    // calibrationStep === 'review' — save final (possibly edited) brand voice
    await apiPatch(`/api/teams/${teamId}/locations/${currentLocation.id}`, {
      brand_voice: generatedVoice,
    })

    if (currentLocationIdx < importedLocationIds.length - 1) {
      const nextIdx = currentLocationIdx + 1
      setCurrentLocationIdx(nextIdx)
      loadCalibration(importedLocationIds[nextIdx].id)
    } else {
      router.push('/teams')
      router.refresh()
    }
  } catch (err: any) {
    setError(err.message || 'Failed to save calibration')
  } finally {
    setSavingCalibration(false)
  }
}
```

**Step 4: Build the new step 3 UI**

Replace everything inside `{step === 3 && (...)}` (lines 545-688). The new UI has three sub-views:

**Sub-view 1: Picking (cards with A/B options)**

```tsx
{calibrationStep === 'picking' && calibrationData && (
  <div className="space-y-6">
    {calibrationData.reviews.map((review) => (
      <CalibrationCard
        key={review.index}
        review={review}
        pick={picks[review.index] || null}
        onPick={(choice) => setPicks(prev => ({ ...prev, [review.index]: choice }))}
      />
    ))}

    <div className="flex justify-end pt-4 pb-8">
      <button
        onClick={handleSaveCalibration}
        disabled={Object.keys(picks).length < 5}
        className="group px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
      >
        Continue
        <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  </div>
)}
```

**Sub-view 2: Contact email**

```tsx
{calibrationStep === 'email' && (
  <div className="max-w-lg mx-auto" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h3 className="text-lg font-bold text-gray-900 mb-2">Contact email for negative reviews</h3>
      <p className="text-sm text-gray-500 mb-6">
        When replying to unhappy customers, would you like to offer an email they can reach out to? This is optional.
      </p>
      <input
        type="email"
        value={negativeContactEmail}
        onChange={e => setNegativeContactEmail(e.target.value)}
        placeholder="e.g., support@yourbusiness.com"
        className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none text-gray-900 bg-gray-50 focus:bg-white transition-all"
      />
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCalibrationStep('picking')}
          className="px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
        >
          Back
        </button>
        <button
          onClick={handleSaveCalibration}
          disabled={savingCalibration}
          className="px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {savingCalibration ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</>
          ) : (
            <>Generate Brand Voice<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
          )}
        </button>
      </div>
    </div>
  </div>
)}
```

**Sub-view 3: Review prompt**

```tsx
{calibrationStep === 'review' && (
  <div className="max-w-2xl mx-auto" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
          <svg className="w-4.5 h-4.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Your Brand Voice</h3>
          <p className="text-xs text-gray-500">Generated from your choices. Feel free to tweak it.</p>
        </div>
      </div>
      <div className="p-6">
        <textarea
          value={generatedVoice}
          onChange={e => setGeneratedVoice(e.target.value)}
          className="w-full p-4 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all min-h-[160px] leading-relaxed"
        />
      </div>
    </div>
    <div className="flex justify-between mt-6 pb-8">
      <button
        onClick={() => setCalibrationStep('email')}
        className="px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors cursor-pointer"
      >
        Back
      </button>
      <button
        onClick={handleSaveCalibration}
        disabled={savingCalibration || !generatedVoice.trim()}
        className="group px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-teal-200/60 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
      >
        {savingCalibration ? (
          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
        ) : currentLocationIdx < importedLocationIds.length - 1 ? (
          <>Save & Next Location<svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
        ) : (
          <>Save & Finish Setup<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>
        )}
      </button>
    </div>
  </div>
)}
```

**Step 5: Build the `CalibrationCard` component**

Add this component at the bottom of the file (replacing the old `ReviewColumn` component):

```tsx
function CalibrationCard({ review, pick, onPick }: {
  review: CalibrationReview
  pick: 'a' | 'b' | null
  onPick: (choice: 'a' | 'b') => void
}) {
  const starColor = review.stars >= 4 ? 'text-emerald-500' : review.stars === 3 ? 'text-amber-500' : 'text-red-500'
  const starBg = review.stars >= 4 ? 'bg-emerald-50 border-emerald-100' : review.stars === 3 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      {/* Review header */}
      <div className={`px-6 py-4 ${starBg} border-b`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/80 rounded-full flex items-center justify-center font-bold text-sm text-gray-700 shadow-sm">
            {review.reviewer_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{review.reviewer_name}</span>
              <StarRating rating={review.stars} />
            </div>
            {review.comment ? (
              <p className="text-gray-600 text-sm mt-1 leading-relaxed">&ldquo;{review.comment}&rdquo;</p>
            ) : (
              <p className="text-gray-400 text-sm mt-1 italic">Rating only, no written review</p>
            )}
          </div>
        </div>
      </div>

      {/* Reply options */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['a', 'b'] as const).map((choice) => {
          const isSelected = pick === choice
          const replyText = choice === 'a' ? review.reply_a : review.reply_b
          return (
            <button
              key={choice}
              onClick={() => onPick(choice)}
              className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500/20'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-teal-600' : 'text-gray-400'}`}>
                  Option {choice.toUpperCase()}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'border-teal-500 bg-teal-500' : 'border-gray-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{replyText}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 6: Remove old code**

- Remove the `ReviewColumn` component (lines 697-802)
- Remove the `VOICE_OPTIONS` array and `VoicePill` component (search for these)
- Remove old state variables and handlers: `handleSelectPositiveVoice`, `handleSelectNegativeVoice`, `updateOpinionPrompt`, `handleInferPromptFromReplies`
- Remove old `initializeBrandVoiceUI`
- Keep `StarRating` and `StepIndicator` components

**Step 7: Commit**

```bash
git add app/(app)/teams/new/page.tsx
git commit -m "feat: replace onboarding step 3 with A/B tone calibration flow"
```

---

### Task 8: Update Location Settings to Pass `negative_contact_email`

**Files:**
- Modify: `app/(app)/teams/page.tsx` (location settings modal)

**Step 1: Add `negative_contact_email` to settings form**

When loading location settings in the modal, also fetch `negative_contact_email` and `tone_calibration`. Add an input field for `negative_contact_email` in the settings form, below the signature section.

**Step 2: Pass `negative_contact_email` through to draft generation**

In the review draft API handlers (wherever `LocationSettings` is assembled from the DB), ensure `negative_contact_email` is included in the settings object passed to `draftReply`/`draftReplyStream`.

Search for all places that query location settings and assemble a `LocationSettings` object. These likely include:
- `app/api/locations/[locationId]/reviews/[reviewId]/draft/route.ts`
- `app/api/teams/[teamId]/reviews/bulk-generate/route.ts`
- Any streaming draft endpoints

Add `negative_contact_email` to the select query and include it in the `LocationSettings` object.

**Step 3: Commit**

```bash
git add app/(app)/teams/page.tsx
git commit -m "feat: add negative_contact_email to location settings UI and draft generation"
```

---

### Task 9: Clean Up Old Onboarding Endpoints

**Files:**
- Delete: `app/api/onboarding/generate-sample-reviews/route.ts`
- Delete: `app/api/onboarding/extract-brand-voice/route.ts`

**Step 1: Verify no other code references these endpoints**

Search for `generate-sample-reviews` and `extract-brand-voice` across the codebase. After the step 3 rewrite in Task 7, there should be no remaining references.

**Step 2: Delete the old files**

```bash
rm app/api/onboarding/generate-sample-reviews/route.ts
rm app/api/onboarding/extract-brand-voice/route.ts
```

**Step 3: Commit**

```bash
git add -A app/api/onboarding/generate-sample-reviews/ app/api/onboarding/extract-brand-voice/
git commit -m "chore: remove old onboarding endpoints replaced by calibration flow"
```

---

### Task 10: Build Verification

**Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Fix any build errors**

Common issues to watch for:
- Missing imports for new types
- Old state variable references not fully removed from step 3 UI
- Supabase column names not matching (verify migration was applied)

**Step 3: Final commit if fixes needed**

```bash
git add .
git commit -m "fix: resolve build errors from tone calibration implementation"
```
