# Enhanced Digest: Drafts, Sentiment Summary & Credit Model Shift — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AI draft generation free globally, charge 1 credit to post replies, add LLM sentiment summaries and draft previews to the review digest email.

**Architecture:** Three independent changes: (1) move `spendCredits` calls from draft endpoints to post/publish endpoints, (2) create a new `generateDigestSummary()` OpenAI helper, (3) update the cron handler and email template to include drafts and summaries. The existing `draftReply()` function from `lib/openai/draft.ts` is reused in the cron handler.

**Tech Stack:** Next.js 14 (App Router), TypeScript, OpenAI `gpt-4o-mini`, Supabase, Resend, Vercel Cron.

---

### Task 1: Add `reply_post` to CreditEventType

The `spendCredits` function validates event types. We need a new `reply_post` type before we can use it in the post/publish endpoints.

**Files:**
- Modify: `lib/billing/credits.ts:5-13`
- Modify: `supabase/migrations/20260314000000_add_reply_post_event_type.sql` (Create)

**Step 1: Add `reply_post` to the CreditEventType union**

In `lib/billing/credits.ts`, change line 9-13 from:

```typescript
export type CreditEventType =
  | 'monthly_grant'
  | 'topup'
  | 'adjustment'
  | 'reply_generate'
  | 'reply_regenerate'
  | 'insight_run'
  | 'competitive_run'
  | 'refund'
```

to:

```typescript
export type CreditEventType =
  | 'monthly_grant'
  | 'topup'
  | 'adjustment'
  | 'reply_generate'
  | 'reply_regenerate'
  | 'reply_post'
  | 'insight_run'
  | 'competitive_run'
  | 'refund'
```

**Step 2: Create migration to add `reply_post` to the database enum**

Create `supabase/migrations/20260314000000_add_reply_post_event_type.sql`:

```sql
-- Add 'reply_post' to the credit_event_type enum (or CHECK constraint)
-- The existing CHECK constraint on team_credit_transactions.event_type needs updating.
-- If using a Postgres enum, alter it:
ALTER TYPE app.credit_event_type ADD VALUE IF NOT EXISTS 'reply_post';
```

> **Note for implementer:** Check `supabase/migrations/20260304211114_remote_schema.sql` around line 88-96 to see if `credit_event_type` is an enum or a CHECK constraint. If it's a CHECK constraint on `team_credit_transactions`, you'll need to drop and recreate the constraint instead. The migration file should match what the schema actually uses.

**Step 3: Commit**

```bash
git add lib/billing/credits.ts supabase/migrations/20260314000000_add_reply_post_event_type.sql
git commit -m "feat: add reply_post credit event type"
```

---

### Task 2: Remove `spendCredits` from Draft Endpoint

Make draft generation free by removing the credit charge from `app/api/reviews/[reviewId]/draft/route.ts`.

**Files:**
- Modify: `app/api/reviews/[reviewId]/draft/route.ts`

**Step 1: Remove spendCredits from the POST handler**

In `app/api/reviews/[reviewId]/draft/route.ts`:

1. Remove the import: `import { spendCredits } from '@/lib/billing/credits'`
2. Remove `import crypto from 'crypto'` (only used for idempotency key)
3. Remove lines 14-16 (the `idempotencyKey` variable)
4. Remove lines 33-42 (the `spendCredits` call block):
```typescript
    // Spend credit
    await spendCredits(
      review.location.team_id,
      user.id,
      'reply_generate',
      1,
      'review',
      params.reviewId,
      idempotencyKey
    )
```
5. Remove the 402 error handling in the catch block (lines 95-97):
```typescript
    if (error.message.includes('Insufficient credits') || error.message.includes('Requires')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
```

The `Idempotency-Key` header is no longer needed since there's no credit operation. The rest of the handler (fetching review, calling `draftReply`, saving) stays the same.

**Step 2: Verify the file still has correct structure**

After edits, the POST handler should flow: `requireUser()` → fetch review → resolve signature → call `draftReply()` → save draft → return. No credit logic.

**Step 3: Commit**

```bash
git add app/api/reviews/[reviewId]/draft/route.ts
git commit -m "feat: make draft generation free (remove spendCredits from draft endpoint)"
```

---

### Task 3: Remove `spendCredits` from Stream Endpoint

Make streaming draft generation free.

**Files:**
- Modify: `app/api/reviews/[reviewId]/stream/route.ts`

**Step 1: Remove spendCredits from the POST handler**

