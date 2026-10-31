import { expect, test } from '@playwright/test'
import { localStack, login, uniqueEmail } from './support/supabase'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

test('new user signs in with an email code and lands on onboarding', async ({ page }) => {
  await login(page, uniqueEmail('new'))
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Welcome to KeyFinder' })).toBeVisible()
})

test('wrong code shows a friendly error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(uniqueEmail('wrong'))
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText('wrong or has expired')
  await expect(page.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled()
})

test('invalid email is rejected client-side', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('not-an-email')
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
})

test('sign out wipes local data and returns to login', async ({ page }) => {
  await login(page, uniqueEmail('signout'))
  await page.getByLabel('Account').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  const counts = await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    const kf = dbs.find((d) => d.name === 'keyfinder')
    if (!kf) return { households: 0 }
    return await new Promise<{ households: number }>((resolve) => {
      const req = indexedDB.open('keyfinder')
      req.onsuccess = () => {
        const tx = req.result.transaction('households', 'readonly')
        const c = tx.objectStore('households').count()
        c.onsuccess = () => {
          resolve({ households: c.result })
        }
      }
    })
  })
  expect(counts.households).toBe(0)
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kf.'))),
  ).toEqual([])
})
