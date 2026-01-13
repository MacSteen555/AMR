import axios from 'axios'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const serpApiKey = process.env.SERP_API_KEY!

if (!serpApiKey) {
  throw new Error('Missing SERP_API_KEY')
}

const SERP_API_URL = 'https://serpapi.com/search'

/**
 * Fetches competitor reviews from SerpAPI with pagination.
 * Implements the algorithm: fetch until next_page_token is null or empty, or MAX 10 pages.
 * Filters reviews to <= 1 year old.
 */
export async function fetchCompetitorReviews(
  placeId: string,
  competitorId: string
): Promise<{ totalFetched: number; totalUpserted: number }> {
  const serviceClient = createSupabaseServiceRoleClient()
  let nextPageToken: string | null = null
  let totalFetched = 0
  let totalUpserted = 0
  let pageCount = 0
  const MAX_PAGES = 10
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  do {
    pageCount++
    const params: any = {
      engine: 'google_maps_reviews',
      api_key: serpApiKey,
      place_id: placeId,
    }

    if (nextPageToken) {
      params.next_page_token = nextPageToken
    }

    const response = await axios.get(SERP_API_URL, { params })
    const data = response.data

    if (!data.reviews || !Array.isArray(data.reviews)) {
      break
    }

    // Filter reviews to <= 1 year old and upsert
    for (const review of data.reviews) {
      totalFetched++

      if (!review.date) {
        continue
      }

      const reviewDate = new Date(review.date)
      if (reviewDate < oneYearAgo) {
        continue // Skip reviews older than 1 year
      }

      // Upsert competitor review
      const { error } = await serviceClient
        .schema('app').from('competitor_reviews')
        .upsert(
          {
            competitor_id: competitorId,
            serpapi_review_id: review.review_id || review.id || `${reviewDate.getTime()}-${review.reviewer_name}`,
            rating: review.rating || null,
            reviewer_name: review.reviewer_name || null,
            reviewer_profile_url: review.reviewer_profile_url || null,
            reviewer_contributor_id: review.reviewer_contributor_id || null,
            reviewer_is_local_guide: review.reviewer_is_local_guide || false,
            reviewer_reviews_count: review.reviewer_reviews_count || null,
            reviewer_photos_count: review.reviewer_photos_count || null,
            comment: review.snippet || review.comment || null,
            review_date: reviewDate.toISOString(),
            review_date_text: review.date || null,
            review_url: review.review_url || null,
            image_urls: review.images || [],
            details: review.details || null,
            likes: review.likes || null,
            owner_response: review.owner_response || null,
            raw_payload: review,
          },
          {
            onConflict: 'competitor_id,serpapi_review_id',
          }
        )

      if (!error) {
        totalUpserted++
      }
    }

    // Check for next page
    nextPageToken = data.serpapi_pagination?.next_page_token || null

    // Stop if next_page_token is null or empty, or if we've reached max pages
    if (!nextPageToken || nextPageToken === '' || pageCount >= MAX_PAGES) {
      break
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } while (nextPageToken && pageCount < MAX_PAGES)

  return { totalFetched, totalUpserted }
}

