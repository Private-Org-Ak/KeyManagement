import { cx } from './cx'

/** Small inline icon set (24×24, stroke). Decorative by default (aria-hidden). */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  door: 'M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17M14.5 12.5h.01',
  users:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21c0-3.5 3-6 7-6s7 2.5 7 6M16.5 3.3a4 4 0 0 1 0 7.4M22 21c0-2.9-1.7-5-4.5-5.7',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.3-2 3.4-2-.7a7 7 0 0 1-2 1.2L14.6 21h-4l-.4-2.3a7 7 0 0 1-2-1.2l-2 .7-2-3.4 1.6-1.3a7 7 0 0 1 0-3l-1.6-1.3 2-3.4 2 .7a7 7 0 0 1 2-1.2L10.6 3h4l.4 2.3a7 7 0 0 1 2 1.2l2-.7 2 3.4-1.6 1.3a7 7 0 0 1 0 3Z',
  key: 'M8 15.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12.5 11H21M18 11v3M21 11v2',
  plus: 'M12 5v14M5 12h14',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  bath: 'M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3ZM6 12V6a2 2 0 0 1 3.5-1.3M7 20l-1 2M17 20l1 2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  box: 'M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M18 16v2',
  nfc: 'M6 8.5a8 8 0 0 1 0 7M9.5 6a12 12 0 0 1 0 12M13 4a16 16 0 0 1 0 16',
  camera:
    'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
  tag: 'M3 12V4h8l10 10-8 8L3 12ZM7.5 7.5h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  wifiOff:
    'M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.3-2.4M19 12.9a10 10 0 0 0-2.2-1.6M2 8.8a15 15 0 0 1 4.4-2.6M22 8.8a15 15 0 0 0-11-3.7M12 20h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3.6-6 8-6s8 2 8 6',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  phone: 'M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM11 18h2',
  printer:
    'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  shield: 'M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  layers: 'M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 17.5l10 5 10-5',
  x: 'M6 6l12 12M18 6 6 18',
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className,
  strokeWidth = 1.9,
  title,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx('size-5 shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
