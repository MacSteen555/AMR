/**
 * Resolves the signature value from location settings into the actual text
 * to use in the reply prompt.
 *
 * Preset values: store_name, team_name, user_name
 * Custom: any other string is used as-is
 */
export function resolveSignature(
  raw: string | null | undefined,
  context: { locationName?: string; teamName?: string; userName?: string }
): string | null {
  if (!raw || !raw.trim()) return null

  const trimmed = raw.trim()
  switch (trimmed) {
    case 'store_name':
      return context.locationName?.trim() || null
    case 'team_name':
      return context.teamName?.trim() || null
    case 'user_name':
      return context.userName?.trim() || null
    default:
      return trimmed
  }
}
