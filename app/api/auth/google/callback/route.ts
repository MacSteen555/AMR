import { NextResponse } from 'next/server'
import { googleOAuthCallback } from '@/lib/auth/google'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

    // Create a Supabase client that captures cookies so we can set them on the response
    const cookiesToSet: { name: string; value: string; options?: any }[] = []

    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          detectSessionInUrl: false,
        },
        cookies: {
          getAll() {
            const all = cookieStore.getAll()
            console.log('getAll called in route handler. Found:', all.map(c => c.name))
            return all
          },
          setAll(cookies: Array<{ name: string; value: string; options?: any }>) {
            console.log('setAll called in route handler with:', cookies.map(c => c.name))
            try {
              cookies.forEach(({ name, value, options }) => {
                cookiesToSet.push({ name, value, options })
                cookieStore.set(name, value, options)
              })
            } catch (error) {
              console.error('Error setting cookies in route handler:', error)
            }
          },
        },
      }
    )

    // Exchange code for tokens and create session using our custom client
    await googleOAuthCallback(code, codeVerifier, supabase)

    // Verify session was created
    const { data: { session }, error: sessionReadError } = await supabase.auth.getSession()

    if (!session) {
      console.error('Session missing after callback. Cookies to set:', cookiesToSet.map(c => c.name))
      throw new Error(`Session verification failed: ${sessionReadError?.message || 'No session created'}`)
    }

    // Clean up OAuth cookies
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_code_verifier')

    // Create redirect response
    const response = NextResponse.redirect(`${redirectUrl}/dashboard`)

    // Explicitly set the captured Supabase cookies on the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set({
        name,
        value,
        ...options,
      })
    })

    return response
  } catch (error: any) {
    // Handle errors
    return NextResponse.redirect(`${redirectUrl}/login?error=${encodeURIComponent(error.message)}`)
  }
}
