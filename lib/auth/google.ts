import { google } from 'googleapis'
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto/encrypt'
import crypto from 'crypto'

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET!
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error('Missing Google OAuth credentials')
}

// Required scopes for Google Business Profile API
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

/**
 * Step 1: Start OAuth Flow
 * Generates authorization URL with PKCE for security
 */
export function googleOAuthStart(options?: { incremental?: boolean }): { url: string; codeVerifier: string; state: string } {
  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

  // Generate authorization URL (with PKCE)
  const authUrlParams: any = {
    access_type: 'offline',
    prompt: 'consent',
    scope: options?.incremental
      ? ['https://www.googleapis.com/auth/business.manage']
      : REQUIRED_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }

  if (options?.incremental) {
    authUrlParams.include_granted_scopes = true
  }

  const url = oauth2Client.generateAuthUrl(authUrlParams)

  return { url, codeVerifier, state }
}

/**
 * Step 2: Handle OAuth Callback
 * Exchanges authorization code for tokens, creates session, stores user data
 */
import { SupabaseClient } from '@supabase/supabase-js'

export async function googleOAuthCallback(
  code: string,
  codeVerifier: string,
  supabaseClient?: SupabaseClient,
  options?: { incremental?: boolean }
): Promise<{ supabaseUserId: string }> {
  // ============================================
  // 1. Exchange code for tokens
  // ============================================
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI)

  const { tokens } = await oauth2Client.getToken({
    code,
    codeVerifier,
  })

  if (!tokens.refresh_token) {
    throw new Error('Missing refresh token from Google')
  }

  // ============================================
  // 2. Get user info from Google
  // ============================================
  oauth2Client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: googleUser } = await oauth2.userinfo.get()

  // ============================================
  // 3. Create or preserve Supabase session
  // ============================================
  const supabase = supabaseClient || createSupabaseServerClient()

  let userId: string

  if (options?.incremental) {
    // Incremental scope grant: preserve the existing session, just upsert tokens
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      throw new Error('No existing session found for incremental scope grant')
    }
    userId = session.user.id
  } else {
    // Full login flow: sign out and create fresh session
    if (!tokens.id_token) {
      throw new Error('Missing ID token from Google')
    }

    await supabase.auth.signOut()

    const { data: authData, error: authError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.id_token,
    })

    if (authError) {
      throw new Error(`Supabase auth error: ${authError.message}`)
    }

    if (!authData?.user) {
      throw new Error('No user returned from Supabase')
    }

    if (!authData?.session) {
      throw new Error('No session returned from Supabase')
    }

    userId = authData.user.id
  }

  // ============================================
  // 4. Create app user (if doesn't exist)
  // ============================================
  const serviceClient = createSupabaseServiceRoleClient()

  const { data: existingUser } = await serviceClient
    .schema('app')
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (!existingUser) {
    const { error: createUserError } = await serviceClient
      .schema('app')
      .from('users')
      .insert({
        id: userId,
        email: googleUser.email || '',
        display_name: googleUser.name || null,
        avatar_url: googleUser.picture || null,
      })

    if (createUserError) {
      throw new Error(`Failed to create user: ${createUserError.message}`)
    }
  }

  // ============================================
  // 5. Store Google identity
  // ============================================
  const { data: identity, error: identityError } = await serviceClient
    .schema('app')
    .from('user_identities')
    .upsert(
      {
        user_id: userId,
        provider: 'google',
        provider_user_id: (googleUser.id || (googleUser as any).sub || '') as string,
        provider_email: googleUser.email || '',
        token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      },
      { onConflict: 'provider,provider_user_id' }
    )
    .select('id')
    .single()

  if (identityError || !identity) {
    throw new Error(`Failed to store identity: ${identityError?.message}`)
  }

  // ============================================
  // 6. Encrypt and store refresh token
  // ============================================
  const encryptedToken = encrypt(tokens.refresh_token)

  const { error: tokenError } = await serviceClient
    .schema('app')
    .from('google_tokens')
    .upsert(
      {
        user_identity_id: identity.id,
        encrypted_refresh_token: encryptedToken,
        scopes: tokens.scope?.split(' ') || [],
      },
      { onConflict: 'user_identity_id' }
    )

  if (tokenError) {
    throw new Error(`Failed to store token: ${tokenError.message}`)
  }

  return { supabaseUserId: userId }
}
