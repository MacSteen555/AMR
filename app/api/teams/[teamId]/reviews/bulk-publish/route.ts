import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/rbac'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/session'
import { updateReply } from '@/lib/google/gbp'

export async function POST(request: Request, { params }: { params: { teamId: string } }) {
    try {
        await requireTeamMember(params.teamId)
        const user = await requireUser()
        const serviceClient = createSupabaseServiceRoleClient()

        // 1. Get Locations (need account hints)
        const { data: locations } = await serviceClient
            .schema('app')
            .from('locations')
            .select('id, google_location_id, google_account_hint')
            .eq('team_id', params.teamId)

        if (!locations || locations.length === 0) return NextResponse.json({ published: 0 })

        const locationMap = new Map(locations.map(l => [l.id, l]))
        const locationIds = locations.map(l => l.id)

        // 2. Fetch drafts
        const { data: drafts } = await serviceClient
            .schema('app')
            .from('google_reviews')
            .select('*')
            .in('location_id', locationIds)
            .eq('reply_status', 'draft')
            .not('draft_text', 'is', null)

        if (!drafts || drafts.length === 0) return NextResponse.json({ published: 0 })

        // 3. Publish
        const results = await Promise.all(drafts.map(async (review) => {
            const loc = locationMap.get(review.location_id)
            if (!loc || !loc.google_account_hint) return false

            const draftContent = review.draft_text
            if (!draftContent) return false

            try {
                await updateReply(
                    loc.google_account_hint,
                    loc.google_location_id,
                    review.google_review_id,
                    draftContent,
                    user.id
                )

                await serviceClient
                    .schema('app')
                    .from('google_reviews')
                    .update({
                        reply_status: 'posted',
                        reply_text: draftContent,
                        draft_text: null,
                    })
                    .eq('id', review.id)

                return true
            } catch (e) {
                return false
            }
        }))

        return NextResponse.json({ published: results.filter(Boolean).length })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
