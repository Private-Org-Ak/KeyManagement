/** Invite codes: 16 hex chars (64 bits), shown as XXXX-XXXX-XXXX-XXXX. */
export function cleanInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-F]/g, '')
}

export function isValidInviteCode(input: string): boolean {
  return cleanInviteCode(input).length === 16
}

export function formatInviteCode(input: string): string {
  const c = cleanInviteCode(input)
  return c.match(/.{1,4}/g)?.join('-') ?? ''
}

export function inviteLink(code: string, origin: string = window.location.origin): string {
  return `${origin}/join/${cleanInviteCode(code)}`
}
