// spec: specs/phase5-sidebar-filewatching.md

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

// Extended fixture that shares ONE ElectronApplication instance between electronApp and page
const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
  },
})

// IPC helper — sends a channel+args from main process to the renderer
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

test.describe('Feature 1: Sidebar Visibility', () => {

  // Scenario 1: Sidebar is hidden by default on startup
  test('Scenario 1 — sidebar is hidden by default', async ({ page }) => {
    // Verify the app root is visible
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // Sidebar should not be visible on a fresh launch (uiStore initial state: showSidebar: false)
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // Scenario 2: Sidebar shows when toggled visible via IPC
  test('Scenario 2 — sidebar shows after ui:toggle-sidebar true', async ({ electronApp, page }) => {
    // Send IPC to show the sidebar
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)

    // Wait for the sidebar to become visible
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Sidebar should now be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Default tab should be "File Browser" — verify the button is present
    await expect(
      page.locator('[data-testid="sidebar"] button[title="File Browser"]')
    ).toBeVisible()
  })

  // Scenario 3: Sidebar hides when toggled off via IPC
  test('Scenario 3 — sidebar hides after ui:toggle-sidebar false', async ({ electronApp, page }) => {
    // First show the sidebar
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Confirm it is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Now hide the sidebar
    await sendIPC(electronApp, 'ui:toggle-sidebar', false)

    // Sidebar should no longer be visible
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // Scenario 4: Close button (✕) hides the sidebar
  test('Scenario 4 — close button hides the sidebar', async ({ electronApp, page }) => {
    // Show the sidebar via IPC
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Confirm sidebar is visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Click the Close Sidebar button
    await page.locator('[data-testid="sidebar"] button[title="Close Sidebar"]').click()

    // Sidebar should be hidden after clicking close
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // Scenario 5: Switching sidebar tabs renders the correct panel
  test('Scenario 5 — switching sidebar tabs renders correct panel', async ({ electronApp, page }) => {
    // Show the sidebar
    await sendIPC(electronApp, 'ui:toggle-sidebar', true)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    const sidebar = page.locator('[data-testid="sidebar"]')

    // Switch to "Project" tab and verify the Project panel header
    await sidebar.locator('button[title="Project"]').click()
    await expect(sidebar.getByText('Project', { exact: true })).toBeVisible()

    // Switch to "Document Map" tab and verify the Document Map panel header
    await sidebar.locator('button[title="Document Map"]').click()
    await expect(sidebar.getByText('Document Map', { exact: true })).toBeVisible()

    // Switch to "Function List" tab and verify the Function List panel header
    await sidebar.locator('button[title="Function List"]').click()
    // Panel header may render as "Functions" or "Function List"
    await expect(
      sidebar.locator('text=/Function/i').first()
    ).toBeVisible()

    // Switch back to "File Browser" tab and verify the file browser empty state or "Open Folder…" button
    await sidebar.locator('button[title="File Browser"]').click()
    await expect(
      sidebar.locator('button', { hasText: 'Open Folder…' })
    ).toBeVisible()
  })

})
