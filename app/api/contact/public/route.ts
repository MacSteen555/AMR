import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { buildContactEmail } from '@/lib/email/templates/contact-us'
import { captureRouteError } from '@/lib/sentry'
import { z } from 'zod'

const publicContactSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    message: z.string().min(1).max(5000),
})

export async function POST(request: Request) {
    try {
        const body = publicContactSchema.parse(await request.json())

        const { subject, html } = buildContactEmail({
            userName: body.name,
            userEmail: body.email,
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
        captureRouteError(error, { route: '/api/contact/public' })
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }
}
