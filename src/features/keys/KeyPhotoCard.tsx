import { useRef } from 'react'
import { Banner, Button, Card, CardHeader, Icon } from '@/components/ui'
import { errorMessage } from '@/lib/errors'
import type { KeyRow } from '@/types/models'
import { useCurrentHousehold } from '@/features/households/HouseholdContext'
import { useRemovePhoto, useSignedPhotoUrl, useThumbUrl, useUploadPhoto } from './api'

export function KeyPhotoCard({ keyRow: key }: { keyRow: KeyRow }) {
  const { hid, online } = useCurrentHousehold()
  const thumb = useThumbUrl(key.id)
  const full = useSignedPhotoUrl(online ? key.photo_path : null, key.updated_at)
  const upload = useUploadPhoto(hid)
  const remove = useRemovePhoto(hid)
  const input = useRef<HTMLInputElement>(null)
  const src = full.data ?? thumb

  return (
    <Card className="flex flex-col gap-4">
      {!key.photo_path && (
        <CardHeader icon="camera" title="Photo" tone="accent">
          A photo helps tell similar keys apart. It stays private to this home.
        </CardHeader>
      )}
      {key.photo_path && src ? (
        <img
          src={src}
          alt={`Photo of key ${key.key_number}`}
          className="max-h-72 w-full rounded-xl object-contain"
        />
      ) : key.photo_path ? (
        <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600 dark:text-slate-400 dark:bg-slate-800">
          Photo available when online
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a key photo"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload.mutate({ keyId: key.id, file })
          e.target.value = ''
        }}
      />
      {(upload.isError || remove.isError) && (
        <Banner tone="error">{errorMessage(upload.error ?? remove.error)}</Banner>
      )}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={!online}
          loading={upload.isPending}
          onClick={() => input.current?.click()}
        >
          <Icon name="camera" className="size-4" />
          {key.photo_path ? 'Replace photo' : 'Add photo'}
        </Button>
        {key.photo_path && (
          <Button
            variant="ghost"
            disabled={!online}
            loading={remove.isPending}
            onClick={() => {
              remove.mutate(key)
            }}
          >
            Remove
          </Button>
        )}
      </div>
    </Card>
  )
}
