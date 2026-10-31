import { expect, test } from '@playwright/test'
import { createHome, localStack, login, nav, uniqueEmail } from './support/supabase'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

test('offline: reload the app, search still works with thumbnails; edits are disabled', async ({
  page,
  context,
}) => {
  await login(page, uniqueEmail('offline'))
  await createHome(page, 'Offline Home', 'O')

  await page.getByRole('button', { name: '+ Single door' }).click()
  await page.getByLabel('Door name').fill('Pooja Room')
  await page.getByRole('button', { name: 'Add door' }).click()
  await page.getByRole('link', { name: /Pooja Room/ }).click()
  await page.getByRole('button', { name: '+ Add key' }).click()
  await page.getByLabel('Key number', { exact: true }).fill('PR-77')
  await page.getByRole('dialog').getByRole('button', { name: 'Add key' }).click()
  await page.getByRole('link', { name: /PR-77/ }).click()

  // A photo so a thumbnail gets cached for offline use.
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 300
    c.height = 200
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('no 2d')
    ctx.fillStyle = '#c0a060'
    ctx.fillRect(0, 0, 300, 200)
    return c.toDataURL('image/png').split(',')[1] ?? ''
  })
  await page
    .getByLabel('Choose a key photo')
    .setInputFiles({ name: 'k.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByRole('img', { name: 'Photo of key PR-77' })).toBeVisible()

  // Wait until the service worker controls the page and the thumbnail is in Dexie.
  await page.evaluate(async () => navigator.serviceWorker.ready)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const req = indexedDB.open('keyfinder')
              req.onsuccess = () => {
                const c = req.result.transaction('thumbs').objectStore('thumbs').count()
                c.onsuccess = () => {
                  resolve(c.result)
                }
              }
            }),
        ),
      { timeout: 15_000 },
    )
    .toBe(1)

  // Go offline and reload: the shell comes from the SW, data from IndexedDB.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('You’re offline')).toBeVisible()
  await nav(page, 'Find').click()
  await page.getByLabel('Which door is this key for?').fill('pr77')
  const card = page.getByRole('article', { name: 'Door: Pooja Room' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('img', { name: 'Key photo' })).toBeVisible()

  // Edits need a connection.
  await nav(page, 'Doors').click()
  await expect(page.getByRole('button', { name: '+ Single door' })).toBeDisabled()

  await context.setOffline(false)
})
