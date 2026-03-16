import { NextResponse } from 'next/server'
import { googleOAuthStart } from '@/lib/auth/google'
import { requireUser } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireUser()

    const { url, codeVerifier, state } = googleOAuthStart({ incremental: true })

    const cookieStore = cookies()
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 300,
    }

    cookieStore.set('oauth_code_verifier', codeVerifier, cookieOptions)
    cookieStore.set('oauth_state', state, cookieOptions)
    cookieStore.set('oauth_popup', 'true', cookieOptions)

    return NextResponse.json({ url })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/auth/google/grant-scope' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
