# Enhanced Review Digest: Draft Previews, Sentiment Summary & Credit Model Shift

## Goal

Enhance the existing review digest email with AI-generated draft reply previews and an LLM sentiment summary, while shifting the global credit model so that generating drafts is free and posting replies costs 1 credit.

## Architecture

The cron job (`app/api/cron/review-digest/route.ts`) already fetches reviews and sends digest emails. We extend it to: (1) generate a draft reply for each review using the existing `draftReply()` function from `lib/openai/draft.ts`, (2) generate a sentiment summary paragraph via a new `generateDigestSummary()` function, and (3) include both in the email template. The credit model change is a separate, global modification: remove `spendCredits` from draft/stream endpoints and add it to post-reply/publish endpoints.

## Tech Stack

- OpenAI `gpt-4o-mini` (existing, used for drafts + new summary)
- Resend (existing email service)
- Supabase service role client (existing)
- Vercel Cron (existing)

---

## Changes

### 1. Global Credit Model Shift

**Drafts become free everywhere:**
- Remove `spendCredits` call from `app/api/reviews/[reviewId]/draft/route.ts` (POST)
- Remove `spendCredits` call from `app/api/reviews/[reviewId]/stream/route.ts` (POST, inside `mode === 'generate'` block)
- Remove `spendCredits` import and related error handling where no longer needed

**Posting costs 1 credit:**
- Add `spendCredits` call to `app/api/reviews/[reviewId]/post-reply/route.ts` (1 credit, type `reply_post`)
- Add `spendCredits` call to `app/api/reviews/[reviewId]/publish/route.ts` (1 credit, type `reply_post`)
- Add 402 error handling for insufficient credits in both endpoints

**Not affected:** insights, competitive runs — those keep their existing credit costs.

### 2. Sentiment Summary Generation

New function `generateDigestSummary()` in `lib/openai/digest-summary.ts`:
- Input: array of reviews (rating, comment, reviewer_name, location_name)
- Output: 2-3 sentence natural language summary of the batch
- Uses `gpt-4o-mini` with a focused system prompt
- Called once per digest email in the cron handler

### 3. Draft Generation in Cron

For each review in the digest that has `reply_status === 'none'`:
- Call `draftReply()` from `lib/openai/draft.ts` (already exists)
- Need to fetch location settings (brand_voice, sentiments, signature) for each review
- Save the generated draft to `google_reviews.draft_text` (so it's ready when user opens the app)
- Include the draft preview in the email

### 4. Email Template Updates

Update `lib/email/templates/review-digest.ts`:
- Add `summaryParagraph` field to the interface
- Add `draftPreview` field to each review in the interface
- Render summary paragraph between stats row and review list
- Render draft preview below each review comment (light background, italic)
- Add "Edit in App" link per review

---

## Constraints

- No credit cost for digest-generated drafts (drafts are free globally now)
- Cron must handle failures gracefully: if draft generation fails for one review, skip it and continue
- Summary generation should not block individual review processing
- Email template must work in all major email clients (table-based layout)
- Bulk-generate endpoints (`bulk-generate/route.ts`) also use `draftReply` but don't call `spendCredits` directly — they won't be affected
