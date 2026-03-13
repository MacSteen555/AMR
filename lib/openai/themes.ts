import OpenAI from 'openai'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const BATCH_SIZE = 20

interface ReviewForThemes {
  id: string
  comment: string
}

/**
 * Extracts themes for untagged reviews belonging to a location.
 *
 * Processes reviews in sequential batches of 20. After each batch:
 * 1. New themes are written to the team's theme_dictionary
 * 2. Reviews are updated with their assigned themes
 * 3. The next batch's prompt includes the freshly updated dictionary
 *
 * This sequential approach ensures the dictionary grows incrementally,
 * so later batches converge on existing labels instead of creating duplicates.
 *
 * Only processes reviews where comment IS NOT NULL and themes IS NULL.
 * The themes IS NULL guard ensures a review is never processed twice.
 */
export async function extractThemesForLocation(locationId: string): Promise<number> {
  console.log(`[themes] Starting theme extraction for location ${locationId}`)
  const serviceClient = createSupabaseServiceRoleClient()

  // 1. Get team_id from location
  const { data: location, error: locError } = await serviceClient
    .schema('app')
    .from('locations')
    .select('team_id')
    .eq('id', locationId)
    .single()

  if (!location) {
    console.log(`[themes] No location found for ${locationId}`, locError?.message)
    return 0
  }

  const teamId = location.team_id

  // 2. Fetch ALL untagged reviews with comments upfront
  const { data: allUntagged, error: reviewError } = await serviceClient
    .schema('app')
    .from('google_reviews')
    .select('id, comment')
    .eq('location_id', locationId)
    .not('comment', 'is', null)
    .is('themes', null)
    .order('review_date', { ascending: true })
    .limit(200)

  console.log(`[themes] Found ${allUntagged?.length ?? 0} untagged reviews`, reviewError?.message ?? '')

  if (!allUntagged || allUntagged.length === 0) return 0

  // 3. Fetch existing theme dictionary (starting point)
  const { data: existingThemes } = await serviceClient
    .schema('app')
    .from('theme_dictionary')
    .select('label')
    .eq('team_id', teamId)

  const knownLabels = new Set((existingThemes || []).map(t => t.label))
  console.log(`[themes] Starting dictionary: ${knownLabels.size} themes`)

  // 4. Process in sequential batches
  let totalTagged = 0

  for (let i = 0; i < allUntagged.length; i += BATCH_SIZE) {
    const batch = allUntagged.slice(i, i + BATCH_SIZE) as ReviewForThemes[]
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`[themes] Batch ${batchNum}: classifying ${batch.length} reviews (dictionary: ${knownLabels.size} themes)`)

    // Classify this batch with the current dictionary
    const tagged = await classifyReviews(batch, [...knownLabels])

    if (tagged.length === 0) continue

    // Collect new themes from this batch
    const batchNewThemes: string[] = []
    for (const entry of tagged) {
      for (const theme of entry.themes) {
        if (!knownLabels.has(theme)) {
          knownLabels.add(theme)
          batchNewThemes.push(theme)
        }
      }
    }

    // Insert new themes into dictionary BEFORE processing next batch
    if (batchNewThemes.length > 0) {
      console.log(`[themes] Batch ${batchNum}: adding ${batchNewThemes.length} new themes:`, batchNewThemes)
      await serviceClient
        .schema('app')
        .from('theme_dictionary')
        .upsert(
          batchNewThemes.map(label => ({ team_id: teamId, label })),
          { onConflict: 'team_id,label' }
        )
    }

    // Write themes back to reviews
    for (const entry of tagged) {
      const { error: updateError } = await serviceClient
        .schema('app')
        .from('google_reviews')
        .update({ themes: entry.themes })
        .eq('id', entry.id)
        .is('themes', null) // race guard

      if (updateError) {
        console.error(`[themes] Failed to update review ${entry.id}:`, updateError.message)
      }
    }

    totalTagged += tagged.length
  }

  console.log(`[themes] Done. Tagged ${totalTagged} reviews. Final dictionary: ${knownLabels.size} themes`)
  return totalTagged
}

async function classifyReviews(
  reviews: ReviewForThemes[],
  existingThemes: string[]
): Promise<Array<{ id: string; themes: string[] }>> {
  const themeList = existingThemes.length > 0
    ? `Existing themes (REUSE these when they fit, only create new ones if truly needed): ${existingThemes.join(', ')}`
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
