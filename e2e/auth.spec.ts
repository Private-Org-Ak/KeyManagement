import { expect, test } from '@playwright/test'
import { localStack, login, PASSWORD, signIn, uniqueEmail, uniquePhone } from './support/supabase'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

test('new user creates an account with email + password and lands on onboarding', async ({
  page,
}) => {
  await login(page, uniqueEmail('new'))
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'Welcome to KeyFinder' })).toBeVisible()
})

test('phone + password: create account, sign out, sign back in', async ({ page }) => {
  const phone = uniquePhone()
  await login(page, phone)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel('Account').click()
  await expect(page.getByText(phone)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  // Typed the local way (10 digits, spaces) — normalised to the same +91 number.
  const local = phone.slice(3)
  await signIn(page, `${local.slice(0, 5)} ${local.slice(5)}`)
  await expect(page).toHaveURL(/\/onboarding$/)
})

test('wrong password shows a friendly error', async ({ page }) => {
  const email = uniqueEmail('wrong')
  await login(page, email)
  await page.getByLabel('Account').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, email, 'not-the-password')
  await expect(page.getByRole('alert')).toContainText('Wrong email/phone or password.')
})

test('existing account cannot be created twice', async ({ page }) => {
  const email = uniqueEmail('dup')
  await login(page, email)
  await page.getByLabel('Account').click()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'New here' }).click()
  await page.getByLabel('Email or phone').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Repeat password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toContainText('already exists')
})

test('invalid input is rejected client-side', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'New here' }).click()
  await page.getByLabel('Email or phone').fill('not-an-email')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.getByLabel('Repeat password').fill('different')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter an email address or a phone number.')).toBeVisible()
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
  // The match check runs once the fields themselves are valid.
  await page.getByLabel('Email or phone').fill('+91 98765 43210')
  await page.getByLabel('Password', { exact: true }).fill('long-enough-1')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('The passwords don’t match.')).toBeVisible()
})

test('change password, then sign in with the new one', async ({ page }) => {
  const email = uniqueEmail('change')
  await login(page, email)
  await page.getByLabel('Account').click()
  await page.getByRole('button', { name: /Change password/ }).click()
  await page.getByLabel('New password', { exact: true }).fill('brand-new-pass-1')
  await page.getByLabel('Repeat new password').fill('brand-new-pass-1')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByText('Password changed.')).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await signIn(page, email, 'brand-new-pass-1')
  await expect(page).toHaveURL(/\/onboarding$/)
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
