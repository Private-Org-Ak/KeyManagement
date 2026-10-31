import { useMutation } from '@tanstack/react-query'
import { pixelsToBlob, type Pixels } from '@/lib/image'
import type { OcrCandidate } from '@/lib/match'
import { supabase } from '@/lib/supabase'

const MAX_BYTES = 1024 * 1024

/**
 * "Try harder": sends ONE cropped JPEG of the key to the read-key-number edge function,
 * which asks an LLM for candidate numbers. The household's key list is never sent —
 * candidates go through the same local matching.
 */
export function useTryHarder(hid: string) {
  return useMutation({
    mutationFn: async (crop: Pixels): Promise<OcrCandidate[]> => {
      let quality = 0.85
      let jpeg = await pixelsToBlob(crop, 'image/jpeg', quality)
      while (jpeg.size > MAX_BYTES && quality > 0.4) {
        quality -= 0.15
        jpeg = await pixelsToBlob(crop, 'image/jpeg', quality)
      }
      const res = await supabase.functions.invoke<{ candidates: string[] }>('read-key-number', {
        body: jpeg,
        headers: { 'Content-Type': 'image/jpeg', 'x-household-id': hid },
      })
      const err: unknown = res.error
      if (err) throw err instanceof Error ? err : new Error('read-key-number failed')
      return (res.data?.candidates ?? []).slice(0, 5).map((text) => ({ text, confidence: 50 }))
    },
  })
}