In `app/api/reviews/[reviewId]/stream/route.ts`:

1. Remove the import: `import { spendCredits } from '@/lib/billing/credits'`
2. Remove `import crypto from 'crypto'`
3. Remove line 30 (`const idempotencyKey = ...`)
4. Remove the entire credit-spending block (lines 35-46):
```typescript
    if (mode === 'generate') {
      // Spend 1 credit for generation before we stream
      await spendCredits(
        review.locations?.team_id,
        user.id,
        'reply_generate',
        1,
        'review',
        params.reviewId,
        idempotencyKey
      )
    }
```
5. Remove the 402 error handling in the outer catch (lines 141-145):
```typescript
    if (error.message.includes('Insufficient credits') || error.message.includes('Requires')) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }
```

The `mode` variable is still used later (line 105: `if (mode === 'generate') { updateFields.reply_status = 'draft' }`), so keep the body parsing and mode logic.

**Step 2: Commit**

```bash
git add app/api/reviews/[reviewId]/stream/route.ts
git commit -m "feat: make streaming draft generation free (remove spendCredits from stream endpoint)"
```

---

### Task 4: Add `spendCredits` to Post-Reply Endpoint

Posting a reply now costs 1 credit.

**Files:**
- Modify: `app/api/reviews/[reviewId]/post-reply/route.ts`

**Step 1: Add credit spending before the Google API call**

In `app/api/reviews/[reviewId]/post-reply/route.ts`:

1. Add imports at top:
```typescript
import { spendCredits } from '@/lib/billing/credits'
```

Note: `crypto` is already imported in this file (line 8).

2. After the comment validation check (line 39, after `if (!comment)` block), and before the Google identity lookup, add:

```typescript
    // Spend 1 credit for posting
    const idempotencyKey = headers.get('Idempotency-Key') || crypto.randomUUID()
    await spendCredits(
      review.location.team_id,
      user.id,
      'reply_post',
      1,
      'review',
      params.reviewId,
      idempotencyKey
    )
```

Note: `headers` is already defined on line 15 as `request.headers`. But wait — looking at the code again, `headers` is actually not defined. The existing code has `const headers = request.headers` on line 15... let me check. Actually line 14 is `const headers = request.headers`. Good, `headers` is available.

3. Add 402 error handling in the outer catch block (before the ZodError check):
```typescript
    if (error.message?.includes('Insufficient credits') || error.message?.includes('Requires')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
```

**Step 2: Commit**

```bash
git add app/api/reviews/[reviewId]/post-reply/route.ts
git commit -m "feat: charge 1 credit for posting replies (post-reply endpoint)"
```

---

### Task 5: Add `spendCredits` to Publish Endpoint

The simpler publish endpoint also needs credit charging.

**Files:**
- Modify: `app/api/reviews/[reviewId]/publish/route.ts`

**Step 1: Add credit spending before the Google API call**

In `app/api/reviews/[reviewId]/publish/route.ts`:

1. Add imports:
```typescript
import { spendCredits } from '@/lib/billing/credits'
import crypto from 'crypto'
```

2. After the `if (!replyText)` check (line 29) and before the location check (line 31), add:

```typescript
    // Spend 1 credit for posting
    const idempotencyKey = request.headers.get('Idempotency-Key') || crypto.randomUUID()
    await spendCredits(
      review.locations?.team_id || '',
      user.id,
      'reply_post',
      1,
      'review',
      params.reviewId,
      idempotencyKey
    )
```

Note: This endpoint uses `review.locations` (plural, not aliased) for the location join. The team_id comes from `review.locations.team_id`. Check the select query at line 16: `.select('*, locations(google_location_id, google_account_hint)')` — it doesn't select `team_id`. You need to add `team_id` to the select: `.select('*, locations(google_location_id, google_account_hint, team_id)')`.

3. Add 402 error handling in the catch block (before the generic error):
```typescript
    if (error.message?.includes('Insufficient credits') || error.message?.includes('Requires')) {
      return NextResponse.json({ error: error.message }, { status: 402 })
    }
```

**Step 2: Commit**

```bash
git add app/api/reviews/[reviewId]/publish/route.ts
git commit -m "feat: charge 1 credit for posting replies (publish endpoint)"
```

---

### Task 6: Create Digest Summary Generator

New OpenAI helper that generates a 2-3 sentence sentiment summary of a batch of reviews.

**Files:**
- Create: `lib/openai/digest-summary.ts`

