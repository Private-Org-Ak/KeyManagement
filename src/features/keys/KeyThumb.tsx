import { useThumbUrl } from './api'

export function KeyThumb({ keyId, size = 'md' }: { keyId: string; size?: 'md' | 'lg' }) {
  const url = useThumbUrl(keyId)
  const cls = size === 'lg' ? 'size-20 rounded-3xl' : 'size-12 rounded-2xl'
  if (!url)
    return (
      <div
        className={`${cls} flex shrink-0 items-center justify-center bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M18 12v3M21 12v2" strokeLinecap="round" />
        </svg>
      </div>
    )
  return <img src={url} alt="Key photo" className={`${cls} shrink-0 object-cover`} />
}
