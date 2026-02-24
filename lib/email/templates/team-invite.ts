interface TeamInviteEmailParams {
    teamName: string
    inviterName: string
    inviterEmail: string
    inviteUrl: string
    expiresInDays: number
}

export function buildTeamInviteEmail({
    teamName,
    inviterName,
    inviterEmail,
    inviteUrl,
    expiresInDays,
}: TeamInviteEmailParams): { subject: string; html: string } {
    const subject = `You've been invited to join ${teamName} on AutoMyReply`

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Team Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                AutoMyReply
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              
              <!-- Icon -->
              <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:64px;height:64px;background-color:#eef2ff;border-radius:50%;line-height:64px;font-size:28px;">
                  ✉️
                </div>
              </div>

              <h2 style="margin:0 0 8px 0;color:#111827;font-size:20px;font-weight:700;text-align:center;">
                You're invited!
              </h2>
              
              <p style="margin:0 0 24px 0;color:#6b7280;font-size:15px;line-height:1.6;text-align:center;">
                <strong style="color:#374151;">${inviterName}</strong> (${inviterEmail}) has invited you to join
              </p>

              <!-- Team Name Card -->
              <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 4px 0;color:#9ca3af;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                  Team
                </p>
                <p style="margin:0;color:#111827;font-size:18px;font-weight:700;">
                  ${teamName}
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${inviteUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                  Accept Invitation
                </a>
              </div>

              <!-- Expiry Notice -->
              <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;line-height:1.5;">
                This invitation will expire in <strong>${expiresInDays} days</strong>.<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 4px 0;color:#9ca3af;font-size:12px;">
                Sent by <strong>AutoMyReply</strong>
              </p>
              <p style="margin:0;color:#d1d5db;font-size:11px;">
                Automated Review Management
              </p>
            </td>
          </tr>

        </table>

        <!-- Sub-footer Link -->
        <p style="margin:20px 0 0 0;color:#9ca3af;font-size:11px;text-align:center;">
          If the button above doesn't work, copy and paste this link into your browser:<br/>
          <a href="${inviteUrl}" style="color:#6366f1;word-break:break-all;">${inviteUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

    return { subject, html }
}
