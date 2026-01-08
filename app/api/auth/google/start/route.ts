import { NextResponse } from 'next/server'
import { googleOAuthStart } from '@/lib/auth/google'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const { url, codeVerifier, state } = googleOAuthStart()

    // Store code verifier and state in httpOnly cookie
    const cookieStore = cookies()
    cookieStore.set('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    })
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
    })

    return NextResponse.json({ url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

