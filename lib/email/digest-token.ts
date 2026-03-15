import crypto from 'crypto'

const SECRET = process.env.TOKEN_ENCRYPTION_SECRET!

interface DigestTokenPayload {
  userId: string
  teamId: string
}

/**
 * Creates a signed, URL-safe unsubscribe token.
 * Format: base64url(JSON payload + "." + HMAC signature)
 */
export function createUnsubscribeToken(payload: DigestTokenPayload): string {
  const data = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64url')
  const token = Buffer.from(`${data}.${signature}`).toString('base64url')
  return token
}

/**
 * Verifies and decodes an unsubscribe token.
 * Returns the payload if valid, null if tampered.
 */
export function verifyUnsubscribeToken(token: string): DigestTokenPayload | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot = decoded.lastIndexOf('.')
    if (lastDot === -1) return null

    const data = decoded.slice(0, lastDot)
    const signature = decoded.slice(lastDot + 1)

    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(data)
      .digest('base64url')

    if (signature !== expectedSig) return null

    return JSON.parse(data) as DigestTokenPayload
  } catch {
    return null
  }
}
