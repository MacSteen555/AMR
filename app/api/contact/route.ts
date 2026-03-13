import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email/send'
import { buildContactEmail } from '@/lib/email/templates/contact-us'
import { captureRouteError } from '@/lib/sentry'
import { z } from 'zod'

const contactSchema = z.object({
    message: z.string().min(1).max(5000),
    teamName: z.string().optional(),
})

export async function POST(request: Request) {
    try {
        const user = await requireUser()
        const body = contactSchema.parse(await request.json())

        const { subject, html } = buildContactEmail({
            userName: user.display_name || 'User',
            userEmail: user.email,
            teamName: body.teamName,
            message: body.message,
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
        captureRouteError(error, { route: '/api/contact' })
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
