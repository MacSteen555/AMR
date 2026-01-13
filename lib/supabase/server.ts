import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Creates a Supabase client for server-side use with cookie-based session management.
 * Use this for route handlers that need RLS enforcement.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: (key: string) => {
          return cookieStore.get(key)?.value ?? null
        },
        setItem: (key: string, value: string) => {
          try {
            cookieStore.set({
              name: key,
              value,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 60 * 60 * 24 * 365, // 1 year
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        removeItem: (key: string) => {
          try {
            cookieStore.set({
              name: key,
              value: '',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
              maxAge: 0,
            })
          } catch (error) {
            // Same as above
          }
        },
      },
    },
  })
}

/**
 * Creates a Supabase client with service role key (bypasses RLS).
 * Use ONLY for:
 * - Webhook handlers (Stripe)
 * - Background jobs/sync tasks
 * - Admin operations that need to bypass RLS
 */
export function createSupabaseServiceRoleClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

