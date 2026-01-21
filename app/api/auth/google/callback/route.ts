import { NextResponse } from 'next/server'
import { googleOAuthCallback } from '@/lib/auth/google'
import { cookies } from 'next/headers'

/**
 * Handles OAuth callback from Google
 * Validates state, exchanges code for tokens, creates session, redirects to app
 */
export async function GET(request: Request) {
  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      throw new Error('Missing authorization code')
    }

    // Retrieve and validate PKCE parameters
    const cookieStore = cookies()
    const storedState = cookieStore.get('oauth_state')?.value
    const codeVerifier = cookieStore.get('oauth_code_verifier')?.value

    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter')
    }

    if (!codeVerifier) {
      throw new Error('Missing code verifier')
    }

    // Exchange code for tokens and create session
    // This sets Supabase auth cookies via the storage adapter
    await googleOAuthCallback(code, codeVerifier)

    // Clean up OAuth cookies
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_code_verifier')

    // Use NextResponse.redirect to preserve cookies
    return NextResponse.redirect(`${redirectUrl}/dashboard`)
  } catch (error: any) {
    // Handle errors
    return NextResponse.redirect(`${redirectUrl}/login?error=${encodeURIComponent(error.message)}`)
  }
}
