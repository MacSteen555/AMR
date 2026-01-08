import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { listAccounts, listLocations } from '@/lib/google/gbp'

export async function GET() {
  try {
    const user = await requireUser()
    const supabase = createSupabaseServerClient()
    const serviceClient = createSupabaseServiceRoleClient()

    // Get user's Google identity
    const { data: identity } = await supabase
      .from('app.user_identities')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .single()

    if (!identity) {
      return NextResponse.json({ error: 'Google identity not found' }, { status: 404 })
    }

    // List accounts and locations from Google
    const accounts = await listAccounts(user.id)
    const allLocations: any[] = []

    for (const account of accounts) {
      const accountId = account.name?.replace('accounts/', '') || account.accountId || ''
      const locations = await listLocations(accountId, user.id)

      for (const location of locations) {
        const googleLocationId = location.name?.replace(/^accounts\/[^/]+\/locations\//, '') || location.locationId || ''

        // Upsert entitlement
        await serviceClient
          .from('app.google_location_entitlements')
          .upsert(
            {
              user_identity_id: identity.id,
              google_location_id: googleLocationId,
              last_seen_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_identity_id,google_location_id',
            }
          )

        allLocations.push({
          account_id: accountId,
          account_name: account.accountName || account.name,
          location_id: googleLocationId,
          location_name: location.storefrontAddress?.addressLines?.[0] || location.title || '',
          address: location.storefrontAddress,
        })
      }
    }

    return NextResponse.json({ locations: allLocations })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

