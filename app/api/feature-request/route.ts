import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email/send'
import { buildFeatureRequestEmail } from '@/lib/email/templates/feature-request'
import { captureRouteError } from '@/lib/sentry'
import { z } from 'zod'

const featureRequestSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    teamName: z.string().optional(),
})

export async function POST(request: Request) {
    try {
        const user = await requireUser()
        const body = featureRequestSchema.parse(await request.json())

        const { subject, html } = buildFeatureRequestEmail({
            userName: user.display_name || 'User',
            userEmail: user.email,
            teamName: body.teamName,
            title: body.title,
            description: body.description,
        })

        await sendEmail({
            to: 'support@automyreply.com',
            subject,
            html,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        captureRouteError(error, { route: '/api/feature-request' })
        return NextResponse.json({ error: 'Failed to send request' }, { status: 500 })
    }
}
