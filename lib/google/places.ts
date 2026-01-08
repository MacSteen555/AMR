import axios from 'axios'

const apiKey = process.env.GOOGLE_MAPS_API_KEY!

if (!apiKey) {
  throw new Error('Missing GOOGLE_MAPS_API_KEY')
}

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchText'

/**
 * Searches for places using Google Places API (New).
 * Implements the exact behavior from the sample code.
 */
export async function searchPlaces(query: string): Promise<any> {
  const response = await axios.post(
    PLACES_API_URL,
    {
      textQuery: query,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.websiteUri,places.nationalPhoneNumber,places.businessStatus',
      },
    }
  )

  return response.data
}

