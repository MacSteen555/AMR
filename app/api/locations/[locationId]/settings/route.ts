import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateLocationSettingsSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'

export async function PATCH(request: Request, { params }: { params: { locationId: string } }) {
  try {
    const { canManage } = await requireLocationAccess(params.locationId)

    if (!canManage) {
      return NextResponse.json({ error: 'Manage access required' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateLocationSettingsSchema.parse(body)

    const supabase = createSupabaseServerClient()

    const { error } = await supabase
      .schema('app')
      .from('locations')
      .update(data)
      .eq('id', params.locationId)

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/locations/[locationId]/settings', extra: { locationId: params.locationId } })
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

