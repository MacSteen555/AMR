import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'AutoMyReply <onboarding@resend.dev>'

interface SendEmailParams {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
    const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: subject.replace(/[\r\n]+/g, ' '),
        html,
    })

    if (error) {
        console.error('Failed to send email:', error)
        throw new Error(`Failed to send email: ${error.message}`)
    }

    return data
}
