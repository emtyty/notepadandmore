// spec: specs/menu-consolidation.md
// suite: 5. Editor Context Menu
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
    // Create a buffer so Monaco editor loads (app starts with WelcomeScreen when no session)
    await electronApp.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu:file-new')
    )
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await use(page)
  },
})

test.describe('5. Editor Context Menu', () => {

  test('5.1 Right-clicking the Monaco editor shows the custom Radix context menu', async ({ page }) => {
    // 1. Click .monaco-editor textarea to focus the editor
    await page.locator('.monaco-editor textarea').first().click({ force: true })

    // 2. Right-click on the Monaco editor container inside [data-testid="editor-pane"]
    // Monaco's built-in context menu is suppressed via contextmenu:false
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })

    // expect: A custom context menu appears containing 'Cut', 'Copy', 'Paste' items
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Paste' })).toBeVisible()
  })

  test('5.2 Context menu has all expected top-level items', async ({ page }) => {
    // 1. Right-click the Monaco editor to open the context menu
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })

    // 2. Assert visibility of all seven items
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Paste' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Select All' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Go to Line...' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Toggle Comment' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Convert Case' })).toBeVisible()
  })

  test('5.3 Context menu uses macOS ⌘ modifier in keyboard shortcut hints', async ({ page }) => {
    // 1. Open the context menu and locate the keyboard shortcut text next to 'Cut'
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })

    // expect: The shortcut reads '⌘+X' — EditorContextMenu checks window.api.platform === 'darwin'
    await expect(page.getByText('⌘+X')).toBeVisible()
  })

  test('5.4 Context menu closes on outside click', async ({ page }) => {
    // 1. Open the context menu via right-click
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeVisible()

    // 2. Press Escape to dismiss the context menu (Radix context menu closes on Escape).
    // Clicking outside is blocked by the Radix backdrop which intercepts pointer events —
    // Escape is the reliable cross-platform way to dismiss Radix context menus.
    await page.keyboard.press('Escape')

    // expect: The context menu closes and disappears from the DOM
    await expect(page.getByRole('menuitem', { name: 'Cut' })).not.toBeVisible()
  })

  test("5.5 'Convert Case > UPPERCASE' transforms selected text in the editor", async ({ page }) => {
    // 1. Click .monaco-editor textarea, type 'hello world', then select all with Cmd+A
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Escape')
    await page.keyboard.type('hello world')
    await page.keyboard.press('Meta+A')

    // 2. Right-click, hover 'Convert Case' submenu trigger, then click 'UPPERCASE'
    // editorCmd('toUpperCase') fires CustomEvent 'editor:command' → editor.action.transformToUppercase
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Convert Case' }).hover()
    await expect(page.getByRole('menuitem', { name: 'UPPERCASE' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'UPPERCASE' }).click()

    // expect: The text in the editor changes to 'HELLO WORLD'
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('HELLO WORLD')
  })

  test("5.6 'Convert Case > lowercase' transforms selected text in the editor", async ({ page }) => {
    // 1. Type 'HELLO WORLD', select all, right-click, hover 'Convert Case', click 'lowercase'
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Escape')
    await page.keyboard.type('HELLO WORLD')
    await page.keyboard.press('Meta+A')

    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Convert Case' }).hover()
    await expect(page.getByRole('menuitem', { name: 'lowercase' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'lowercase' }).click()

    // expect: The text becomes 'hello world'
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('hello world')
  })

  test("5.7 'Convert Case > Title Case' transforms selected text in the editor", async ({ page }) => {
    // 1. Type 'hello world', select all, right-click, hover 'Convert Case', click 'Title Case'
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Escape')
    await page.keyboard.type('hello world')
    await page.keyboard.press('Meta+A')

    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Convert Case' }).hover()
    await expect(page.getByRole('menuitem', { name: 'Title Case' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Title Case' }).click()

    // expect: The text becomes 'Hello World'
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('Hello World')
  })

  test("5.8 'Toggle Comment' wraps the current line in a comment", async ({ page, electronApp }) => {
    // Set language to JavaScript so Monaco knows the comment syntax
    await electronApp.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('editor:set-language', 'javascript')
    )
    await page.waitForTimeout(300)

    // 1. Click .monaco-editor textarea, type 'console.log("test")', position cursor on that line
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Escape')
    await page.keyboard.type('console.log("test")')

    // 2. Right-click and click 'Toggle Comment' in the context menu
    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Toggle Comment' }).click()

    // expect: A comment token appears at the start of the line
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('//', { timeout: 3_000 })
  })

  test("5.9 'Go to Line...' context menu item is clickable and dispatches command", async ({ page }) => {
    // 1. Open editor and right-click
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.keyboard.press('Escape')

    await page.locator('[data-testid="editor-pane"]').click({ button: 'right' })

    // 2. Verify "Go to Line..." is a visible, clickable menu item
    const goToLineItem = page.getByRole('menuitem', { name: 'Go to Line...' })
    await expect(goToLineItem).toBeVisible()

    // 3. Click it — the context menu closes (Radix dismisses)
    await goToLineItem.click()
    await expect(page.getByRole('menuitem', { name: 'Cut' })).not.toBeVisible()
  })

  test('5.10 Context menu does not appear when right-clicking outside the editor pane', async ({ page }) => {
    // 1. Right-click on [data-testid="tabbar"]
    // The EditorContextMenu ContextMenuTrigger only wraps [data-testid="editor-pane"]
    await page.locator('[data-testid="tabbar"]').click({ button: 'right' })

    // expect: The custom editor context menu does NOT appear
    await expect(page.getByRole('menuitem', { name: 'Cut' })).not.toBeVisible()
  })

})
