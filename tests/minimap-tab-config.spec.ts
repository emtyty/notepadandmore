// E2E: minimap pref, tab bar new-file filler, theme persisted to config.json

import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'

function makeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: makeEnv(),
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    // E2E mode skips session restore — seed an initial buffer.
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('menu:file-new')
    })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
  },
})

async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

async function readConfigJson(electronApp: ElectronApplication): Promise<string | null> {
  return electronApp.evaluate(() => {
    const { app } = require('electron') as typeof import('electron')
    const fs = require('fs') as typeof import('fs')
    const pathMod = require('path') as typeof import('path')
    const p = pathMod.join(app.getPath('userData'), 'config', 'config.json')
    if (!fs.existsSync(p)) return null
    return fs.readFileSync(p, 'utf8')
  })
}

test.describe('Minimap, tab filler, config theme', () => {
  test('double-clicking tab bar filler opens a new untitled tab', async ({ page }) => {
    await expect(page.locator('[data-tab-title="new 1"]')).toBeVisible()
    await page.locator('[data-testid="tabbar-filler"]').dblclick()
    await expect(page.locator('[data-tab-title="new 2"]')).toBeVisible()
  })

  test('Show minimap preference toggles Monaco minimap', async ({ electronApp, page }) => {
    await sendIPC(electronApp, 'menu:preferences')
    await expect(page.getByText('Preferences', { exact: true }).first()).toBeVisible({ timeout: 5_000 })
    await page.getByRole('button', { name: 'Editor' }).click()
    await page.getByRole('checkbox', { name: /Show minimap/i }).check()
    await expect(page.locator('.monaco-editor .minimap')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
  })

  test('Appearance theme is written to config.json (debounced save)', async ({ electronApp, page }) => {
    await sendIPC(electronApp, 'menu:preferences')
    await page.getByRole('button', { name: 'Appearance' }).click()
    const themeSelect = page.locator('select').filter({ has: page.locator('option[value="light"]') }).first()
    await themeSelect.selectOption('light')
    await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')

    await expect.poll(async () => {
      const raw = await readConfigJson(electronApp)
      if (!raw) return null
      try {
        return (JSON.parse(raw) as { theme?: string }).theme ?? null
      } catch {
        return null
      }
    }, { timeout: 5_000 }).toBe('light')
  })
})
