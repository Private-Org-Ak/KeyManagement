// Phase 10 (optional, off by default): "Try harder" OCR fallback.
//
// POST one cropped JPEG of a key (≤ 1 MB) with the user's JWT and `x-household-id`.
// Returns {"candidates": string[]} — candidate key numbers only. The household's key list is
// never sent to the model; the client matches candidates locally.
//
// Secrets (supabase secrets set …): ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional,
// default claude-opus-5-5), OCR_DAILY_LIMIT (optional, default 20).
// SUPABASE_URL / SUPABASE_ANON_KEY are provided by the Edge runtime.
import Anthropic from 'npm:@anthropic-ai/sdk@^0'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const MAX_BYTES = 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CANDIDATE = /^[A-Z0-9-]{1,40}$/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-household-id, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const PROMPT = `This is a photo of a metal door key. Read the number or code stamped/engraved on it.
Return every plausible reading, most likely first (max 5). Use only A-Z, 0-9 and "-".
If no number is visible, return an empty list.`

const SCHEMA = {
  type: 'object',
  properties: { candidates: { type: 'array', items: { type: 'string' } } },
  required: ['candidates'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json(503, { error: 'not_configured' })

  // 1. Authenticate with the caller's JWT (user-scoped client: RLS applies).
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'unauthorized' })
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return json(401, { error: 'unauthorized' })

  // 2. Validate input.
  const hid = req.headers.get('x-household-id') ?? ''
  if (!UUID.test(hid)) return json(400, { error: 'bad_household' })
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BYTES) return json(413, { error: 'too_large' })
  const bytes = new Uint8Array(await req.arrayBuffer())
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return json(413, { error: 'too_large' })
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return json(415, { error: 'jpeg_only' })

  // 3. Membership + per-user daily rate limit (one RPC, enforced in Postgres).
  const limit = Number(Deno.env.get('OCR_DAILY_LIMIT') ?? '20')
  const { data: allowed, error: quotaErr } = await supabase.rpc('consume_ocr_quota', {
    p_household_id: hid,
    p_daily_limit: Number.isFinite(limit) ? limit : 20,
  })
  if (quotaErr) return json(quotaErr.code === '42501' ? 403 : 500, { error: quotaErr.code === '42501' ? 'forbidden' : 'quota_error' })
  if (!allowed) return json(429, { error: 'rate_limited' })

  // 4. Ask the model for candidates only (structured JSON output).
  const client = new Anthropic({ apiKey })
  let b64 = ''
  for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  b64 = btoa(b64)

  try {
    const response = await client.beta.messages.create({
      model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5',
      max_tokens: 1024,
      // Simple perception task: low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // If a safety classifier declines, retry server-side on the recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    } as unknown as Parameters<typeof client.beta.messages.create>[0])

    if (!('content' in response) || response.stop_reason === 'refusal') return json(200, { candidates: [] })
    const text = response.content.find((b) => b.type === 'text')
    const parsed: unknown = text && 'text' in text ? JSON.parse(text.text) : { candidates: [] }
    const raw = (parsed as { candidates?: unknown }).candidates
    const candidates = (Array.isArray(raw) ? raw : [])
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.toUpperCase().trim())
      .filter((c) => CANDIDATE.test(c))
      .slice(0, 5)
    return json(200, { candidates })
  } catch (e) {
    // Never log the image or user data; only the error class/status.
    const status = e instanceof Anthropic.APIError ? e.status : undefined
    console.error('read-key-number: model call failed', status ?? (e instanceof Error ? e.name : 'unknown'))
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: 'rate_limited' })
    return json(502, { error: 'upstream_error' })
  }
})
