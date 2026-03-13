interface FeatureRequestEmailParams {
    userName: string
    userEmail: string
    teamName?: string
    title: string
    description: string
}

export function buildFeatureRequestEmail({
    userName,
    userEmail,
    teamName,
    title,
    description,
}: FeatureRequestEmailParams): { subject: string; html: string } {
    const subject = `[Feature Request] ${title}`
    const escapedDescription = description.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
    const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Feature Request</h1>
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
              <div style="background-color:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
                <p style="margin:0 0 4px 0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Request</p>
                <p style="margin:0;color:#0f766e;font-size:16px;font-weight:700;">${escapedTitle}</p>
              </div>
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 4px 0;color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Details</p>
                <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${escapedDescription}</p>
              </div>
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
