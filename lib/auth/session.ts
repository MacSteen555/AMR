import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export interface AppUser {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Gets the current Supabase auth user from the session.
 * Returns null if not authenticated.
 */
export async function getSupabaseUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Ensures an app.users row exists for the current Supabase auth user.
 * Creates it if missing, returns existing if present.
 */
export async function ensureAppUserFromSupabaseAuth(): Promise<AppUser> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    throw new Error('Not authenticated')
  }

  // Use service role to upsert (bypass RLS for user creation)
  const serviceClient = createSupabaseServiceRoleClient()

  // Check if user exists
  const { data: existingUser } = await serviceClient
    .schema('app')
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (existingUser) {
    return existingUser as AppUser
  }

  // Create new user
  const { data: newUser, error: insertError } = await serviceClient
    .schema('app')
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email!,
      display_name: authUser.user_metadata?.display_name || null,
      avatar_url: authUser.user_metadata?.avatar_url || null,
    })
    .select()
    .single()

  if (insertError || !newUser) {
    throw new Error(`Failed to create app user: ${insertError?.message}`)
  }

  return newUser as AppUser
}

/**
 * Requires authentication and returns the current app user.
 * Throws if not authenticated or user doesn't exist.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await ensureAppUserFromSupabaseAuth()
  return user
}