**Step 1: Create the file**

Create `lib/openai/digest-summary.ts`:

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

interface DigestReviewInput {
  rating: number
  comment: string | null
  reviewer_name: string | null
  location_name: string
}

/**
 * Generates a 2-3 sentence sentiment summary of a batch of reviews.
 * Used in the digest email to give a quick overview.
 */
export async function generateDigestSummary(
  reviews: DigestReviewInput[],
  teamName: string
): Promise<string> {
  const reviewLines = reviews.map((r, i) =>
    `${i + 1}. ${r.rating}/5 stars at ${r.location_name} by ${r.reviewer_name || 'Anonymous'}: "${r.comment || 'No comment'}"`
  ).join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You summarize batches of customer reviews for a business owner. Write a 2-3 sentence snapshot of the overall sentiment, highlighting key themes (positive and negative). Be direct and actionable. Do not use em dashes. Output ONLY the summary paragraph, no labels or preamble.`,
      },
      {
        role: 'user',
        content: `Here are ${reviews.length} new reviews for ${teamName}:\n\n${reviewLines}`,
      },
    ],
    max_completion_tokens: 200,
  })

  return completion.choices[0].message.content || 'Unable to generate summary.'
}
```

**Step 2: Commit**

```bash
git add lib/openai/digest-summary.ts
git commit -m "feat: add digest summary generator (LLM sentiment snapshot)"
```

---

### Task 7: Update Email Template for Drafts and Summary

Add sentiment summary section and draft preview per review to the digest email.

**Files:**
- Modify: `lib/email/templates/review-digest.ts`

**Step 1: Update the DigestReview interface**

Add `draftPreview` field:

```typescript
interface DigestReview {
  reviewerName: string
  rating: number
  comment: string
  locationName: string
  replyStatus: string
  draftPreview?: string  // AI-generated draft reply
}
```

**Step 2: Update ReviewDigestEmailParams interface**

Add `summaryParagraph` field:

```typescript
interface ReviewDigestEmailParams {
  teamName: string
  newReviewCount: number
  needsReplyCount: number
  avgRating: string
  reviews: DigestReview[]
  teamUrl: string
  unsubscribeUrl: string
  summaryParagraph?: string  // LLM-generated sentiment summary
}
```

**Step 3: Add summary paragraph HTML**

In the `buildReviewDigestEmail` function, after the destructuring, add `summaryParagraph` to the destructured params. Then, between the stats row `</table>` (line 109) and the closing `</td></tr>` of the summary section (line 111), add the summary block:

```typescript
const summaryHtml = summaryParagraph ? `
  <div style="margin-top:20px;padding:16px 20px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;">
    <div style="font-size:12px;font-weight:600;color:#0d9488;text-transform:uppercase;margin-bottom:8px;">Sentiment Snapshot</div>
    <div style="color:#374151;font-size:14px;line-height:1.6;">${summaryParagraph}</div>
  </div>
` : ''
```

Insert `${summaryHtml}` right after the stats row table closing tag, before the section's `</td></tr>`.

**Step 4: Add draft preview to each review row**

In the `reviewRows` mapping, after the comment `<div>` (line 53), add a conditional draft preview block:

```typescript
${r.draftPreview ? `
  <div style="margin-top:10px;padding:10px 14px;background:#f0fdfa;border-left:3px solid #0d9488;border-radius:0 6px 6px 0;">
    <div style="font-size:11px;font-weight:600;color:#0d9488;margin-bottom:4px;">Suggested Reply</div>
    <div style="color:#4b5563;font-size:13px;line-height:1.5;font-style:italic;">${truncate(r.draftPreview, 200)}</div>
  </div>
` : ''}
```

**Step 5: Commit**

```bash
git add lib/email/templates/review-digest.ts
git commit -m "feat: add sentiment summary and draft previews to digest email template"
```

---

### Task 8: Update Cron Handler to Generate Drafts and Summary

The cron handler at `app/api/cron/review-digest/route.ts` needs to generate drafts for unreplied reviews and a sentiment summary before sending each email.

**Files:**
- Modify: `app/api/cron/review-digest/route.ts`

**Step 1: Add new imports**

At the top of the file, add:

```typescript
import { draftReply, LocationSettings } from '@/lib/openai/draft'
import { generateDigestSummary } from '@/lib/openai/digest-summary'
```

**Step 2: Expand the reviews query**

The existing query (line 72-78) selects:
```
'reviewer_name, rating, comment, reply_status, location:locations(name, team_id)'
```

Change it to include location settings needed for draft generation:

```typescript
.select('id, reviewer_name, rating, comment, reply_status, location:locations(id, name, team_id, brand_voice, positive_sentiment, negative_sentiment, signature, reply_language)')
```

**Step 3: Add draft generation and summary logic**

After the `validReviews` filtering (line 83-85) and before `needsReply` (line 87), add draft generation for reviews that need replies:

```typescript
      // Generate drafts for reviews needing replies
      const reviewsWithDrafts = await Promise.all(
        validReviews.map(async (r: any) => {
          if (r.reply_status !== 'none') {
            return { ...r, draftPreview: null }
          }
          try {
            const draft = await draftReply(
              { id: r.id, rating: r.rating, comment: r.comment, reviewer_name: r.reviewer_name },
              {
                location_id: r.location?.id,
                brand_voice: r.location?.brand_voice,
                positive_sentiment: r.location?.positive_sentiment,
                negative_sentiment: r.location?.negative_sentiment,
                signature: r.location?.signature,
                reply_language: r.location?.reply_language,
              }
            )

            // Save the draft to the database so it's ready when user opens the app
            await supabase
              .schema('app')
              .from('google_reviews')
              .update({
                draft_text: draft,
                reply_status: 'draft',
                draft_updated_at: new Date().toISOString(),
                llm_last_generated_at: new Date().toISOString(),
                llm_model: 'gpt-4o-mini',
              })
              .eq('id', r.id)

            return { ...r, draftPreview: draft }
          } catch (err) {
            // Draft generation failed for this review — continue without draft
            return { ...r, draftPreview: null }
          }
        })
      )
```

After draft generation, generate the sentiment summary:

```typescript
      // Generate sentiment summary
      let summaryParagraph: string | undefined
      try {
        summaryParagraph = await generateDigestSummary(
          validReviews.map((r: any) => ({
            rating: r.rating,
            comment: r.comment,
            reviewer_name: r.reviewer_name,
            location_name: r.location?.name || 'Unknown',
          })),
          p.team?.name || 'Your Team'
        )
      } catch {
        // Summary generation failed — send email without it
      }
```

**Step 4: Update the email builder call**

Replace the existing `needsReply` and `avgRating` calculations to use `reviewsWithDrafts` instead of `validReviews` where appropriate, and update the `buildReviewDigestEmail` call:

The `needsReply` and `avgRating` lines stay the same (they still reference `validReviews`).

Update the `reviews` mapping and add `summaryParagraph` to the call:

```typescript
      const { subject, html } = buildReviewDigestEmail({
        teamName: p.team?.name || 'Your Team',
        newReviewCount: validReviews.length,
        needsReplyCount: needsReply,
        avgRating,
        reviews: reviewsWithDrafts.map((r: any) => ({
          reviewerName: r.reviewer_name,
          rating: r.rating,
          comment: r.comment || '',
          locationName: r.location?.name || 'Unknown',
          replyStatus: r.reply_status,
          draftPreview: r.draftPreview || undefined,
        })),
        teamUrl,
        unsubscribeUrl,
        summaryParagraph,
      })
```

**Step 5: Commit**

```bash
git add app/api/cron/review-digest/route.ts
git commit -m "feat: generate draft replies and sentiment summary in digest cron"
```

---

### Task 9: Build Verification

Run the full build to catch any TypeScript errors.

**Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

**Step 2: Fix any issues**

If the build fails, fix TypeScript errors. Common issues:
- Missing imports
- Type mismatches in the email template interface
- Select query field names not matching

**Step 3: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve build errors from enhanced digest implementation"
```

---

### Task 10: Manual Cron Test

Test the enhanced cron endpoint locally.

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Call the cron endpoint**

```bash
curl.exe -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/review-digest
```

Expected: JSON response like `{"sent":1,"skipped":0}` or similar. Check:
- No 500 errors
- Digest email received with sentiment summary paragraph
- Draft previews visible under reviews that had `reply_status: 'none'`
- Drafts saved to database (`google_reviews.draft_text` populated)

**Step 3: Verify draft is free**

```bash
curl.exe -X POST -H "Content-Type: application/json" -H "Cookie: <session-cookie>" http://localhost:3000/api/reviews/<reviewId>/draft
```

Expected: Draft generated, NO credit deducted. Check `team_credit_transactions` — no new `reply_generate` row.

**Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "fix: final adjustments from manual testing"
```
