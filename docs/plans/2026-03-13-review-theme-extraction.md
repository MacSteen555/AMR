# Review Theme Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically tag each review with broad themes during sync, using a lightweight LLM call, while maintaining a clean per-team theme dictionary.

**Architecture:** After reviews are upserted during sync, query for reviews that have a `comment` but `themes IS NULL`. Batch these and send to `gpt-4.1-mini` with the team's existing theme dictionary so it maps to existing themes or proposes new ones. Write themes back to reviews and new themes to the dictionary. Never re-process a review that already has themes.

**Tech Stack:** OpenAI (`gpt-4.1-mini`), Supabase service client, existing sync routes.

---

### Task 1: Create `lib/openai/themes.ts` — Theme extraction function

**Files:**
- Create: `lib/openai/themes.ts`

**Code:**

```typescript
import OpenAI from 'openai'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

interface ReviewForThemes {
  id: string
  comment: string
}

/**
 * Extracts themes for untagged reviews belonging to a location.
 * Fetches the team's theme dictionary, sends reviews + dictionary to a lightweight model,
 * writes themes back to reviews and new themes to the dictionary.
 *
 * Only processes reviews where comment IS NOT NULL and themes IS NULL.
 */
export async function extractThemesForLocation(locationId: string): Promise<number> {
  const serviceClient = createSupabaseServiceRoleClient()

  // 1. Get team_id from location
  const { data: location } = await serviceClient
    .schema('app')
    .from('locations')
    .select('team_id')
    .eq('id', locationId)
    .single()

  if (!location) return 0

  const teamId = location.team_id

  // 2. Fetch untagged reviews with comments
  const { data: untagged } = await serviceClient
    .schema('app')
    .from('google_reviews')
    .select('id, comment')
    .eq('location_id', locationId)
    .not('comment', 'is', null)
    .is('themes', null)
    .limit(50)

  if (!untagged || untagged.length === 0) return 0

  // 3. Fetch existing theme dictionary for this team
  const { data: existingThemes } = await serviceClient
    .schema('app')
    .from('theme_dictionary')
    .select('label')
    .eq('team_id', teamId)

  const knownLabels = (existingThemes || []).map(t => t.label)

  // 4. Call LLM to classify
  const tagged = await classifyReviews(
    untagged as ReviewForThemes[],
    knownLabels
  )

  // 5. Collect any new themes the model created
  const allAssigned = new Set<string>()
  for (const entry of tagged) {
    for (const theme of entry.themes) allAssigned.add(theme)
  }
  const newThemes = [...allAssigned].filter(t => !knownLabels.includes(t))

  // 6. Insert new themes into dictionary
  if (newThemes.length > 0) {
    await serviceClient
      .schema('app')
      .from('theme_dictionary')
      .upsert(
        newThemes.map(label => ({ team_id: teamId, label })),
        { onConflict: 'team_id,label' }
      )
  }

  // 7. Write themes back to each review
  for (const entry of tagged) {
    await serviceClient
      .schema('app')
      .from('google_reviews')
      .update({ themes: entry.themes })
      .eq('id', entry.id)
      .is('themes', null) // double-check: only update if still null (race guard)
  }

  return tagged.length
}

async function classifyReviews(
  reviews: ReviewForThemes[],
  existingThemes: string[]
): Promise<Array<{ id: string; themes: string[] }>> {
  const themeList = existingThemes.length > 0
    ? `Existing themes (reuse these when they fit): ${existingThemes.join(', ')}`
    : 'No existing themes yet. Create broad categories as needed.'

  const reviewBlock = reviews
    .map(r => `[${r.id}] ${r.comment}`)
    .join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: `You classify business reviews into broad themes (5-15 total categories like "service", "food quality", "atmosphere", "wait time", "cleanliness", "value", "staff", "parking", etc.).

Rules:
- Reuse existing themes whenever possible. Only create a new theme if none of the existing ones fit.
- Each review gets 1-3 themes. Use fewer when the review is short or about one thing.
- Theme labels should be lowercase, 1-3 words.
- If a review has no meaningful content to classify, return an empty array for it.
- Return valid JSON only.`
      },
      {
        role: 'user',
        content: `${themeList}

Reviews:
${reviewBlock}

Return JSON: { "results": [{ "id": "review-uuid", "themes": ["theme1", "theme2"] }] }`
      }
    ],
    max_completion_tokens: 2000,
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) return []

  try {
    const parsed = JSON.parse(text)
    return (parsed.results || []).filter(
      (r: any) => r.id && Array.isArray(r.themes)
    )
  } catch {
    return []
  }
}
```

### Task 2: Integrate into location sync route

**Files:**
- Modify: `app/api/locations/[locationId]/reviews/sync/route.ts`

Add import at top, call `extractThemesForLocation` after the sync loop completes (after updating sync status), fire-and-forget so it doesn't block the sync response.

### Task 3: Integrate into team sync route

**Files:**
- Modify: `app/api/teams/[teamId]/reviews/sync/route.ts`

Same pattern — after each location syncs successfully, call `extractThemesForLocation` for that location. Fire-and-forget.

### Task 4: Set empty themes array for rating-only reviews

During sync upsert, for reviews with no comment, set `themes: []` (empty array, not null) so they're never picked up for classification. This prevents wasting LLM calls on reviews that have nothing to classify.
