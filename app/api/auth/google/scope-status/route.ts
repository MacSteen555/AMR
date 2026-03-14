import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireUser()
    const serviceClient = createSupabaseServiceRoleClient()

    const { data: identity } = await serviceClient
      .schema('app')
      .from('user_identities')
      .select('id, google_tokens!inner(scopes)')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .maybeSingle()

    if (!identity?.google_tokens) {
      return NextResponse.json({ hasBusinessScope: false, hasGoogleIdentity: false })
    }

    const scopes: string[] = (identity.google_tokens as any).scopes || []
    const hasBusinessScope = scopes.some(s => s.includes('business.manage'))

    return NextResponse.json({ hasBusinessScope, hasGoogleIdentity: true })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/auth/google/scope-status' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
