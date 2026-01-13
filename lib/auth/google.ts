import { google } from 'googleapis'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!
const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
const encryptionSecret = process.env.TOKEN_ENCRYPTION_SECRET!

if (!clientId || !clientSecret || !encryptionSecret) {
  throw new Error('Missing Google OAuth or encryption environment variables')
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

/**
 * Generates PKCE code verifier and challenge for OAuth flow.
 */
export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

/**
 * Generates the Google OAuth authorization URL with PKCE and required scopes.
 */
export function googleOAuthStart(): { url: string; codeVerifier: string; state: string } {
  const { codeVerifier, codeChallenge } = generatePKCE()
  const state = crypto.randomBytes(16).toString('hex')

  const scopes = [
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ]

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required for refresh token
    prompt: 'consent', // Force consent screen to get refresh token
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return { url, codeVerifier, state }
}

/**
 * Exchanges authorization code for tokens and creates Supabase session.
 * Stores refresh token encrypted in app.google_tokens.
 * Returns the Supabase user ID after signing in.
 */
export async function googleOAuthCallback(
  code: string,
  codeVerifier: string
): Promise<{ idToken: string; refreshToken: string; supabaseUserId: string }> {
  // Create a new OAuth2 client instance to ensure clean state
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  
  const { tokens: finalTokens } = await client.getToken({
    code,
    codeVerifier,
  })

  if (!finalTokens.id_token) {
    throw new Error('No ID token received from Google')
  }

  if (!finalTokens.refresh_token) {
    throw new Error('No refresh token received from Google')
  }

  // Get user info from Google
  client.setCredentials(finalTokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data: userInfo } = await oauth2.userinfo.get()

  // Sign in to Supabase with Google ID token (this creates the session)
  // Use server client so cookies are set via storage adapter
  const supabase = createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: finalTokens.id_token,
  })

  if (authError || !authData.user) {
    throw new Error(`Failed to sign in to Supabase: ${authError?.message}`)
  }

  if (!authData.session) {
    throw new Error('No session created after sign in')
  }

  const supabaseUserId = authData.user.id

  // Ensure app user exists
  const serviceClient = createSupabaseServiceRoleClient()
  
  // Check if app user exists, create if not
  const { data: existingUser } = await serviceClient
    .schema('app')
    .from('users')
    .select('*')
    .eq('id', supabaseUserId)
    .single()

  if (!existingUser) {
    // Create app user
    const { error: userError } = await serviceClient
      .schema('app')
      .from('users')
      .insert({
        id: supabaseUserId,
        email: authData.user.email || userInfo.email || '',
        display_name: authData.user.user_metadata?.display_name || userInfo.name || null,
        avatar_url: authData.user.user_metadata?.avatar_url || userInfo.picture || null,
      })

    if (userError) {
      throw new Error(`Failed to create app user: ${userError.message}`)
    }
  }

  // Upsert user identity
  const providerUserId = userInfo.id || userInfo.sub || ''

  const { data: identity, error: identityError } = await serviceClient
    .schema('app')
    .from('user_identities')
    .upsert(
      {
        user_id: supabaseUserId,
        provider: 'google',
        provider_user_id: providerUserId,
        provider_email: userInfo.email || '',
        token_expires_at: finalTokens.expiry_date ? new Date(finalTokens.expiry_date).toISOString() : null,
      },
      {
        onConflict: 'provider,provider_user_id',
      }
    )
    .select()
    .single()

  if (identityError || !identity) {
    throw new Error(`Failed to upsert user identity: ${identityError?.message}`)
  }

  // Encrypt refresh token using Node.js crypto
  const { encrypt } = await import('@/lib/crypto/encrypt')
  const encryptedToken = encrypt(finalTokens.refresh_token)

  // Store encrypted token as text (base64-encoded)
  const { error: tokenError } = await serviceClient
    .schema('app')
    .from('google_tokens')
    .upsert(
      {
        user_identity_id: identity.id,
        encrypted_refresh_token: encryptedToken, // Store as text instead of bytea
        scopes: finalTokens.scope?.split(' ') || [],
      },
      {
        onConflict: 'user_identity_id',
      }
    )

  if (tokenError) {
    throw new Error(`Failed to store encrypted token: ${tokenError.message}`)
  }

  return {
    idToken: finalTokens.id_token,
    refreshToken: finalTokens.refresh_token,
    supabaseUserId,
  }
}

