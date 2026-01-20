import axios from 'axios'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY!
const PLACES_API_URL = process.env.PLACES_API_URL!

if (!GOOGLE_MAPS_API_KEY || !PLACES_API_URL) {
  throw new Error('Missing GOOGLE_MAPS_API_KEY or PLACES_API_URL')
}

/**
 * Searches for places using Google Places API (New)
 */
export async function searchPlaces(query: string): Promise<any> {
  const response = await axios.post(
    PLACES_API_URL,
    { textQuery: query },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.websiteUri,places.nationalPhoneNumber,places.businessStatus',
      },
    }
  )
  return response.data
}
