import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { locationId: string } }
) {
  await requireUser()
  const supabase = createSupabaseServiceRoleClient()
  const { data } = await supabase
    .from('locations')
    .select('team_id')
    .eq('id', params.locationId)
    .single()

  if (!data) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  return NextResponse.json({ teamId: data.team_id })
}
