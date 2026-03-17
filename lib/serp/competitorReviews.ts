import axios from 'axios'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

const serpApiKey = process.env.SERP_API_KEY!

if (!serpApiKey) {
  throw new Error('Missing SERP_API_KEY')
}

const SERP_API_URL = 'https://serpapi.com/search'

/**
 * Helper to parse relative date strings from SerpAPI like "a week ago", "3 months ago"
 */
function parseRelativeDate(dateStr: string): Date {
  const date = new Date()
  if (!dateStr) return date

  const str = dateStr.toLowerCase()
  const extractNum = (s: string) => {
    const match = s.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 1
  }

  if (str.includes('year')) {
    date.setFullYear(date.getFullYear() - extractNum(str))
  } else if (str.includes('month')) {
    date.setMonth(date.getMonth() - extractNum(str))
  } else if (str.includes('week')) {
    date.setDate(date.getDate() - (extractNum(str) * 7))
  } else if (str.includes('day')) {
    date.setDate(date.getDate() - extractNum(str))
  } else if (str.includes('hour')) {
    date.setHours(date.getHours() - extractNum(str))
  } else if (str.includes('minute')) {
    date.setMinutes(date.getMinutes() - extractNum(str))
  }

  return date
}

/**
 * Fetches competitor reviews from SerpAPI with pagination.
 * Implements the algorithm: fetch until next_page_token is null or empty, or MAX 10 pages.
 * Filters reviews to <= 1 year old, max 100 reviews total.
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
  const MAX_REVIEWS = 100
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

    // Filter reviews to <= 1 year old and upsert up to MAX_REVIEWS
    for (const review of data.reviews) {
      if (totalFetched >= MAX_REVIEWS) {
        break
      }

      if (!review.date && !review.iso_date) {
        continue
      }

      const reviewDate = review.iso_date ? new Date(review.iso_date) : parseRelativeDate(review.date)
      if (reviewDate < oneYearAgo) {
        continue // Skip reviews older than 1 year
      }

      totalFetched++

      // Upsert competitor review
      const { error } = await serviceClient
        .schema('app').from('competitor_reviews')
        .upsert(
          {
            competitor_id: competitorId,
            serpapi_review_id: review.review_id || review.id || `${reviewDate.getTime()}-${review.user?.name || 'unknown'}`,
            rating: review.rating || null,
            reviewer_name: review.user?.name || null,
            reviewer_profile_url: review.user?.link || null,
            reviewer_contributor_id: review.user?.contributor_id || null,
            reviewer_is_local_guide: review.user?.local_guide || false,
            reviewer_reviews_count: review.user?.reviews || null,
            reviewer_photos_count: review.user?.photos || null,
            comment: review.snippet || review.comment || null,
            review_date: review.iso_date || reviewDate.toISOString(),
            review_date_text: review.date || null,
            review_url: review.link || null,
            image_urls: review.images || [],
            details: review.details || null,
            likes: review.likes || null,
            owner_response: review.response?.snippet || review.owner_response?.snippet || null,
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

    if (totalFetched >= MAX_REVIEWS) {
      break
    }

    // Check for next page
    nextPageToken = data.serpapi_pagination?.next_page_token || null

    // Stop if next_page_token is null or empty, or if we've reached max pages
    if (!nextPageToken || nextPageToken === '' || pageCount >= MAX_PAGES) {
      break
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000))
  } while (nextPageToken && pageCount < MAX_PAGES && totalFetched < MAX_REVIEWS)

  return { totalFetched, totalUpserted }
}

