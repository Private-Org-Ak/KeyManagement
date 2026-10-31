import { expect, test, type Page } from '@playwright/test'
import { createHome, localStack, login, nav, requireStack, uniqueEmail } from './support/supabase'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

async function pngBuffer(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 480
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('no 2d')
    ctx.fillStyle = '#b8a26a'
    ctx.fillRect(0, 0, 640, 480)
    ctx.fillStyle = '#333'
    ctx.font = 'bold 96px monospace'
    ctx.fillText('4417', 180, 270)
    return c.toDataURL('image/png')
  })
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')
}

test('setup: room + washroom, quick-add with second copy, search, photo', async ({
  page,
  browser,
}) => {
  await login(page, uniqueEmail('setup'))
  const hid = await createHome(page, 'Setup Home', 'Asha')

  // Room + attached washroom in one step.
  await page.getByRole('button', { name: '+ Room + washroom' }).click()
  await page.getByLabel('Room name').fill('Master Bedroom')
  await page.getByLabel('Floor').fill('First')
  await page.getByRole('button', { name: 'Add both doors' }).click()
  await expect(page.getByRole('link', { name: /^Master Bedroom Room/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Master Bedroom Washroom/ })).toBeVisible()

  // Quick-add loop: number → same number, second copy → next door → number.
  await page.getByRole('link', { name: 'Quick add keys' }).click()
  await expect(page.getByLabel('Door', { exact: true })).toHaveValue(/.+/)
  await page.getByLabel('Key number', { exact: true }).fill('4417')
  await page.getByRole('button', { name: 'Save key' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toContainText('4417')
  await page.getByRole('button', { name: /Same number, copy 2/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toContainText('2 keys')
  await page.getByRole('button', { name: 'Next door →' }).click()
  await page.getByLabel('Key number', { exact: true }).fill('4418')
  await page.getByRole('button', { name: 'Save key' }).click()
  await expect(page.getByText('Every door has at least one key.')).toBeVisible()

  // Search: partial number → door, both copies grouped.
  await nav(page, 'Find').click()
  const search = page.getByLabel('Which door is this key for?')
  await search.fill('441')
  const results = page.getByRole('region', { name: 'Results' })
  await expect(results.getByRole('article')).toHaveCount(2)
  await search.fill('4417')
  const card = results.getByRole('article', { name: 'Door: Master Bedroom' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('listitem')).toHaveCount(2)
  await search.fill('master wash')
  await expect(
    results.getByRole('article', { name: 'Door: Master Bedroom Washroom' }),
  ).toBeVisible()
  await search.fill('9999')
  await expect(page.getByText('No matching key')).toBeVisible()

  // Door detail shows its keys and holders; set a holder and a photo on one key.
  await search.fill('4417')
  await card.getByRole('listitem').first().click()
  await page.getByLabel('Who has it').fill('Cleaner')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page
    .getByLabel('Choose a key photo')
    .setInputFiles({ name: 'key.png', mimeType: 'image/png', buffer: await pngBuffer(page) })
  await expect(page.getByRole('img', { name: 'Photo of key 4417' })).toBeVisible()
  const keyId = /\/keys\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''

  // The stored photo is a re-encoded JPEG under {hid}/{keyId}.jpg.
  const photoPath = `${hid}/${keyId}.jpg`

  // A non-member cannot get a signed URL for it.
  const outsider = await (await browser.newContext()).newPage()
  await login(outsider, uniqueEmail('outsider'))
  const { apiUrl, anonKey } = requireStack()
  const status = await outsider.evaluate(
    async ({ apiUrl, anonKey, photoPath }) => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      )
      const token = (
        JSON.parse(localStorage.getItem(key ?? '') ?? '{}') as { access_token?: string }
      ).access_token
      const res = await fetch(`${apiUrl}/storage/v1/object/sign/key-photos/${photoPath}`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 }),
      })
      return res.status
    },
    { apiUrl, anonKey, photoPath },
  )
  expect(status).toBeGreaterThanOrEqual(400)

  // Reverse lookup on the door page: holder visible.
  await page.getByRole('link', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { name: 'Master Bedroom' })).toBeVisible()
  await expect(page.getByText('With Cleaner')).toBeVisible()
})

test('duplicate door names get a friendly error', async ({ page }) => {
  await login(page, uniqueEmail('dup'))
  await createHome(page, 'Dup Home', 'D')
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '+ Single door' }).click()
    await page.getByLabel('Door name').fill('Store')
    await page.getByRole('button', { name: 'Add door' }).click()
  }
  await expect(page.getByRole('alert')).toContainText('A door with that name already exists.')
})
