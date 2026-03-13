interface ContactEmailParams {
    userName: string
    userEmail: string
    teamName?: string
    message: string
}

export function buildContactEmail({
    userName,
    userEmail,
    teamName,
    message,
}: ContactEmailParams): { subject: string; html: string } {
    const subject = `[Contact] ${userName} — ${message.slice(0, 60)}`
    const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:24px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">New Contact Message</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;font-weight:600;width:80px;vertical-align:top;">From</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;">${userName} &lt;${userEmail}&gt;</td>
                </tr>
                ${teamName ? `<tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;font-weight:600;width:80px;vertical-align:top;">Team</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;">${teamName}</td>
                </tr>` : ''}
              </table>
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;">
                <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${escapedMessage}</p>
              </div>
              <p style="margin:20px 0 0 0;color:#9ca3af;font-size:12px;">
                Reply directly to this email to respond to the user.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

    return { subject, html }
}
