interface DigestReview {
  reviewerName: string
  rating: number
  comment: string
  locationName: string
  replyStatus: string
  draftPreview?: string
}

interface ReviewDigestEmailParams {
  teamName: string
  newReviewCount: number
  needsReplyCount: number
  avgRating: string
  reviews: DigestReview[]
  teamUrl: string
  unsubscribeUrl: string
  summaryParagraph?: string
}

export function buildReviewDigestEmail(params: ReviewDigestEmailParams): { subject: string; html: string } {
  const { teamName, newReviewCount, needsReplyCount, avgRating, reviews, teamUrl, unsubscribeUrl, summaryParagraph } = params

  const subject = `AutoMyReply — ${newReviewCount} new review${newReviewCount !== 1 ? 's' : ''} for ${teamName}`

  const starHtml = (rating: number) => {
    return [1, 2, 3, 4, 5]
      .map(s => `<span style="color:${s <= rating ? '#f59e0b' : '#d1d5db'};font-size:14px;">★</span>`)
      .join('')
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
      none: { bg: '#fef3c7', text: '#92400e', label: 'Needs Reply' },
      draft: { bg: '#e0f2fe', text: '#075985', label: 'Draft Ready' },
      posted: { bg: '#d1fae5', text: '#065f46', label: 'Replied' },
      dismissed: { bg: '#f3f4f6', text: '#6b7280', label: 'Dismissed' },
    }
    const c = colors[status] || colors.none
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${c.bg};color:${c.text};">${c.label}</span>`
  }

  const truncate = (text: string, len: number) =>
    text.length > len ? text.slice(0, len).trim() + '…' : text

  const reviewRows = reviews.slice(0, 15).map(r => `
    <tr>
      <td style="padding:16px 20px;border-bottom:1px solid #f3f4f6;">
        <div style="margin-bottom:6px;">
          ${starHtml(r.rating)}
          <span style="margin-left:8px;color:#9ca3af;font-size:12px;">${r.locationName}</span>
          <span style="float:right;">${statusBadge(r.replyStatus)}</span>
        </div>
        <div style="color:#374151;font-size:14px;font-weight:600;margin-bottom:4px;">${r.reviewerName}</div>
        <div style="color:#6b7280;font-size:13px;line-height:1.5;">${truncate(r.comment || 'No comment', 120)}</div>
        ${r.draftPreview ? `
          <div style="margin-top:10px;padding:10px 14px;background:#f0fdfa;border-left:3px solid #0d9488;border-radius:0 6px 6px 0;">
            <div style="font-size:11px;font-weight:600;color:#0d9488;margin-bottom:4px;">Suggested Reply</div>
            <div style="color:#4b5563;font-size:13px;line-height:1.5;font-style:italic;">${truncate(r.draftPreview, 200)}</div>
          </div>
        ` : ''}
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Review Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                AutoMyReply
              </h1>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <h2 style="margin:0 0 4px 0;color:#111827;font-size:20px;font-weight:700;">
                ${newReviewCount} new review${newReviewCount !== 1 ? 's' : ''}
              </h2>
              <p style="margin:0 0 20px 0;color:#6b7280;font-size:14px;">
                for <strong style="color:#374151;">${teamName}</strong>
              </p>

              <!-- Stats Row -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#111827;font-size:20px;font-weight:700;">${newReviewCount}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">New</div>
                  </td>
                  <td style="width:8px;"></td>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#d97706;font-size:20px;font-weight:700;">${needsReplyCount}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">Needs Reply</div>
                  </td>
                  <td style="width:8px;"></td>
                  <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <div style="color:#111827;font-size:20px;font-weight:700;">${avgRating}</div>
                    <div style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;">Avg Rating</div>
                  </td>
                </tr>
              </table>

              ${summaryParagraph ? `
              <div style="margin-top:20px;padding:16px 20px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;">
                <div style="font-size:12px;font-weight:600;color:#0d9488;text-transform:uppercase;margin-bottom:8px;">Sentiment Snapshot</div>
                <div style="color:#374151;font-size:14px;line-height:1.6;">${summaryParagraph}</div>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Review List -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${reviewRows}
              </table>
              ${reviews.length > 15 ? `<p style="margin:12px 0 0;color:#9ca3af;font-size:13px;text-align:center;">and ${reviews.length - 15} more...</p>` : ''}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 40px 36px;text-align:center;">
              <a href="${teamUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#0d9488 0%,#0f766e 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">
                Open in AutoMyReply
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0 0 8px 0;color:#9ca3af;font-size:12px;">
                Sent by <strong>AutoMyReply</strong> &middot; Automated Review Management
              </p>
              <p style="margin:0;color:#d1d5db;font-size:11px;">
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${teamUrl}" style="color:#9ca3af;text-decoration:underline;">Manage preferences</a>
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
