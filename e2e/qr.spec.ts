import { expect, test } from '@playwright/test'
import { createHome, localStack, login, nav, uniqueEmail } from './support/supabase'
import { E2E_QR_TAG } from './support/y4m'
import { seedViaApi } from './support/seed'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

// Runs in the "qr-camera" project: Chrome's fake camera shows a kf1: QR code.
test('assign a QR tag with the camera, then scanning it shows the door', async ({ page }) => {
  await login(page, uniqueEmail('qr'))
  const hid = await createHome(page, 'QR Home', 'Q')
  await seedViaApi(page, hid, [{ door: 'Terrace Door', number: 'T-501' }])
  await page.reload()
  await nav(page, 'Find').click()
  await page.getByLabel('Which door is this key for?').fill('T501')
  await page
    .getByRole('article', { name: 'Door: Terrace Door' })
    .getByRole('link', { name: /T-501/ })
    .click()

  await page.getByRole('button', { name: 'Assign tag' }).click()
  await expect(page.getByText(`Tagged: ${E2E_QR_TAG.slice(-6)}`)).toBeVisible({ timeout: 20_000 })

  await nav(page, 'Scan').click()
  await page.getByRole('tab', { name: 'QR tag' }).click()
  await expect(page.getByRole('article', { name: 'Door: Terrace Door' })).toBeVisible({
    timeout: 20_000,
  })
})

test('camera tracks are stopped when leaving the scan screen', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] }
    w.__streams = []
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c)
      w.__streams.push(s)
      return s
    }
  })
  await login(page, uniqueEmail('cam'))
  await createHome(page, 'Cam Home', 'C')
  await nav(page, 'Scan').click()
  await expect(page.getByRole('button', { name: 'Read number from the camera' })).toBeEnabled({
    timeout: 15_000,
  })
  const live = () =>
    page.evaluate(
      () =>
        (window as unknown as { __streams: MediaStream[] }).__streams
          .flatMap((s) => s.getTracks())
          .filter((t) => t.readyState === 'live').length,
    )
  expect(await live()).toBeGreaterThan(0)
  await nav(page, 'Doors').click()
  await expect.poll(live).toBe(0)
})
