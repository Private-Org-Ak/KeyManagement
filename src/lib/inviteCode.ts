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

/**
 * Reads an invite from a scanned QR: a join link (`…/join/<code>`, any host — the code is
 * what matters, joining still needs the user's tap) or a bare code. Null if it isn't one.
 */
export function parseInvitePayload(raw: string): string | null {
  const s = raw.trim()
  const fromLink = /^https?:\/\/[^/?#\s]+\/join\/([0-9A-Fa-f-]+)\/?(?:[?#].*)?$/.exec(s)
  const candidate = fromLink?.[1] ?? (/^[0-9A-Fa-f\s-]+$/.test(s) ? s : '')
  return isValidInviteCode(candidate) ? cleanInviteCode(candidate) : null
}

/**
 * Share text. Leads with the in-app route: on iPhone a tapped link opens Safari, not the
 * installed app (separate storage), so typing the code into the app is the reliable path.
 */
export function inviteMessage(homeName: string, code: string): string {
  return [
    `You’re invited to “${homeName}” on KeyFinder.`,
    `Open the KeyFinder app → Join with a code → enter ${formatInviteCode(code)}`,
    `New to KeyFinder? Open the link below, create an account, then join.`,
    `The code works once and expires in 7 days.`,
  ].join('\n')
}
