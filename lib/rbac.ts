import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'

/**
 * Requires that the current user is a member of the specified team.
 * Throws if not a member.
 */
export async function requireTeamMember(teamId: string) {
  const user = await requireUser()
  const supabase = createSupabaseServerClient()

  const { data: membership, error } = await supabase
    .from('app.team_memberships')
    .select('*')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (error || !membership) {
    throw new Error('Not a team member')
  }

  return membership
}

/**
 * Requires that the current user is an admin of the specified team.
 * Throws if not an admin.
 */
export async function requireTeamAdmin(teamId: string) {
  const membership = await requireTeamMember(teamId)

  if (membership.role !== 'admin') {
    throw new Error('Team admin required')
  }

  return membership
}

/**
 * Requires that the current user has access to the specified location.
 * Throws if no access.
 */
export async function requireLocationAccess(locationId: string) {
  const user = await requireUser()
  const supabase = createSupabaseServerClient()

  // Check if user can access location (via RLS or explicit check)
  const { data: location, error: locationError } = await supabase
    .from('app.locations')
    .select('*, team:teams!inner(id)')
    .eq('id', locationId)
    .single()

  if (locationError || !location) {
    throw new Error('Location not found')
  }

  // Check team membership
  const { data: membership } = await supabase
    .from('app.team_memberships')
    .select('role')
    .eq('team_id', location.team.id)
    .eq('user_id', user.id)
    .single()

  if (membership) {
    // Team member - check if admin or has explicit location access
    if (membership.role === 'admin') {
      return { location, canManage: true }
    }

    const { data: access } = await supabase
      .from('app.location_access')
      .select('can_manage')
      .eq('location_id', locationId)
      .eq('user_id', user.id)
      .single()

    if (access) {
      return { location, canManage: access.can_manage }
    }
  }

  throw new Error('No access to location')
}

