import { NextResponse } from 'next/server'
import { googleOAuthCallback } from '@/lib/auth/google'
import { ensureAppUserFromSupabaseAuth } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
    }

    // Verify state
    const cookieStore = cookies()
    const storedState = cookieStore.get('oauth_state')?.value
    const codeVerifier = cookieStore.get('oauth_code_verifier')?.value

    if (!storedState || storedState !== state) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    if (!codeVerifier) {
      return NextResponse.json({ error: 'Missing code verifier' }, { status: 400 })
    }

    // Ensure user exists
    const user = await ensureAppUserFromSupabaseAuth()

    // Exchange code for tokens
    await googleOAuthCallback(code, codeVerifier, user.id)

    // Clear cookies
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_code_verifier')

    // Redirect to app
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    redirect(`${redirectUrl}/dashboard`)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

