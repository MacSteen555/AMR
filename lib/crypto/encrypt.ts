import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const TAG_LENGTH = 16

const encryptionSecret = process.env.TOKEN_ENCRYPTION_SECRET!

if (!encryptionSecret) {
  throw new Error('Missing TOKEN_ENCRYPTION_SECRET')
}

// Derive a consistent 32-byte key from the secret
const getKey = (): Buffer => {
  return crypto.createHash('sha256').update(encryptionSecret).digest()
}

/**
 * Encrypts a string and returns a base64-encoded string containing IV + encrypted data + auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Combine IV + encrypted data + tag into a single string
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    tag,
  ])
  
  return combined.toString('base64')
}

/**
 * Decrypts a base64-encoded encrypted string
 */
export function decrypt(encryptedData: string): string {
  const key = getKey()
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract IV, encrypted data, and tag
  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(combined.length - TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

