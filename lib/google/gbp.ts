import { google } from 'googleapis'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto/encrypt'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!

/**
 * Gets an authenticated OAuth2 client for a user by decrypting their refresh token
 */
async function getAuthenticatedClient(userId: string) {
  const serviceClient = createSupabaseServiceRoleClient()

  // Get user's Google identity and encrypted token
  const { data: identity, error } = await serviceClient
    .schema('app')
    .from('user_identities')
    .select('*, google_tokens!inner(*)')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()

  if (error || !identity?.google_tokens) {
    throw new Error('Google identity not found')
  }

  // Decrypt refresh token
  const encryptedToken = identity.google_tokens.encrypted_refresh_token
  const refreshToken = typeof encryptedToken === 'string' 
    ? decrypt(encryptedToken)
    : decrypt(Buffer.from(encryptedToken).toString('base64'))

  // Create and configure OAuth2 client
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  await oauth2Client.refreshAccessToken()

  return oauth2Client
}

/**
 * Lists all Google Business Profile accounts accessible to the user
 */
export async function listAccounts(userId: string): Promise<any[]> {
  const auth = await getAuthenticatedClient(userId)
  const mybusiness = google.mybusinessaccountmanagement({ version: 'v1', auth })
  const response = await mybusiness.accounts.list()
  return response.data.accounts || []
}

/**
 * Lists all locations for a given account
 */
export async function listLocations(accountId: string, userId: string): Promise<any[]> {
  const auth = await getAuthenticatedClient(userId)
  
  // The Google Business Profile API structure varies by version
  // Using any to work around incomplete TypeScript definitions
  const mybusiness: any = google.mybusinessaccountmanagement({ version: 'v1', auth })
  const response = await mybusiness.accounts.locations.list({
    parent: `accounts/${accountId}`,
  })
  
  return response.data.locations || []
}

/**
 * Lists reviews for a location with pagination
 */
export async function listReviews(
  accountId: string,
  locationId: string,
  userId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<{ reviews: any[]; nextPageToken?: string }> {
  const auth = await getAuthenticatedClient(userId)
  
  // Using any due to incomplete TypeScript definitions for Google Business API
  const mybusiness: any = google.mybusinessbusinessinformation({ version: 'v1', auth })
  const response = await mybusiness.locations.reviews.list({
    parent: `locations/${locationId}`,
    pageSize,
    pageToken,
  })
  
  return {
    reviews: response.data.reviews || [],
    nextPageToken: response.data.nextPageToken,
  }
}

/**
 * Posts or updates a reply to a review
 */
export async function updateReply(
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
  userId: string
): Promise<void> {
  const auth = await getAuthenticatedClient(userId)
  
  // Using any due to incomplete TypeScript definitions
  const mybusiness: any = google.mybusinessbusinessinformation({ version: 'v1', auth })
  await mybusiness.locations.reviews.updateReply({
    name: `locations/${locationId}/reviews/${reviewId}/reply`,
    requestBody: { comment },
  })
}
