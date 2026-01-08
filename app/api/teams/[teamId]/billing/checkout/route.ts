import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { createCheckoutSchema } from '@/lib/validation/schemas'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)
    const user = await requireUser()
    const body = await request.json()
    const data = createCheckoutSchema.parse(body)

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/teams/${params.teamId}/billing/success`
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/teams/${params.teamId}/billing`

    const url = await createCheckoutSession(params.teamId, data.tier, user.id, successUrl, cancelUrl)

    return NextResponse.json({ url })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

