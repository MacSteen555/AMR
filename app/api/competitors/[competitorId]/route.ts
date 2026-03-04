import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamMember } from '@/lib/rbac'
import { z } from 'zod'

const updateCompetitorSchema = z.object({
    name: z.string().min(1).optional(),
    place_id: z.string().min(1).optional(),
    website: z.string().url().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
})

export async function GET(request: Request, { params }: { params: { competitorId: string } }) {
    try {
        const user = await requireUser()
        const supabase = createSupabaseServerClient()

        // Get competitor and verify user has access to its team
        const { data: competitor, error } = await supabase
            .schema('app')
            .from('competitors')
            .select('*, teams!inner(*)')
            .eq('id', params.competitorId)
            .is('deleted_at', null)
            .single()

        if (error || !competitor) {
            return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
        }

        // Verify team access
        await requireTeamMember(competitor.team_id)

        // Remove the joined team data before returning
        const { teams, ...competitorData } = competitor

        return NextResponse.json({ competitor: competitorData })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request: Request, { params }: { params: { competitorId: string } }) {
    try {
        const user = await requireUser()
        const body = await request.json()
        const data = updateCompetitorSchema.parse(body)
        const supabase = createSupabaseServerClient()

        // Get competitor to get teamId
        const { data: existing, error: fetchError } = await supabase
            .schema('app')
            .from('competitors')
            .select('team_id')
            .eq('id', params.competitorId)
            .is('deleted_at', null)
            .single()

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
        }

        // Verify team access
        await requireTeamMember(existing.team_id)

        // Update competitor
        const { data: competitor, error } = await supabase
            .schema('app')
            .from('competitors')
            .update({
                ...data,
            })
            .eq('id', params.competitorId)
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to update competitor: ${error.message}`)
        }

        return NextResponse.json({ competitor })
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: { competitorId: string } }) {
    try {
        const user = await requireUser()
        const supabase = createSupabaseServerClient()

        // Get competitor
        const { data: existing, error: fetchError } = await supabase
            .schema('app')
            .from('competitors')
            .select('team_id')
            .eq('id', params.competitorId)
            .single()

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
        }

        // Verify team access
        await requireTeamMember(existing.team_id)

        // Soft delete
        const { error } = await supabase
            .schema('app')
            .from('competitors')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', params.competitorId)

        if (error) {
            throw new Error(`Failed to delete competitor: ${error.message}`)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
