import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { captureRouteError } from '@/lib/sentry'

export async function DELETE(
    request: Request,
    { params }: { params: { teamId: string; runId: string } }
) {
    try {
        await requireTeamMember(params.teamId)
        const supabase = createSupabaseServerClient()

        // Since the table is app.competitive_runs
        const { error } = await supabase
            .schema('app')
            .from('competitive_runs')
            .delete()
            .eq('id', params.runId)
            .eq('team_id', params.teamId)

        if (error) {
            throw new Error(`Failed to delete report: ${error.message}`)
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        captureRouteError(error, { route: '/api/teams/[teamId]/competitive-runs/[runId]', teamId: params.teamId })
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
