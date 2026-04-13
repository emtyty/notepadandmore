import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'

async function launchApp() {
  const app = await electron.launch({
    args: [path.resolve(__dirname, '../out/main/index.js')],
    env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
    timeout: 15_000,
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
  return { app, page }
}

const isMac = process.platform === 'darwin'
const expectedMod = isMac ? '⌘' : 'Ctrl'
const wrongMod = isMac ? 'Ctrl' : '⌘'

test('Toolbar tooltip for the Save button uses the platform modifier', async () => {
  const { app, page } = await launchApp()
  try {
    const toolbar = page.locator('[data-testid="toolbar"]')
    await expect(toolbar).toBeVisible()

    // The Save button is the 3rd button in the first group (File). Hover it to
    // trigger the Radix tooltip, then assert the rendered tooltip text.
    const saveBtn = toolbar.locator('button').nth(2)
    await saveBtn.hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    const tipText = (await tip.textContent()) ?? ''
    expect(tipText, `Save tooltip should use platform modifier: "${tipText}"`).toContain(expectedMod)
    expect(tipText).not.toContain(wrongMod)
  } finally {
    await app.close()
  }
})

test('Toolbar Find button tooltip also uses the platform modifier', async () => {
  const { app, page } = await launchApp()
  try {
    const toolbar = page.locator('[data-testid="toolbar"]')
    // Find = first button of Search group (8th overall, after 5 File + 2 Edit + 3 Clipboard = 10).
    // Simpler: pick the button whose icon is lucide-search and that sits in the toolbar.
    const findBtn = toolbar.locator('button', { has: page.locator('.lucide-search') })
    await findBtn.first().hover()
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeVisible()
    const tipText = (await tip.textContent()) ?? ''
    expect(tipText).toContain('Find')
    expect(tipText).toContain(expectedMod)
    expect(tipText).not.toContain(wrongMod)
  } finally {
    await app.close()
  }
})

test('WelcomeScreen shortcut hints use the platform modifier', async () => {
  const { app, page } = await launchApp()
  try {
    // WelcomeScreen renders by default when no buffers exist (E2E starts clean).
    const newFileHint = page.getByText(/^[⌘Ctrl]+\s*N$/).first()
    await expect(newFileHint).toBeVisible()
    const text = (await newFileHint.textContent()) ?? ''
    expect(text.trim()).toBe(`${expectedMod} N`)
  } finally {
    await app.close()
  }
})

test('MenuBar dropdown shortcuts use the platform modifier (non-macOS only)', async () => {
  // MenuBar is hidden on macOS — the native menu owns shortcuts there.
  test.skip(isMac, 'MenuBar is not rendered on macOS')
  const { app, page } = await launchApp()
  try {
    const menubar = page.locator('[data-testid="menubar"]')
    await expect(menubar).toBeVisible()
    await menubar.getByRole('button', { name: 'File' }).click()
    // File menu's "New File" row shows its shortcut label.
    await expect(page.getByText(`${expectedMod}+N`).first()).toBeVisible()
  } finally {
    await app.close()
  }
})
