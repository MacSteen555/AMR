import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { handleStripeWebhook } from '@/lib/stripe/webhook'
import { captureRouteError } from '@/lib/sentry'

export async function POST(request: Request) {
  let hasSignature = false
  try {
    const body = await request.text()
    const headersList = headers()
    const signature = headersList.get('stripe-signature')
    hasSignature = !!signature

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    await handleStripeWebhook(body, signature)

    return NextResponse.json({ received: true })
  } catch (error: any) {
    captureRouteError(error, { route: '/api/stripe/webhook', extra: { signature: hasSignature } })
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}

