import { google } from 'googleapis'
import { getAccessToken, makeAuthenticatedRequest } from './auth'

export interface GoogleBusinessReview {
  name: string
  reviewId: string
  reviewer: {
    profilePhotoUrl: string
    displayName: string
    isAnonymous: boolean
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment: string
  createTime: string
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
}

/**
 * Gets an authenticated OAuth2 client for googleapis
 */
async function getAuthClient(userId: string) {
  const accessToken = await getAccessToken(userId)
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID!,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET!
  )
  
  oauth2Client.setCredentials({ access_token: accessToken })
  return oauth2Client
}

/**
 * Lists all Google Business Profile accounts accessible to the user
 * Uses My Business Account Management API v1
 */
export async function listAccounts(userId: string): Promise<any[]> {
  const auth = await getAuthClient(userId)
  const mybusinessAccountManagement = google.mybusinessaccountmanagement({
    version: 'v1',
    auth,
  })

  const response = await mybusinessAccountManagement.accounts.list()
  return response.data.accounts || []
}

/**
 * Lists all locations for a given account
 * Uses My Business Business Information API v1
 */
export async function listLocations(accountId: string, userId: string): Promise<any[]> {
  const auth = await getAuthClient(userId)
  const mybusinessBusinessInformation = google.mybusinessbusinessinformation({
    version: 'v1',
    auth,
  })

  // Ensure accountId has the accounts/ prefix
  const parent = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`

  const response = await mybusinessBusinessInformation.accounts.locations.list({
    parent,
    readMask: 'name,title,websiteUri,regularHours,phoneNumbers,categories,latlng,metadata,storefrontAddress',
  })

  return response.data.locations || []
}

/**
 * Lists reviews for a location with pagination
 * Uses My Business API v4 (direct HTTP) as v1 doesn't have reviews endpoint
 */
export async function listReviews(
  accountId: string,
  locationId: string,
  userId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<{ reviews: GoogleBusinessReview[]; nextPageToken?: string }> {
  // Ensure accountId has the accounts/ prefix
  const fullAccountId = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`
  
  // Extract just the location ID if it's a full path
  let locationName = locationId
  if (locationId.includes('/locations/')) {
    locationName = locationId.split('/locations/')[1]
  } else if (locationId.startsWith('locations/')) {
    locationName = locationId.split('/')[1]
  }

  // Build URL with query parameters
  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
  })
  if (pageToken) {
    params.set('pageToken', pageToken)
  }

  const response = await makeAuthenticatedRequest(
    userId,
    `https://mybusiness.googleapis.com/v4/${fullAccountId}/locations/${locationName}/reviews?${params.toString()}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch reviews: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return {
    reviews: data.reviews || [],
    nextPageToken: data.nextPageToken,
  }
}

/**
 * Posts or updates a reply to a review
 * Uses My Business API v4 (direct HTTP) as this is the most reliable endpoint
 */
export async function updateReply(
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
  userId: string
): Promise<void> {
  // Ensure accountId has the accounts/ prefix
  const fullAccountId = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`
  
  // Extract just the location ID if it's a full path
  let locationName = locationId
  if (locationId.includes('/locations/')) {
    locationName = locationId.split('/locations/')[1]
  } else if (locationId.startsWith('locations/')) {
    locationName = locationId.split('/')[1]
  }

  const response = await makeAuthenticatedRequest(
    userId,
    `https://mybusiness.googleapis.com/v4/${fullAccountId}/locations/${locationName}/reviews/${reviewId}/reply`,
    {
      method: 'PUT',
      body: JSON.stringify({ comment }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to reply to review: ${response.status} - ${errorText}`)
  }
}
