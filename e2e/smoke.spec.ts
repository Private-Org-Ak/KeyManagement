import { expect, test } from '@playwright/test'

test('app shell loads and is installable', async ({ page, request }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const res = await request.get(`/${manifestHref ?? ''}`.replace(/^\/\//, '/'))
  expect(res.ok()).toBe(true)
  const manifest = (await res.json()) as {
    display: string
    start_url: string
    icons: { sizes: string; purpose?: string }[]
  }
  expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe('/')
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
})

// Lighthouse ≥ 12 no longer has a PWA category; ask Chrome directly via DevTools Protocol.
test('Chrome reports no installability errors', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP is Chromium-only')
  await page.goto('/')
  await page.evaluate(async () => navigator.serviceWorker.ready)
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[]
  }
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([])
})

test('service worker registers and controls the page', async ({ page }) => {
  await page.goto('/')
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return reg.scope
  })
  expect(scope).toMatch(/\/$/)
})
