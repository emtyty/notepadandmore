import { test, expect } from './fixtures'

test('app launches and shows editor', async ({ page }) => {
  await expect(page.locator('[data-testid="app"]')).toBeVisible()
  await expect(page.locator('[data-testid="menubar"]')).toBeVisible()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible()
  await expect(page.locator('[data-testid="tabbar"]')).toBeVisible()
  await expect(page.locator('[data-testid="editor-pane"]')).toBeVisible()
  await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()
  await expect(page.locator('.monaco-editor')).toBeVisible()
})

test('default tab is new 1 and editor is ready', async ({ page }) => {
  await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()
  await expect(page.locator('[data-testid="cursor-position"]')).toContainText('Ln 1, Col 1')
})

test('sidebar is hidden on startup', async ({ page }) => {
  await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
})

test('bottom panel is hidden on startup', async ({ page }) => {
  await expect(page.locator('[data-testid="bottom-panel"]')).not.toBeVisible()
})
