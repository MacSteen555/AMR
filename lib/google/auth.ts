import { google } from 'googleapis'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto/encrypt'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!

/**
 * Gets a fresh access token for a user by refreshing their stored refresh token
 */
export async function getAccessToken(userId: string): Promise<string> {
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

  // Refresh access token using googleapis OAuth2Client
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token')
  }

  return credentials.access_token
}

/**
 * Makes an authenticated request to Google APIs
 */
export async function makeAuthenticatedRequest(
  userId: string,
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getAccessToken(userId)

  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

