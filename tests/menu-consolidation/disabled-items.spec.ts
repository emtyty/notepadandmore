// spec: specs/menu-consolidation.md
// suite: 7. Disabled Stubbed Items in the Native Menu
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
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
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

test.describe('7. Disabled Stubbed Items in the Native Menu', () => {

  test('7.1 Search menu Bookmark items are disabled (enabled: false)', async ({ electronApp, page }) => {
    // Wait for the app to be ready (page fixture ensures buildMenu has been called)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 1. Via electronApp.evaluate, traverse the application menu to find the Search submenu
    //    and inspect the enabled property of 'Toggle Bookmark', 'Next Bookmark',
    //    'Previous Bookmark', 'Clear All Bookmarks' items
    const results = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) return null

      const searchMenu = menu.items.find(
        (item) => item.label === '&Search' || item.label === 'Search'
      )
      if (!searchMenu?.submenu) return null

      const labels = ['Toggle Bookmark', 'Next Bookmark', 'Previous Bookmark', 'Clear All Bookmarks']
      return labels.map((label) => {
        const item = searchMenu.submenu!.items.find((i) => i.label === label)
        return { label, enabled: item?.enabled ?? null }
      })
    })

    expect(results).not.toBeNull()
    // expect: All four items have enabled: false in the native menu — set explicitly in menu.ts
    for (const item of results!) {
      expect(item.enabled, `Expected "${item.label}" to be disabled`).toBe(false)
    }
  })

  test('7.2 Macro menu items (Start Recording, Stop Recording, Playback) are disabled', async ({ electronApp, page }) => {
    // Wait for the app to be ready (page fixture ensures buildMenu has been called)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 1. Via electronApp.evaluate, access the Macro submenu and check enabled for each item
    const results = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) return null

      const macroMenu = menu.items.find(
        (item) => item.label === '&Macro' || item.label === 'Macro'
      )
      if (!macroMenu?.submenu) return null

      const labels = ['Start Recording', 'Stop Recording', 'Playback']
      return labels.map((label) => {
        const item = macroMenu.submenu!.items.find((i) => i.label === label)
        return { label, enabled: item?.enabled ?? null }
      })
    })

    expect(results).not.toBeNull()
    // expect: All three have enabled: false
    for (const item of results!) {
      expect(item.enabled, `Expected "${item.label}" to be disabled`).toBe(false)
    }
  })

  test('7.3 Plugins menu Plugin Manager item is disabled', async ({ electronApp, page }) => {
    // Wait for the app to be ready (page fixture ensures buildMenu has been called)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 1. Via electronApp.evaluate, find 'Plugin Manager...' in the Plugins submenu
    const result = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) return null

      const pluginsMenu = menu.items.find(
        (item) => item.label === '&Plugins' || item.label === 'Plugins'
      )
      if (!pluginsMenu?.submenu) return null

      const item = pluginsMenu.submenu.items.find((i) => i.label === 'Plugin Manager...')
      return item ? { label: item.label, enabled: item.enabled } : null
    })

    expect(result).not.toBeNull()
    // expect: enabled: false
    expect(result!.enabled).toBe(false)
  })

  test('7.4 Settings menu stubbed items (Shortcut Mapper, UDL Editor, Style Configurator) are disabled', async ({ electronApp, page }) => {
    // Wait for the app to be ready (page fixture ensures buildMenu has been called)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 1. Via electronApp.evaluate, check enabled for the three stubbed settings items
    const results = await electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) return null

      const settingsMenu = menu.items.find(
        (item) => item.label === '&Settings' || item.label === 'Settings'
      )
      if (!settingsMenu?.submenu) return null

      // Labels as defined in menu.ts
      const labels = ['Shortcut Mapper...', 'User Defined Languages...', 'Style Configurator...']
      return labels.map((label) => {
        const item = settingsMenu.submenu!.items.find((i) => i.label === label)
        return { label, enabled: item?.enabled ?? null }
      })
    })

    expect(results).not.toBeNull()
    // expect: All three have enabled: false
    for (const item of results!) {
      expect(item.enabled, `Expected "${item.label}" to be disabled`).toBe(false)
    }
  })

  test('7.5 View menu Split View checkbox item is disabled', async ({ electronApp, page }) => {
    // Wait for the app to be ready (page fixture ensures buildMenu has been called)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()

    // 1. Via electronApp.evaluate, retrieve the menu item by id: 'toggle-split-view'
    const result = await electronApp.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById('toggle-split-view')
      if (!item) return null
      return {
        label: item.label,
        type: item.type,
        enabled: item.enabled,
        checked: item.checked,
      }
    })

    expect(result).not.toBeNull()
    // expect: The item exists as a checkbox type with enabled: false
    expect(result!.type).toBe('checkbox')
    expect(result!.enabled).toBe(false)
  })

  test('7.6 IPC channels for disabled items do not crash the renderer when called directly', async ({ electronApp, page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // 1. Send IPC 'menu:shortcut-mapper' directly to the renderer
    // expect: No JavaScript exception — the renderer sets showShortcutMapper=true in the store
    await sendIPC(electronApp, 'menu:shortcut-mapper')

    // 2. Send IPC 'menu:udl-editor'
    // expect: No crash — showUDLEditor is set to true
    await sendIPC(electronApp, 'menu:udl-editor')

    // 3. Send IPC 'menu:style-configurator'
    // expect: No crash — showStyleConfigurator is set to true
    await sendIPC(electronApp, 'menu:style-configurator')

    // Wait for any async reactions to settle
    await page.waitForSelector('[data-testid="app"]', { timeout: 2_000 })

    // 4. Check the browser console for error-level messages
    // Filter out known non-critical browser/extension errors
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('favicon') &&
        !e.includes('net::ERR_')
    )

    // expect: Zero unhandled errors in the renderer console after sending stub IPC channels
    expect(criticalErrors).toHaveLength(0)
  })

})
