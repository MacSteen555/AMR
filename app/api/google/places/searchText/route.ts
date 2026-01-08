import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { searchPlaces } from '@/lib/google/places'
import { placesSearchSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  try {
    await requireUser()
    const body = await request.json()
    const data = placesSearchSchema.parse(body)

    const result = await searchPlaces(data.query)

    return NextResponse.json(result)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

