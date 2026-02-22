import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: { reviewId: string } }) {
    try {
        const user = await requireUser() // Start with auth check
        const body = await request.json()
        const { draft_text, reply_status } = body

        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Check access (Review -> Location -> Team -> User)
        // Query review to get location_id
        const { data: review } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('location_id')
            .eq('id', params.reviewId)
            .single()

        if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

        // Check permissions on location
        // We can reuse requireLocationAccess or just query manually if we want to avoid extra DB calls in loops, 
        // but for single PATCH it's fine.
        // However, requireLocationAccess takes locationId.
        // Let's verify:
        // await requireLocationAccess(review.location_id) 
        // ^ Use simple verify logic here to avoid importing complex server-side flows if circular deps strictly.
        // Actually RBAC is safe.
        // But `requireLocationAccess` is async. I'll import it.

        // Hard to import dynamically? No.
        // But to be fast, let's just assume if they can update, they passed middleware or we check here.
        // Let's double check membership.

        const { data: hasAccess } = await serviceClient
            .schema('app')
            .from('location_access')
            .select('id')
            .eq('location_id', review.location_id)
            .eq('user_id', user.id)
            .eq('can_manage', true)
            .single()

        if (!hasAccess) {
            // Also check if team admin?
            // simpler: verify via team membership
            // For now, assume location_access table is source of truth for "manage"
            // If "Team Admin" handles it, they should have an entry or we query teams.
            // Let's stick to simple: if no explicit access, fail. (Improvements for later: robust RBAC coverage)
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
        }

        // 2. Update
        const updatePayload: any = {}
        if (draft_text !== undefined) updatePayload.draft_text = draft_text
        if (reply_status !== undefined) updatePayload.reply_status = reply_status

        const { data: updated, error } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .update(updatePayload)
            .eq('id', params.reviewId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ review: updated })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
