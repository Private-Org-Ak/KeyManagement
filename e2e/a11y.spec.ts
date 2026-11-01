import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createHome, localStack, login, nav, uniqueEmail } from './support/supabase'
import { seedViaApi } from './support/seed'

async function audit(page: Page, label: string) {
  // Entrance animations fade content in; judge contrast on the settled screen.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? '?'}): ${v.nodes.length} × ${v.help} → ${v.nodes.map((n) => `${n.target.join(' ')} [${n.failureSummary?.split('\n').slice(-1)[0] ?? ''}]`).join(' | ')}`,
  )
  expect(summary, `axe violations on ${label}`).toEqual([])
}

test('login screen has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await audit(page, 'login')
})

test.describe('signed-in screens', () => {
  test.skip(!localStack(), 'needs local Supabase (npx supabase start)')

  for (const scheme of ['light', 'dark'] as const) {
    test(`core screens have no WCAG A/AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await login(page, uniqueEmail(`a11y-${scheme}`))
      await audit(page, 'onboarding')
      const hid = await createHome(page, 'A11y Home', 'A')
      await seedViaApi(page, hid, [
        { door: 'Main Door', number: 'KF-1021' },
        { door: 'Guest Room', number: '4417' },
      ])
      await page.reload()
      await audit(page, 'doors')
      await nav(page, 'Find').click()
      await page.getByLabel('Which door is this key for?').fill('kf')
      await expect(page.getByRole('article', { name: 'Door: Main Door' })).toBeVisible()
      await audit(page, 'search results')
      await page
        .getByRole('article', { name: 'Door: Main Door' })
        .getByRole('link', { name: /KF-1021/ })
        .click()
      await expect(page.getByRole('heading', { name: 'KF-1021' })).toBeVisible()
      await audit(page, 'key detail')
      await nav(page, 'Members').click()
      await expect(page.getByRole('heading', { name: 'Pending invites' })).toBeVisible()
      await audit(page, 'members')
      await nav(page, 'Settings').click()
      await expect(page.getByRole('heading', { name: 'Home settings' })).toBeVisible()
      await audit(page, 'settings')
      await nav(page, 'Scan').click()
      await audit(page, 'scan')
    })
  }
})
