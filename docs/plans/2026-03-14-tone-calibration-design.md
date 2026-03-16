# Tone Calibration Design

## Problem

Users are bad at describing their own writing style. The current onboarding (pick professional/friendly/witty, edit a sample reply) produces generic brand voice prompts that don't capture the nuances that make each business's replies feel authentic.

## Solution

Replace onboarding step 3 with an A/B taste test. Generate 5 industry-relevant sample reviews with 2 reply options each. Each pair tests a specific tone dimension. User picks A or B, we synthesize their choices into a directional brand voice prompt.

## Calibration Flow

1. **Generate samples** — pull business name + category from GBP data. Generate 5 reviews (5★, 4★, 3★, 1★, 5★ rating-only) tailored to their industry. For each, generate reply A and reply B concurrently (10 replies total via `Promise.all` with `gpt-4o-mini`).

2. **User picks A or B** for each of the 5 reviews. Simple card UI — review on top, two options below, tap to select.

| Review | Stars | Dimension | Option A | Option B |
|--------|-------|-----------|----------|----------|
| 1 | 5★ | Warmth & energy | Enthusiastic, exclamatory | Warm but measured |
| 2 | 4★ | Personalization depth | References specific details | Gracious but general |
| 3 | 3★ | Criticism handling | Acknowledges + pivots to positive | Addresses head-on with explanation |
| 4 | 1★ | Defensiveness vs empathy | Factual, stands ground respectfully | Fully empathetic, takes it on the chin |
| 5 | 5★ (rating-only) | Length & formality | Brief and casual | Polished and structured |

3. **Contact email** — optional text input: "For negative reviews, would you like to include a contact email?"

4. **Review prompt** — show the generated brand voice prompt. User can tweak. Save.

## Data Model Changes

New columns on `app.locations`:

| Column | Type | Purpose |
|--------|------|---------|
| `tone_calibration` | `jsonb` | Raw A/B picks + business type (preserved for re-generation) |
| `negative_contact_email` | `text` | Optional email woven into negative reply generation |

`tone_calibration` shape:
```json
{
  "business_type": "dental_clinic",
  "picks": [
    { "review_index": 0, "stars": 5, "dimension": "warmth", "choice": "a" },
    { "review_index": 1, "stars": 4, "dimension": "personalization", "choice": "b" },
    { "review_index": 2, "stars": 3, "dimension": "criticism_handling", "choice": "a" },
    { "review_index": 3, "stars": 1, "dimension": "defensiveness", "choice": "b" },
    { "review_index": 4, "stars": 5, "dimension": "length_formality", "choice": "a" }
  ]
}
```

Existing columns unchanged: `brand_voice`, `positive_sentiment`, `negative_sentiment`, `neutral_sentiment`, `signature`, `reply_language`.

## API Design

### `POST /api/onboarding/generate-calibration`

Replaces `generate-sample-reviews`. Takes `{ location_id }`. Pulls business name + category from location GBP data. Returns 5 reviews with 2 replies each.

```json
{
  "reviews": [
    {
      "index": 0,
      "stars": 5,
      "dimension": "warmth",
      "reviewer_name": "Jessica",
      "comment": "Best cleaning I've ever had...",
      "reply_a": "Jessica, so glad you loved it!!...",
      "reply_b": "Thank you for the kind words, Jessica..."
    }
  ]
}
```

### `POST /api/onboarding/save-calibration`

Replaces `extract-brand-voice`. Takes picks + optional email.

```json
{
  "location_id": "uuid",
  "picks": [
    { "review_index": 0, "dimension": "warmth", "choice": "a" }
  ],
  "negative_contact_email": "hello@clinic.com"
}
```

This endpoint:
1. Takes the 5 picks
2. Calls GPT to synthesize into a directional brand voice prompt
3. Also generates `positive_sentiment`, `negative_sentiment`, `neutral_sentiment` from the picks
4. Saves `tone_calibration`, `brand_voice`, sentiments, and `negative_contact_email` to the location
5. Returns the generated prompt for user review

## Prompt Architecture (4 Layers)

### Layer 1 — Structural Rules (universal, hard constraints)
- No em dashes
- No "Dear [Name]" — use first name naturally
- No "valued customer", "we strive to"
- Never parrot negative language verbatim
- Never make unverifiable promises
- Match reply length to review length
- Output only the reply text

### Layer 2 — Calibrated Tone Direction (from A/B picks)
Directional brand voice prompt stored in `brand_voice`. Example:

> "Your voice is energetic and genuinely enthusiastic — you're not afraid to show excitement when a customer has a great experience. You keep replies concise and conversational rather than formal. When addressing concerns, you're straightforward and transparent; you'll explain your side of the story honestly rather than defaulting to apologies."

### Layer 3 — Sentiment-Specific Guidance
Per-rating-band instructions from `positive_sentiment`, `negative_sentiment`, `neutral_sentiment`. Pre-populated from calibration, editable in settings.

### Layer 4 — Variety Enforcement (per-request)
- Last 5 posted replies (`reply_text` where `reply_status = 'posted'`), falling back to `draft_text`
- Instruction: vary opening phrases, sentence structures, vocabulary
- Contact email for negatives (if configured)
- Signature as sign-off

### Prompt Assembly Order
```
[System] Structural rules (Layer 1)
[User]   Brand voice direction (Layer 2)
         Sentiment approach for this rating (Layer 3)
         The review to reply to
         Few-shot example (matched to rating band)
         Reply guidelines (length, language, signature, contact email)
         Rejected draft (if regenerating)
         Recent replies to avoid repeating (Layer 4)
```

## Brand Voice Synthesis Prompt

System prompt for the GPT call that turns 5 picks into a brand voice:

```
You are a brand voice analyst. You've observed a business owner choose between
pairs of review replies. Each pair tested a specific dimension of their
communication style. Your job is to synthesize their choices into a natural,
directional description of how this business communicates.

RULES:
- Write in second person ("You" / "Your voice")
- Be directional, not prescriptive. Say "you lean warm and casual" not "always
  use exclamation marks"
- 3-5 sentences maximum
- Never mention the calibration process, dimensions, or A/B testing
- The output should read like a creative brief, not a rulebook
- Capture the FEELING of their preferred style, not mechanical rules
```

User prompt constructed from picks:
```
Business type: {business_type}

The business owner made these choices:

1. WARMTH (5-star review): Chose {description of chosen option}
2. PERSONALIZATION (4-star review): Chose {description of chosen option}
3. CRITICISM HANDLING (3-star review): Chose {description of chosen option}
4. DEFENSIVENESS (1-star review): Chose {description of chosen option}
5. LENGTH & FORMALITY (5-star, rating-only): Chose {description of chosen option}

Write their brand voice description.
```

## Variety Query Update

Replace `getRecentDrafts` with `getRecentReplies`:
- Query last 5 reviews ordered by `replied_at` DESC (for posted) then `draft_updated_at` DESC (for drafts)
- Prioritize `reply_text` where `reply_status = 'posted'`
- Fall back to `draft_text` if fewer than 5 posted replies
- Same location scoping, exclude current review

## What Gets Removed

- `POST /api/onboarding/generate-sample-reviews` — replaced by `generate-calibration`
- `POST /api/onboarding/extract-brand-voice` — replaced by `save-calibration`
- Professional/friendly/witty picker UI in onboarding step 3
