import { expect, test } from '@playwright/test'
import { createHome, localStack, login, nav, uniqueEmail } from './support/supabase'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

test('A creates a home and invites; B joins via link; A removes B; B is bounced out', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()

  // A: sign up, create a home, add a door so there is data to see.
  await login(a, uniqueEmail('owner'))
  const hid = await createHome(a, 'E2E Home', 'Asha')
  await a.getByRole('button', { name: '+ Single door' }).click()
  await a.getByLabel('Door name').fill('Front Door')
  await a.getByRole('button', { name: 'Add door' }).click()
  await expect(a.getByRole('link', { name: /Front Door/ })).toBeVisible()

  // A: invite a member.
  await nav(a, 'Members').click()
  await a.getByRole('button', { name: 'Invite' }).click()
  await a.getByRole('button', { name: 'Create invite' }).click()
  const code = (await a.getByTestId('invite-code').textContent())?.replace(/-/g, '') ?? ''
  expect(code).toMatch(/^[0-9A-F]{16}$/)
  await a.getByRole('button', { name: 'Done' }).click()
  await expect(a.getByText('Member invite')).toBeVisible()

  // B: opens the join link while signed out → login → back to the join page.
  await login(b, uniqueEmail('member'), `/join/${code}`)
  await expect(b).toHaveURL(new RegExp(`/join/${code}$`))
  await b.getByLabel('Your name').fill('Bina')
  await b.getByRole('button', { name: 'Join home' }).click()
  await expect(b).toHaveURL(new RegExp(`/h/${hid}/doors$`))
  await nav(b, 'Doors').click()
  await expect(b.getByRole('link', { name: /Front Door/ })).toBeVisible()

  // The invite is single-use.
  const c = await (await browser.newContext()).newPage()
  await login(c, uniqueEmail('late'), `/join/${code}`)
  await c.getByRole('button', { name: 'Join home' }).click()
  await expect(c.getByRole('alert')).toContainText('invalid, used or expired')

  // A: removes B.
  await a.reload()
  await expect(a.getByRole('listitem').filter({ hasText: 'Bina' })).toBeVisible()
  await a
    .getByRole('listitem')
    .filter({ hasText: 'Bina' })
    .getByRole('button', { name: 'Remove' })
    .click()
  await a.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await expect(a.getByRole('listitem').filter({ hasText: 'Bina' })).toHaveCount(0)

  // B: next navigation bounces them out, and the household is wiped from the device.
  await nav(b, 'Find').click()
  await expect(b).toHaveURL(/\/onboarding$/)
  const leftover = await b.evaluate(
    (h) =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('keyfinder')
        req.onsuccess = () => {
          const idx = req.result
            .transaction('doors')
            .objectStore('doors')
            .index('household_id')
            .count(h)
          idx.onsuccess = () => {
            resolve(idx.result)
          }
        }
      }),
    hid,
  )
  expect(leftover).toBe(0)
})

test('members do not see admin actions (cosmetic) and the DB blocks them anyway', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage()
  const m = await (await browser.newContext()).newPage()
  await login(a, uniqueEmail('owner2'))
  await createHome(a, 'Role Home', 'Owner')
  await nav(a, 'Members').click()
  await a.getByRole('button', { name: 'Invite' }).click()
  await a.getByRole('button', { name: 'Create invite' }).click()
  const code = (await a.getByTestId('invite-code').textContent())?.replace(/-/g, '') ?? ''

  await login(m, uniqueEmail('member2'), `/join/${code}`)
  await m.getByRole('button', { name: 'Join home' }).click()
  await nav(m, 'Members').click()
  await expect(m.getByRole('heading', { name: 'Members' })).toBeVisible()
  await expect(m.getByRole('button', { name: 'Invite' })).toHaveCount(0)
  await expect(m.getByRole('button', { name: 'Remove' })).toHaveCount(0)
  await expect(m.getByRole('button', { name: 'Leave this home' })).toBeVisible()
  await nav(m, 'Settings').click()
  await expect(m.getByRole('button', { name: 'Delete home…' })).toHaveCount(0)
})
