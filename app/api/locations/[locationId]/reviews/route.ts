import { NextResponse } from 'next/server'
import { requireLocationAccess } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { locationId: string } }) {
  try {
    await requireLocationAccess(params.locationId)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const since = searchParams.get('since')
    const limit = parseInt(searchParams.get('limit') || '50')
    const cursor = searchParams.get('cursor')

    const supabase = createSupabaseServerClient()

    let query = supabase
      .from('app.google_reviews')
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

    return NextResponse.json({ reviews: reviews || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

