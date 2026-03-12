import { NextResponse } from 'next/server'
import { googleOAuthStart } from '@/lib/auth/google'
import { cookies } from 'next/headers'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

/**
 * Initiates Google OAuth flow
 * Returns authorization URL and stores PKCE parameters in cookies
 */
export async function GET() {
  try {
    const { url, codeVerifier, state } = googleOAuthStart()

    // Store PKCE parameters in secure httpOnly cookies
    const cookieStore = cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7200, // 2 hours
    }

    cookieStore.set('oauth_code_verifier', codeVerifier, cookieOptions)
    cookieStore.set('oauth_state', state, cookieOptions)

    return NextResponse.json({ url })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/auth/google/start' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
