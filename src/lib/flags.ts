/**
 * Feature flags (public build-time values).
 * VITE_ENABLE_LLM_FALLBACK=true shows "Try harder" after OCR fails (Phase 10, off by default;
 * it also needs the ANTHROPIC_API_KEY secret on the Supabase edge function).
 */
export const flags = {
  llmFallback: import.meta.env.VITE_ENABLE_LLM_FALLBACK === 'true',
} as const
