/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv, type PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Origins the service worker must never cache (CLAUDE.md hard rule 8):
 * hosted Supabase plus whatever VITE_SUPABASE_URL points at (e.g. local 127.0.0.1:54321).
 * Data for offline use comes only from Dexie.
 */
function supabaseUrlPatterns(supabaseUrl: string | undefined): RegExp[] {
  const patterns = [/^https:\/\/[^/]+\.supabase\.co\//]
  if (supabaseUrl) {
    try {
      patterns.push(new RegExp('^' + escapeRegExp(new URL(supabaseUrl).origin) + '/'))
    } catch {
      // Invalid URL: the app itself fails loudly at runtime (src/lib/env.ts).
    }
  }
  return patterns
}

/** Same CSP as production (public/_headers, vercel.json) plus the configured Supabase origin. */
function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  let origin = ''
  try {
    if (supabaseUrl) origin = new URL(supabaseUrl).origin
  } catch {
    origin = ''
  }
  const api = ['https://*.supabase.co', 'wss://*.supabase.co', origin].filter(Boolean).join(' ')
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    `connect-src 'self' ${api}`,
    `img-src 'self' data: blob: https://*.supabase.co ${origin}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** Supabase API paths. In `phone` mode the dev/preview server proxies them to local Supabase. */
const SUPABASE_PATHS = /^\/(auth|rest|storage|functions)\/v1(\/|$)/

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // `npm run phone`: HTTPS on the LAN + same-origin proxy to the local Supabase stack, so a
  // phone (or a tunnel) only needs one address. Never used for production builds.
  const phone = mode === 'phone'
  const proxyTarget = process.env.SUPABASE_PROXY_TARGET ?? 'http://127.0.0.1:54321'
  const proxy = phone
    ? { '^/(auth|rest|storage|functions)/v1(/|$)': { target: proxyTarget, changeOrigin: true } }
    : undefined
  const noCache = supabaseUrlPatterns(env.VITE_SUPABASE_URL)

  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered from src/app/useServiceWorker.ts via virtual:pwa-register
      includeAssets: ['icons/apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'KeyFinder',
        short_name: 'KeyFinder',
        description: 'Find which door a key opens.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#5a45e6',
        background_color: '#f4f5fb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [SUPABASE_PATHS],
        // Supabase is always a different origin, so the navigation fallback never touches it.
        // Precache only holds our own build output. Supabase API/Storage requests are
        // explicitly network-only so no future runtime rule can start caching them.
        // OCR runtime (~7 MB) is not precached: cached on first use of Scan, then offline.
        globIgnores: ['tesseract/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst' as const,
            options: {
              cacheName: 'kf-tesseract',
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Same-origin Supabase paths (phone mode proxy) are never cached either.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && SUPABASE_PATHS.test(url.pathname),
            handler: 'NetworkOnly' as const,
          },
          ...noCache.map((urlPattern) => ({
            urlPattern,
            handler: 'NetworkOnly' as const,
          })),
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ]
  if (mode === 'https' || phone) plugins.push(basicSsl())

  return {
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, proxy },
    // Preview serves the production CSP so e2e tests prove the app works under it.
    preview: {
      port: 4173,
      host: phone ? true : undefined,
      // Quick tunnels (`npm run phone:tunnel`) arrive with a random *.trycloudflare.com host.
      allowedHosts: phone ? ['.trycloudflare.com'] : undefined,
      proxy,
      headers: { 'Content-Security-Policy': contentSecurityPolicy(env.VITE_SUPABASE_URL) },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
