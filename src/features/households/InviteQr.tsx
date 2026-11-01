import { useEffect, useState } from 'react'

/** QR of the invite link. `qrcode` is lazy-loaded (rule 10); it is already used for tag printing. */
export function InviteQr({ link }: { link: string }) {
  const [svg, setSvg] = useState<{ link: string; svg: string } | null>(null)

  useEffect(() => {
    const flag = { cancelled: false }
    void (async () => {
      const QR = await import('qrcode')
      const out = await QR.toString(link, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })
      if (!flag.cancelled) setSvg({ link, svg: out })
    })()
    return () => {
      flag.cancelled = true
    }
  }, [link])

  return (
    <div
      role="img"
      aria-label="Invite QR code"
      data-testid="invite-qr"
      className="mx-auto aspect-square w-56 rounded-2xl bg-white p-2 ring-1 ring-slate-200 [&>svg]:h-full [&>svg]:w-full"
      // qrcode's own SVG output for a link we built — no user-controlled markup.
      dangerouslySetInnerHTML={svg?.link === link ? { __html: svg.svg } : undefined}
    />
  )
}
