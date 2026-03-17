import { NextResponse } from 'next/server'
import { extractThemesForLocation } from '@/lib/openai/themes'
import { captureRouteError } from '@/lib/sentry'

export const maxDuration = 60

export async function POST(request: Request, { params }: { params: { locationId: string } }) {
  try {
    // Verify internal call via CRON_SECRET
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tagged = await extractThemesForLocation(params.locationId)
    return NextResponse.json({ tagged })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/locations/[locationId]/themes/extract', extra: { locationId: params.locationId } })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
