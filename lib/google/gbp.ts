import { google } from 'googleapis'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

/**
 * Gets an authenticated OAuth2 client for a user.
 */
export async function getOAuth2ClientForUser(userId: string): Promise<google.auth.OAuth2Client> {
  const serviceClient = createSupabaseServiceRoleClient()

  // Get user identity and encrypted token
  const { data: identity, error: identityError } = await serviceClient
    .schema('app').from('user_identities')
    .select('*, google_tokens!inner(*)')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single()

  if (identityError || !identity || !identity.google_tokens) {
    throw new Error('Google identity or token not found')
  }

  // Decrypt refresh token using Node.js crypto
  const { decrypt } = await import('@/lib/crypto/encrypt')
  const encryptedToken = identity.google_tokens.encrypted_refresh_token
  
  // Handle both text and bytea formats (for backward compatibility)
  let encryptedString: string
  if (typeof encryptedToken === 'string') {
    encryptedString = encryptedToken
  } else {
    // Convert bytea to base64 string
    encryptedString = Buffer.from(encryptedToken).toString('base64')
  }
  
  const decryptedToken = decrypt(encryptedString)

  // Create OAuth2 client and refresh access token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID!,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET!
  )

  oauth2Client.setCredentials({
    refresh_token: decryptedToken,
  })

  await oauth2Client.refreshAccessToken()

  return oauth2Client
}

/**
 * Lists all Google Business Profile accounts accessible to the user.
 */
export async function listAccounts(userId: string): Promise<any[]> {
  const auth = await getOAuth2ClientForUser(userId)
  const mybusiness = google.mybusinessaccountmanagement({ version: 'v1', auth })

  const response = await mybusiness.accounts.list()

  return response.data.accounts || []
}

/**
 * Lists all locations for a given account.
 */
export async function listLocations(accountId: string, userId: string): Promise<any[]> {
  const auth = await getOAuth2ClientForUser(userId)
  const mybusiness = google.mybusinessaccountmanagement({ version: 'v1', auth })

  const response = await mybusiness.accounts.locations.list({
    parent: `accounts/${accountId}`,
  })

  return response.data.locations || []
}

/**
 * Lists reviews for a location with pagination.
 */
export async function listReviews(
  accountId: string,
  locationId: string,
  userId: string,
  pageSize: number = 50,
  pageToken?: string
): Promise<{ reviews: any[]; nextPageToken?: string }> {
  const auth = await getOAuth2ClientForUser(userId)
  const mybusiness = google.mybusiness({ version: 'v4', auth })

  const response = await mybusiness.accounts.locations.reviews.list({
    parent: `accounts/${accountId}/locations/${locationId}`,
    pageSize,
    pageToken,
  })

  return {
    reviews: response.data.reviews || [],
    nextPageToken: response.data.nextPageToken,
  }
}

/**
 * Posts or updates a reply to a review.
 */
export async function updateReply(
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
  userId: string
): Promise<void> {
  const auth = await getOAuth2ClientForUser(userId)
  const mybusiness = google.mybusiness({ version: 'v4', auth })

  await mybusiness.accounts.locations.reviews.updateReply({
    name: `accounts/${accountId}/locations/${locationId}/reviews/${reviewId}`,
    requestBody: {
      comment,
    },
  })
}

