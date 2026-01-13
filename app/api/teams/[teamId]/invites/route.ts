import { NextResponse } from 'next/server'
import { requireTeamAdmin } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createTeamInviteSchema } from '@/lib/validation/schemas'
import crypto from 'crypto'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const admin = await requireTeamAdmin(params.teamId)
    const body = await request.json()
    const data = createTeamInviteSchema.parse(body)

    const supabase = createSupabaseServerClient()

    // Generate invite token
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Create invite
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const { data: invite, error } = await supabase
      .schema('app')
      .from('team_invites')
      .insert({
        team_id: params.teamId,
        invited_email: data.email,
        role: data.role,
        invited_by: admin.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error || !invite) {
      throw new Error(`Failed to create invite: ${error?.message}`)
    }

    // In production, send email with token
    // For now, return token (remove in production)
    return NextResponse.json({ invite: { ...invite, token } }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

