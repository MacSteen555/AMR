import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { importLocationsSchema } from '@/lib/validation/schemas'
import { listLocations } from '@/lib/google/gbp'
import { requireUser } from '@/lib/auth/session'
import { captureRouteError } from '@/lib/sentry'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamMember(params.teamId)
    const user = await requireUser()
    const body = await request.json()
    const data = importLocationsSchema.parse(body)

    const serviceClient = createSupabaseServiceRoleClient()

    const importedLocations = []
    const conflicts: { name: string; google_location_id: string }[] = []

    for (const googleLocationId of data.google_location_ids) {
      // Get location details from Google if account_id provided
      let locationData: any = {}
      if (data.account_id) {
        try {
          const locations = await listLocations(data.account_id, user.id)
          locationData = locations.find((l: any) => {
            const id = l.name?.replace(/^accounts\/[^/]+\/locations\//, '') || l.locationId || ''
            return id === googleLocationId
          }) || {}
        } catch (error) {
          // Continue without Google data
        }
      }

      // Check if location already belongs to another team
      const { data: existingGlobal } = await serviceClient
        .schema('app')
        .from('locations')
        .select('team_id, name')
        .eq('google_location_id', googleLocationId)
        .maybeSingle()

      if (existingGlobal) {
        if (existingGlobal.team_id !== params.teamId) {
          if (!data.force) {
            // Return conflict info so the frontend can prompt the user
            conflicts.push({
              name: existingGlobal.name || googleLocationId,
              google_location_id: googleLocationId,
            })
            continue
          }
          // force=true: allow importing even though another team has it
        } else {
          // Already belongs to this team, skip
          continue
        }
      }

      // Create location
      const { data: location, error: locError } = await serviceClient
        .schema('app')
        .from('locations')
        .insert({
          team_id: params.teamId,
          google_location_id: googleLocationId,
          google_account_hint: data.account_id || null,
          name: locationData.title || locationData.storefrontAddress?.addressLines?.[0] || 'Unknown Location',
          address: locationData.storefrontAddress?.addressLines?.join(', ') || null,
          city: locationData.storefrontAddress?.locality || null,
          region: locationData.storefrontAddress?.administrativeArea || null,
          country: locationData.storefrontAddress?.regionCode || null,
          postal_code: locationData.storefrontAddress?.postalCode || null,
          phone: locationData.primaryPhone || null,
          website: locationData.websiteUri || null,
          latitude: locationData.storefrontAddress?.coordinates?.latitude || null,
          longitude: locationData.storefrontAddress?.coordinates?.longitude || null,
        })
        .select()
        .single()

      if (locError) {
        // May already exist, try to get it
        const { data: existing } = await serviceClient
          .schema('app')
          .from('locations')
          .select('*')
          .eq('team_id', params.teamId)
          .eq('google_location_id', googleLocationId)
          .single()

        if (existing) {
          importedLocations.push(existing)
          continue
        }
        throw new Error(`Failed to import location: ${locError.message}`)
      }

      // Grant access to importer
      await serviceClient.schema('app').from('location_access').insert({
        team_id: params.teamId,
        location_id: location.id,
        user_id: user.id,
        can_manage: true,
      })

      importedLocations.push(location)
    }

    // Fire background sync asynchronously so user doesn't wait
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/teams/${params.teamId}/reviews/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
    }).catch(err => console.error('Background sync failed on import:', err))

    return NextResponse.json({ locations: importedLocations, conflicts }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/locations/import', teamId: params?.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

