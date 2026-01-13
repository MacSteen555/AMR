import { NextResponse } from 'next/server'
import { googleOAuthCallback } from '@/lib/auth/google'
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

    // Exchange code for tokens and sign in to Supabase
    // This creates the Supabase session and app user
    const result = await googleOAuthCallback(code, codeVerifier)

    // Clear OAuth cookies
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_code_verifier')

    // Redirect to app
    // The Supabase session cookies should be set by the storage adapter
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    redirect(`${redirectUrl}/dashboard`)
  } catch (error: any) {
    // Redirect to login with error message
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    redirect(`${redirectUrl}/login?error=${encodeURIComponent(error.message)}`)
  }
}

