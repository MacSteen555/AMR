import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { requireUser } from '@/lib/auth/session'
import { createTopupCheckoutSession } from '@/lib/stripe/checkout'
import { createTopupSchema } from '@/lib/validation/schemas'
import { captureRouteError } from '@/lib/sentry'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)
    const user = await requireUser()
    const body = await request.json()
    const data = createTopupSchema.parse(body)

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/teams/${params.teamId}/billing/success`
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/teams/${params.teamId}/billing`

    const url = await createTopupCheckoutSession(params.teamId, data.stripe_price_id, user.id, successUrl, cancelUrl)

    return NextResponse.json({ url })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    captureRouteError(error, { route: '/api/teams/[teamId]/billing/topup', teamId: params.teamId })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

