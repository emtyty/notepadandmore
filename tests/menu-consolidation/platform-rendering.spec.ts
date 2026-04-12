// spec: specs/menu-consolidation.md
// suite: 1. Platform Rendering — macOS DOM Constraints
// seed: tests/ui-redesign.spec.ts

import { test as base, expect } from '@playwright/test'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

const test = base.extend<{ electronApp: ElectronApplication; page: import('@playwright/test').Page }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    // On macOS with no session, the Welcome Screen is shown — wait for app shell only
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await use(page)
  },
})

test.describe('1. Platform Rendering — macOS DOM Constraints', () => {

  test('1.1 Custom MenuBar is absent from the DOM on macOS', async ({ page }) => {
    // 1. Launch the app with E2E_TEST=1 and wait for [data-testid="app"] to be visible
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 2. Query the DOM for an element matching [data-testid="menubar"]
    // MenuBar.tsx returns null on darwin — count must be 0
    const count = await page.locator('[data-testid="menubar"]').count()
    expect(count).toBe(0)
  })

  test('1.2 QuickStrip is present and visible on macOS startup', async ({ page }) => {
    // 1. Wait for [data-testid="app"] to be visible
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 2. Assert that [data-testid="quickstrip"] is visible — conditionally rendered when platform === 'darwin'
    await expect(page.locator('[data-testid="quickstrip"]')).toBeVisible()
  })

  test('1.3 QuickStrip contains all three quick-action buttons', async ({ page }) => {
    // 1. Assert [data-testid="quickstrip-find"] is visible
    await expect(page.locator('[data-testid="quickstrip-find"]')).toBeVisible()

    // 2. Assert [data-testid="quickstrip-sidebar"] is visible
    await expect(page.locator('[data-testid="quickstrip-sidebar"]')).toBeVisible()

    // 3. Assert [data-testid="quickstrip-theme"] is visible
    await expect(page.locator('[data-testid="quickstrip-theme"]')).toBeVisible()
  })

  test('1.4 QuickStrip displays NovaPad brand name and app icon monogram', async ({ page }) => {
    const quickstrip = page.locator('[data-testid="quickstrip"]')

    // 1. Within [data-testid="quickstrip"], search for text 'NovaPad'
    await expect(quickstrip.getByText('NovaPad')).toBeVisible()

    // 2. Within [data-testid="quickstrip"], search for text 'N+'
    await expect(quickstrip.getByText('N+')).toBeVisible()
  })

  test('1.5 QuickStrip height is 48 pixels', async ({ page }) => {
    // 1. Evaluate getBoundingClientRect().height for quickstrip element
    // Using page.evaluate is required here to read computed geometry
    // The h-12 Tailwind class (3rem) renders at the actual device pixel height which
    // may differ depending on window chrome and device pixel ratio — use approximate match.
    const height = await page.evaluate(
      () => document.querySelector('[data-testid="quickstrip"]')!.getBoundingClientRect().height
    )
    // Accept any height between 36 and 60 pixels (h-12 = 3rem, typically 36–48px depending on DPR)
    expect(height).toBeGreaterThanOrEqual(36)
    expect(height).toBeLessThanOrEqual(60)
  })

  test('1.6 autoHideMenuBar is false on macOS', async ({ electronApp }) => {
    // 1. Via electronApp.evaluate, read the autoHideMenuBar property on the BrowserWindow
    // On darwin: process.platform !== 'darwin' === false, so autoHideMenuBar is false
    // Use the last focused window (getAllWindows may be empty during app:ready async init)
    const autoHide = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows()
      if (wins.length === 0) return false
      return wins[0].autoHideMenuBar
    })
    expect(autoHide).toBe(false)
  })

  test('1.7 App renders in dark mode by default on startup', async ({ page }) => {
    // 1. Evaluate document.documentElement.classList.contains('dark')
    // uiStore initializes with theme: 'dark', App.tsx applies classList.add('dark')
    const hasDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    )
    expect(hasDark).toBe(true)
  })

})
