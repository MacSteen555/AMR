import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/digest-token'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const payload = verifyUnsubscribeToken(token)
  if (!payload) {
    return new NextResponse(renderPage('Invalid Link', 'This unsubscribe link is invalid or has been tampered with.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase
    .schema('app')
    .from('team_memberships')
    .update({ digest_frequency: 'off' })
    .eq('user_id', payload.userId)
    .eq('team_id', payload.teamId)

  if (error) {
    return new NextResponse(renderPage('Error', 'Something went wrong. Please try again later.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new NextResponse(
    renderPage('Unsubscribed', 'You have been unsubscribed from review digest emails for this team. You can re-enable them from your team settings at any time.'),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} — AutoMyReply</title></head>
<body style="margin:0;padding:60px 20px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">${title}</h1>
    <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`
}
