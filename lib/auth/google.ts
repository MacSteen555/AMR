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
 */
export async function googleOAuthCallback(
  code: string,
  codeVerifier: string,
  userId: string
): Promise<{ idToken: string; refreshToken: string }> {
  const { tokens } = await oauth2Client.getToken({
    code,
    code_verifier: codeVerifier,
  })

  if (!tokens.id_token) {
    throw new Error('No ID token received from Google')
  }

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received from Google')
  }

  // Get user info from Google
  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  // Sign in to Supabase with Google ID token
  const supabase = createSupabaseServerClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: tokens.id_token,
  })

  if (authError || !authData.user) {
    throw new Error(`Failed to sign in to Supabase: ${authError?.message}`)
  }

  // Upsert user identity
  const serviceClient = createSupabaseServiceRoleClient()
  const providerUserId = userInfo.id || userInfo.sub || ''

  const { data: identity, error: identityError } = await serviceClient
    .from('app.user_identities')
    .upsert(
      {
        user_id: userId,
        provider: 'google',
        provider_user_id: providerUserId,
        provider_email: userInfo.email || '',
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
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

  // Encrypt refresh token using pgcrypto (via raw SQL)
  const { data: encryptedData, error: encryptError } = await serviceClient.rpc('pgp_sym_encrypt', {
    plaintext: tokens.refresh_token,
    psw: encryptionSecret,
  })

  if (encryptError) {
    throw new Error(`Failed to encrypt token: ${encryptError.message}`)
  }

  // Store encrypted token
  const { error: tokenError } = await serviceClient
    .from('app.google_tokens')
    .upsert(
      {
        user_identity_id: identity.id,
        encrypted_refresh_token: encryptedData, // bytea from pgp_sym_encrypt
        scopes: tokens.scope?.split(' ') || [],
      },
      {
        onConflict: 'user_identity_id',
      }
    )

  if (tokenError) {
    throw new Error(`Failed to store encrypted token: ${tokenError.message}`)
  }

  return {
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
  }
}

