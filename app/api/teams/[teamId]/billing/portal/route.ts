import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { createPortalSession } from '@/lib/stripe/checkout'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    await requireTeamAdmin(params.teamId)

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/teams/${params.teamId}/billing`
    const url = await createPortalSession(params.teamId, returnUrl)

    return NextResponse.json({ url })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

