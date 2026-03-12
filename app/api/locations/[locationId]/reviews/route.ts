import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { locationId: string } }) {
  try {
    // RBAC check — returns canManage based on admin role or location_access table
    const { canManage } = await requireLocationAccess(params.locationId)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '50')
    const cursor = searchParams.get('cursor')

    const supabase = createSupabaseServiceRoleClient()

    let query = supabase
      .schema('app')
      .from('google_reviews')
      .select('*')
      .eq('location_id', params.locationId)
      .order('review_date', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('reply_status', status)
    }

    if (since) {
      query = query.gte('review_date', since)
    }

    if (cursor) {
      query = query.lt('review_date', cursor)
    }

    const { data: reviews } = await query

    return NextResponse.json({
      reviews: reviews || [],
      canPostReplies: canManage
    })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/locations/[locationId]/reviews', extra: { locationId: params.locationId } })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
