// spec: specs/ui-redesign.md
// seed: tests/seed.spec.ts

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

// IPC helper — sends a channel + args from main process to the renderer
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}

// ─── 1. TopAppBar ─────────────────────────────────────────────────────────────

test.describe('1. TopAppBar', () => {

  // 1.1 TopAppBar renders and is visible on startup
  test('1.1 TopAppBar renders and is visible on startup', async ({ page }) => {
    // Assert [data-testid="topbar"] is visible
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible()

    // Assert the element has height 64 px
    const height = await page.evaluate(() =>
      document.querySelector('[data-testid="topbar"]')!.getBoundingClientRect().height
    )
    expect(height).toBe(64)
  })

  // 1.2 TopAppBar displays brand name 'Notepad & More'
  test('1.2 TopAppBar displays brand name "Notepad & More"', async ({ page }) => {
    // Locate [data-testid="topbar"] and within it find the element containing 'Notepad & More'
    await expect(
      page.locator('[data-testid="topbar"]').getByText('Notepad & More')
    ).toBeVisible()
  })

  // 1.3 TopAppBar brand name has teal accent colour
  test('1.3 TopAppBar brand name has teal accent colour', async ({ page }) => {
    // Query the brandName span inside the topbar and evaluate its computed color
    const color = await page.evaluate(() => {
      const topbar = document.querySelector('[data-testid="topbar"]')!
      // Find the span element (brandName) whose text is exactly 'Notepad & More'
      const el = Array.from(topbar.querySelectorAll('span')).find(
        (n) => n.textContent?.trim() === 'Notepad & More'
      ) as HTMLElement | undefined
      return el ? getComputedStyle(el).color : null
    })
    // Expect teal accent: rgb(104, 229, 203) — allow rgba variant as well
    expect(color).toMatch(/rgba?\(104, 229, 203/)
  })

  // 1.4 TopAppBar has glass-effect background (semi-transparent dark)
  test('1.4 TopAppBar has glass-effect background (semi-transparent)', async ({ page }) => {
    // Evaluate the computed backgroundColor of the topbar
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-testid="topbar"]')!).backgroundColor
    )
    // Expect an rgba value with alpha < 1 (e.g. rgba(15, 15, 15, 0.92))
    expect(bg).toMatch(/rgba\(/)
    const alphaMatch = bg.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/)
    expect(alphaMatch).not.toBeNull()
    const alpha = parseFloat(alphaMatch![1])
    expect(alpha).toBeLessThan(1)
  })

  // 1.5 TopAppBar New button click creates a new untitled tab
  test('1.5 TopAppBar New button click creates a new untitled tab', async ({ page }) => {
    // Count current tabs
    const before = await page.locator('[data-tab-title]').count()

    // Click the 'New' icon button (first button in the topbar)
    await page.locator('[data-testid="topbar"] button').first().click()

    // Assert new tab appeared
    await expect(page.locator('[data-tab-title]')).toHaveCount(before + 1)
  })

  // 1.6 TopAppBar Save button click is wired (no crash on clean buffer)
  test('1.6 TopAppBar Save button click is wired without crashing', async ({ page }) => {
    // Dismiss any dialog that might appear (Save As for untitled) and just check the app survives
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    // Click Save (third button in topbar — New, Open, Save)
    await page.locator('[data-testid="topbar"] button').nth(2).click()
    await page.waitForTimeout(500)

    // No JS errors and app is still visible
    expect(errors).toHaveLength(0)
    await expect(page.locator('[data-testid="app"]')).toBeVisible()
  })

  // 1.7 TopAppBar Close button closes the active tab
  test('1.7 TopAppBar Close button closes the active tab', async ({ electronApp, page }) => {
    // Ensure at least two tabs — send IPC to create a new file
    await sendIPC(electronApp, 'menu:file-new')
    await page.waitForTimeout(300)

    // Record the current active tab title
    const activeTitle = await page.evaluate(() => {
      const el = document.querySelector('[data-tab-title][data-active="true"]') as HTMLElement | null
      return el?.getAttribute('data-tab-title') ?? null
    })

    // Click the Close (X) icon button — last button in the topbar
    const buttons = page.locator('[data-testid="topbar"] button')
    const count = await buttons.count()
    await buttons.nth(count - 1).click()
    await page.waitForTimeout(300)

    // Assert the previously active tab title is no longer present
    if (activeTitle) {
      await expect(page.locator(`[data-tab-title="${activeTitle}"]`)).not.toBeVisible()
    }
    await expect(page.locator('[data-testid="app"]')).toBeVisible()
  })

  // 1.8 TopAppBar quick search input accepts text and pressing Enter triggers Find
  test('1.8 TopAppBar quick search input accepts text; Enter opens Find dialog', async ({ page }) => {
    // Locate the search input inside the topbar
    const input = page.locator('[data-testid="topbar"] input[placeholder="Quick search..."]')

    // Click the input to focus it
    await input.click()
    await expect(input).toBeFocused()

    // Type the text 'hello'
    await input.type('hello')
    await expect(input).toHaveValue('hello')

    // Press Enter — openFind('find') callback should fire
    await input.press('Enter')
    await page.waitForTimeout(300)

    // The find dialog should be visible (FindReplaceDialog) — locate by its title text
    await expect(page.getByText('Find & Replace').first()).toBeVisible({ timeout: 2_000 })
  })

  // 1.9 TopAppBar quick search Escape blurs the input without opening Find
  test('1.9 TopAppBar quick search Escape blurs input without opening Find', async ({ page }) => {
    const input = page.locator('[data-testid="topbar"] input[placeholder="Quick search..."]')

    // Click the input, type 'abc', then press Escape
    await input.click()
    await input.type('abc')
    await input.press('Escape')
    await page.waitForTimeout(300)

    // Input should not be focused
    await expect(input).not.toBeFocused()

    // Find dialog should NOT be visible
    await expect(page.locator('[data-testid="find-replace-dialog"]')).not.toBeVisible()
  })

  // 1.10 TopAppBar is hidden when toolbar is toggled off via IPC
  test('1.10 TopAppBar is hidden when toolbar is toggled off via IPC', async ({ electronApp, page }) => {
    // Assert topbar is visible initially
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible()

    // Send IPC to hide toolbar
    await sendIPC(electronApp, 'ui:toggle-toolbar', false)
    await page.locator('[data-testid="topbar"]').waitFor({ state: 'hidden', timeout: 2_000 })

    // Assert topbar is no longer visible
    await expect(page.locator('[data-testid="topbar"]')).not.toBeVisible()

    // Restore toolbar
    await sendIPC(electronApp, 'ui:toggle-toolbar', true)
    await page.locator('[data-testid="topbar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible()
  })

})

// ─── 2. SideNav ──────────────────────────────────────────────────────────────

test.describe('2. SideNav', () => {

  // 2.1 SideNav renders and is exactly 80 px wide
  test('2.1 SideNav renders and is exactly 80 px wide', async ({ page }) => {
    // Assert sidenav is visible
    await expect(page.locator('[data-testid="sidenav"]')).toBeVisible()

    // Evaluate its width
    const width = await page.evaluate(() =>
      document.querySelector('[data-testid="sidenav"]')!.getBoundingClientRect().width
    )
    expect(width).toBe(80)
  })

  // 2.2 SideNav logo icon is rendered at the top
  test('2.2 SideNav logo icon is rendered at the top', async ({ page }) => {
    // Within sidenav, assert an SVG element is present (the Feather icon logo)
    await expect(
      page.locator('[data-testid="sidenav"] svg').first()
    ).toBeVisible()
  })

  // 2.3 SideNav renders all 6 nav item labels
  test('2.3 SideNav renders all 6 nav item labels', async ({ page }) => {
    const sidenav = page.locator('[data-testid="sidenav"]')

    // All 6 nav item labels must be visible
    await expect(sidenav.getByText('Files', { exact: true })).toBeVisible()
    await expect(sidenav.getByText('Search', { exact: true })).toBeVisible()
    await expect(sidenav.getByText('View', { exact: true })).toBeVisible()
    await expect(sidenav.getByText('Symbols', { exact: true })).toBeVisible()
    await expect(sidenav.getByText('Tools', { exact: true })).toBeVisible()
    await expect(sidenav.getByText('Plugins', { exact: true })).toBeVisible()
  })

  // 2.4 SideNav renders Undo and Redo buttons at the bottom
  test('2.4 SideNav renders Undo and Redo buttons at the bottom', async ({ page }) => {
    // Locate the bottom-actions section and count its buttons
    const bottomButtons = page.locator('[data-testid="sidenav"] .bottomActions button')
    // Fall back: count via evaluate if CSS module hashes the class
    const count = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      // The bottom actions div is the last direct child of the sidenav
      const children = Array.from(sidenav.children)
      const bottomDiv = children[children.length - 1] as HTMLElement
      return bottomDiv.querySelectorAll('button').length
    })
    expect(count).toBe(2)
  })

  // 2.5 SideNav Files button opens the Sidebar with 'File Browser' panel
  test('2.5 SideNav Files button opens Sidebar with File Browser panel', async ({ page }) => {
    // Assert sidebar is not visible initially
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()

    // Click the 'Files' button inside sidenav
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()

    // Wait for sidebar to appear
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // The sidebar header should contain 'FILE BROWSER' (text-transform: uppercase applied to 'File Browser')
    await expect(
      page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /file browser/i }).first()
    ).toBeVisible()
  })

  // 2.6 SideNav Files button is active (teal border) when Sidebar is open on Files panel
  test('2.6 SideNav Files button shows teal active indicator when sidebar is open', async ({ page }) => {
    // Click Files to open sidebar
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    // Wait a tick for React to apply active CSS class
    await page.waitForTimeout(200)

    // Evaluate the border-left-color of the active Files button
    const borderColor = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      // Find all nav buttons (excluding the bottom-actions)
      const navDiv = sidenav.children[1] as HTMLElement // navList is 2nd child (after logo)
      // The Files button is the first button in the navList
      const allBtns = Array.from(navDiv.querySelectorAll('button')) as HTMLElement[]
      const filesBtn = allBtns[0] ?? null
      return filesBtn ? getComputedStyle(filesBtn).borderLeftColor : null
    })
    // The active teal left border: rgb(104, 229, 203) — allow rgba variant
    expect(borderColor).toMatch(/rgba?\(104, 229, 203/)
  })

  // 2.7 SideNav Files button toggles Sidebar closed on second click
  test('2.7 SideNav Files button toggles Sidebar closed on second click', async ({ page }) => {
    // First click: open sidebar
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Second click: close sidebar
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // 2.8 SideNav Symbols button switches Sidebar to Symbols panel
  test('2.8 SideNav Symbols button switches Sidebar to Symbols panel', async ({ page }) => {
    // Open Files panel first
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Click Symbols nav button
    await page.locator('[data-testid="sidenav"]').getByText('Symbols', { exact: true }).click()
    await page.waitForTimeout(300)

    // Sidebar header should show 'SYMBOLS' (text-transform: uppercase applied to 'Symbols')
    await expect(
      page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /symbols/i }).first()
    ).toBeVisible()

    // Verify Symbols button is active by evaluating its border-left-color
    const symbolsActive = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const navDiv = sidenav.children[1] as HTMLElement
      const buttons = navDiv.querySelectorAll('button')
      // Symbols is the 4th nav item (index 3): Files, Search, View, Symbols
      const symbolsBtn = buttons[3] as HTMLElement | null
      return symbolsBtn ? getComputedStyle(symbolsBtn).borderLeftColor : null
    })
    expect(symbolsActive).toBe('rgb(104, 229, 203)')

    // Files button should not be active
    const filesInactive = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const navDiv = sidenav.children[1] as HTMLElement
      const filesBtn = navDiv.querySelector('button') as HTMLElement | null
      return filesBtn ? getComputedStyle(filesBtn).borderLeftColor : null
    })
    expect(filesInactive).not.toBe('rgb(104, 229, 203)')
  })

  // 2.9 SideNav Search button opens the Find/Replace dialog
  test('2.9 SideNav Search button opens Find/Replace dialog', async ({ page }) => {
    // Click the 'Search' button in sidenav
    await page.locator('[data-testid="sidenav"]').getByText('Search', { exact: true }).click()
    await page.waitForTimeout(300)

    // Find/Replace dialog should be visible — locate by its title text
    await expect(page.getByText('Find & Replace').first()).toBeVisible({ timeout: 2_000 })
  })

  // 2.10 SideNav Tools button opens the Preferences dialog
  test('2.10 SideNav Tools button opens Preferences dialog', async ({ page }) => {
    // Click 'Tools' button in sidenav
    await page.locator('[data-testid="sidenav"]').getByText('Tools', { exact: true }).click()
    await page.waitForTimeout(300)

    // Preferences dialog should be visible — locate by its title text
    await expect(
      page.getByText('Preferences').first()
    ).toBeVisible({ timeout: 2_000 })
  })

  // 2.11 SideNav Plugins button opens the Plugin Manager dialog
  test('2.11 SideNav Plugins button opens Plugin Manager dialog', async ({ page }) => {
    // Click 'Plugins' button in sidenav
    await page.locator('[data-testid="sidenav"]').getByText('Plugins', { exact: true }).click()
    await page.waitForTimeout(300)

    // Plugin Manager dialog should be visible
    await expect(
      page.locator('[data-testid="plugin-manager-dialog"]')
    ).toBeVisible({ timeout: 2_000 })
  })

  // 2.12 SideNav Undo button dispatches editor:undo custom event
  test('2.12 SideNav Undo button dispatches editor:undo custom event', async ({ page }) => {
    // Attach a listener for 'editor:undo'
    await page.evaluate(() => {
      (window as any)._undoFired = false
      window.addEventListener('editor:undo', () => { (window as any)._undoFired = true })
    })

    // Click the Undo button (first button in the bottom-actions)
    await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const children = Array.from(sidenav.children)
      const bottomDiv = children[children.length - 1] as HTMLElement
      const undoBtn = bottomDiv.querySelector('button') as HTMLButtonElement | null
      undoBtn?.click()
    })
    await page.waitForTimeout(100)

    // Evaluate whether the event fired
    const fired = await page.evaluate(() => (window as any)._undoFired)
    expect(fired).toBe(true)
  })

  // 2.13 SideNav Redo button dispatches editor:redo custom event
  test('2.13 SideNav Redo button dispatches editor:redo custom event', async ({ page }) => {
    // Attach a listener for 'editor:redo'
    await page.evaluate(() => {
      (window as any)._redoFired = false
      window.addEventListener('editor:redo', () => { (window as any)._redoFired = true })
    })

    // Click the Redo button (second button in the bottom-actions)
    await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const children = Array.from(sidenav.children)
      const bottomDiv = children[children.length - 1] as HTMLElement
      const buttons = bottomDiv.querySelectorAll('button')
      const redoBtn = buttons[1] as HTMLButtonElement | null
      redoBtn?.click()
    })
    await page.waitForTimeout(100)

    // Evaluate whether the event fired
    const fired = await page.evaluate(() => (window as any)._redoFired)
    expect(fired).toBe(true)
  })

})

// ─── 3. Tooltip Component ─────────────────────────────────────────────────────

test.describe('3. Tooltip Component', () => {

  // 3.1 Tooltip does not appear immediately on hover (300 ms delay)
  test('3.1 Tooltip does not appear immediately on hover (300 ms delay)', async ({ page }) => {
    // Hover over the 'Files' nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).hover()

    // Immediately assert no tooltip text visible
    const tooltipVisible = await page.evaluate(() =>
      document.body.innerText.includes('File Browser')
    )
    expect(tooltipVisible).toBe(false)

    // Wait 400 ms for tooltip to appear
    await page.waitForTimeout(400)

    // Now the tooltip should be present (position:fixed is set via CSS class, check computed style)
    const tooltipAfter = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.includes('File Browser') &&
          (getComputedStyle(el as HTMLElement).position === 'fixed' || (el as HTMLElement).style.position === 'fixed')
      )
    )
    expect(tooltipAfter).toBe(true)
  })

  // 3.2 Tooltip disappears when the cursor leaves the trigger element
  test('3.2 Tooltip disappears when cursor leaves the trigger', async ({ page }) => {
    // Hover over Files button and wait for tooltip
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).hover()
    await page.waitForTimeout(400)

    // Confirm tooltip is present
    const before = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'File Browser'
      )
    )
    expect(before).toBe(true)

    // Move cursor away to the app root
    await page.locator('[data-testid="app"]').hover()
    await page.waitForTimeout(100)

    // Tooltip should be gone
    const after = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'File Browser'
      )
    )
    expect(after).toBe(false)
  })

  // 3.3 Tooltip text is correct for each SideNav item (spot-check)
  test('3.3 Tooltip text is correct for each SideNav item', async ({ page }) => {
    const checks: Array<{ label: string; tip: string }> = [
      { label: 'Files',   tip: 'File Browser' },
      { label: 'Search',  tip: 'Find & Replace (Ctrl+F)' },
      { label: 'View',    tip: 'Document Map' },
      { label: 'Symbols', tip: 'Function List' },
      { label: 'Tools',   tip: 'Preferences' },
      { label: 'Plugins', tip: 'Plugin Manager' },
    ]

    for (const { label, tip } of checks) {
      // Hover over each nav item
      await page.locator('[data-testid="sidenav"]').getByText(label, { exact: true }).hover()
      await page.waitForTimeout(400)

      // Assert tooltip text is present in body
      const found = await page.evaluate((text) =>
        !!Array.from(document.body.children).find(
          (el) => el.textContent?.trim() === text
        ),
        tip
      )
      expect(found, `Tooltip for ${label} should show "${tip}"`).toBe(true)

      // Move away to reset
      await page.locator('[data-testid="app"]').hover()
      await page.waitForTimeout(150)
    }
  })

  // 3.4 SideNav tooltips render to the right side of the trigger
  test('3.4 SideNav tooltips render to the right of the trigger button', async ({ page }) => {
    // Hover over Files nav button and wait for tooltip
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).hover()
    await page.waitForTimeout(400)

    // Get tooltip and button bounding rects
    const rects = await page.evaluate(() => {
      const tooltipEl = Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'File Browser'
      ) as HTMLElement | undefined
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const navDiv = sidenav.children[1] as HTMLElement
      const filesBtn = navDiv.querySelector('button') as HTMLElement | null
      if (!tooltipEl || !filesBtn) return null
      return {
        tooltipLeft: tooltipEl.getBoundingClientRect().left,
        buttonRight: filesBtn.getBoundingClientRect().right,
      }
    })
    expect(rects).not.toBeNull()
    // Tooltip left edge should be >= button right edge (tooltip is to the right)
    expect(rects!.tooltipLeft).toBeGreaterThanOrEqual(rects!.buttonRight)
  })

  // 3.5 TopAppBar tooltips render below the trigger (default 'bottom' side)
  test('3.5 TopAppBar tooltips render below the trigger button', async ({ page }) => {
    // Hover over the first icon button in the topbar (New/FilePlus)
    await page.locator('[data-testid="topbar"] button').first().hover()
    await page.waitForTimeout(400)

    // Get tooltip and button bounding rects
    const rects = await page.evaluate(() => {
      // Find the tooltip portal element (fixed-positioned via CSS class)
      const tooltipEl = Array.from(document.body.children).find(
        (el) => getComputedStyle(el as HTMLElement).position === 'fixed' && el.textContent?.trim().length! > 0
      ) as HTMLElement | undefined
      const topbar = document.querySelector('[data-testid="topbar"]')!
      // Get the first button in topbar (CSS modules hashes class names)
      const firstBtn = topbar.querySelector('button') as HTMLElement | null
      if (!tooltipEl || !firstBtn) return null
      return {
        tooltipTop: tooltipEl.getBoundingClientRect().top,
        buttonBottom: firstBtn.getBoundingClientRect().bottom,
      }
    })
    // If rects is null, just check that a tooltip is present
    if (rects === null) {
      const tooltipPresent = await page.evaluate(() =>
        !!Array.from(document.body.children).find(
          (el) => getComputedStyle(el as HTMLElement).position === 'fixed' && el.textContent?.trim().length! > 0
        )
      )
      expect(tooltipPresent).toBe(true)
    } else {
      expect(rects.tooltipTop).toBeGreaterThanOrEqual(rects.buttonBottom)
    }
  })

  // 3.6 TopAppBar New button tooltip shows 'New (Ctrl+N)'
  test('3.6 TopAppBar New button tooltip shows "New (Ctrl+N)"', async ({ page }) => {
    // Hover over the first button in topbar's actions area
    const buttons = page.locator('[data-testid="topbar"] button')
    await buttons.first().hover()
    await page.waitForTimeout(400)

    // Assert tooltip text 'New (Ctrl+N)' is present in the document
    const found = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'New (Ctrl+N)'
      )
    )
    expect(found).toBe(true)
  })

  // 3.7 TopAppBar Save button tooltip shows 'Save (Ctrl+S)'
  test('3.7 TopAppBar Save button tooltip shows "Save (Ctrl+S)"', async ({ page }) => {
    // Hover over the third button in topbar actions (New=1st, Open=2nd, Save=3rd)
    const buttons = page.locator('[data-testid="topbar"] button')
    await buttons.nth(2).hover()
    await page.waitForTimeout(400)

    // Assert tooltip text 'Save (Ctrl+S)' is present
    const found = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'Save (Ctrl+S)'
      )
    )
    expect(found).toBe(true)
  })

  // 3.8 Sidebar Close button tooltip shows 'Close Sidebar'
  test('3.8 Sidebar Close button tooltip shows "Close Sidebar"', async ({ page }) => {
    // Open the sidebar via Files nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Hover over the close button (✕) in sidebar header
    await page.locator('[data-testid="sidebar"] button').filter({ hasText: '✕' }).hover()
    await page.waitForTimeout(400)

    // Assert tooltip text 'Close Sidebar' appears in document body
    const found = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'Close Sidebar'
      )
    )
    expect(found).toBe(true)
  })

  // 3.9 Tooltip timer is cancelled if cursor leaves before 300 ms
  test('3.9 Tooltip timer is cancelled if cursor leaves before 300 ms', async ({ page }) => {
    // Hover over Files nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).hover()

    // Move away quickly (within 100 ms)
    await page.waitForTimeout(100)
    await page.locator('[data-testid="app"]').hover()

    // Wait additional 400 ms
    await page.waitForTimeout(400)

    // No tooltip should be present
    const found = await page.evaluate(() =>
      !!Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'File Browser'
      )
    )
    expect(found).toBe(false)
  })

  // 3.10 Tooltip renders as a portal into document.body (not inside sidenav DOM subtree)
  test('3.10 Tooltip renders as a portal into document.body, not inside sidenav', async ({ page }) => {
    // Hover over Files nav button and wait for tooltip
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).hover()
    await page.waitForTimeout(400)

    // Check that the tooltip is a direct child of document.body, NOT inside sidenav
    const isPortal = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      const tooltipEl = Array.from(document.body.children).find(
        (el) => el.textContent?.trim() === 'File Browser'
      ) as HTMLElement | undefined
      if (!tooltipEl) return null
      // Check it is a direct child of body
      const isDirectBodyChild = tooltipEl.parentElement === document.body
      // Check it is NOT inside the sidenav subtree
      const isInsideSidenav = sidenav.contains(tooltipEl)
      return { isDirectBodyChild, isInsideSidenav }
    })

    expect(isPortal).not.toBeNull()
    expect(isPortal!.isDirectBodyChild).toBe(true)
    expect(isPortal!.isInsideSidenav).toBe(false)
  })

})

// ─── 4. Sidebar ───────────────────────────────────────────────────────────────

test.describe('4. Sidebar', () => {

  // 4.1 Sidebar is hidden on fresh app startup
  test('4.1 Sidebar is hidden on fresh app startup', async ({ page }) => {
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // 4.2 Sidebar header title is uppercase and uses teal accent colour
  test('4.2 Sidebar header title is uppercase and uses teal accent colour', async ({ page }) => {
    // Open sidebar via Files nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Locate the header title element
    const titleEl = page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /file browser/i }).first()
    await expect(titleEl).toBeVisible()

    // Check text content is 'File Browser' (CSS text-transform uppercase makes it appear uppercase)
    const textContent = await titleEl.textContent()
    expect(textContent?.toLowerCase()).toContain('file browser')

    // Check computed color is teal accent
    const color = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="sidebar"]')!
      // Find the header title — first span inside the header div
      const header = sidebar.querySelector('[class*="header"]') as HTMLElement | null
      const titleSpan = header?.querySelector('[class*="headerTitle"]') as HTMLElement | null
      return titleSpan ? getComputedStyle(titleSpan).color : null
    })
    expect(color).toBe('rgb(104, 229, 203)')
  })

  // 4.3 Sidebar close button hides the sidebar
  test('4.3 Sidebar close button hides the sidebar', async ({ page }) => {
    // Open sidebar via Files nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Click the close button (✕) in sidebar header
    await page.locator('[data-testid="sidebar"] button').filter({ hasText: '✕' }).click()

    // Assert sidebar is no longer visible
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

  // 4.4 Sidebar switches from Files to Symbols panel when Symbols nav item is clicked
  test('4.4 Sidebar switches to Symbols panel when Symbols nav item is clicked', async ({ page }) => {
    // Open Files panel
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Header should show File Browser
    await expect(
      page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /file browser/i }).first()
    ).toBeVisible()

    // Click Symbols in sidenav
    await page.locator('[data-testid="sidenav"]').getByText('Symbols', { exact: true }).click()
    await page.waitForTimeout(300)

    // Header should now show Symbols
    await expect(
      page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /symbols/i }).first()
    ).toBeVisible()
  })

  // 4.5 Sidebar switches from Files to Document Map (View) panel
  test('4.5 Sidebar switches to Document Map panel when View nav item is clicked', async ({ page }) => {
    // Open Files panel
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Click View in sidenav
    await page.locator('[data-testid="sidenav"]').getByText('View', { exact: true }).click()
    await page.waitForTimeout(300)

    // Header should show Document Map
    await expect(
      page.locator('[data-testid="sidebar"]').locator('*').filter({ hasText: /document map/i }).first()
    ).toBeVisible()
  })

  // 4.6 Sidebar is resizable via drag handle
  test('4.6 Sidebar is resizable via drag handle', async ({ page }) => {
    // Open sidebar
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })

    // Record the initial width of [data-testid="sidebar"]
    const initialWidth = await page.evaluate(() =>
      document.querySelector('[data-testid="sidebar"]')!.getBoundingClientRect().width
    )

    // Find the resize handle (PanelResizeHandle between sidebar and editor)
    // react-resizable-panels uses data-resize-handle-active on the handle element
    const resizeHandle = page.locator('[data-panel-resize-handle-id]').first()
    await expect(resizeHandle).toBeVisible({ timeout: 2_000 })

    // Get its bounding rect and drag to expand the sidebar
    // Note: in this layout, dragging the handle right SHRINKS the sidebar panel;
    // drag LEFT to expand sidebar. We test that width changes significantly either way.
    const handleBox = await resizeHandle.boundingBox()
    if (handleBox) {
      const cx = handleBox.x + handleBox.width / 2
      const cy = handleBox.y + handleBox.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      // Drag left (negative x) to expand the sidebar
      await page.mouse.move(cx - 60, cy, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(200)

      const newWidth = await page.evaluate(() =>
        document.querySelector('[data-testid="sidebar"]')!.getBoundingClientRect().width
      )
      expect(newWidth).toBeGreaterThan(initialWidth + 20)
    }
  })

  // 4.7 Sidebar does not render when showSidebar is toggled off via IPC
  test('4.7 Sidebar is hidden when toggled off via IPC', async ({ electronApp, page }) => {
    // Open sidebar via Files nav button
    await page.locator('[data-testid="sidenav"]').getByText('Files', { exact: true }).click()
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

    // Send IPC to hide sidebar
    await sendIPC(electronApp, 'ui:toggle-sidebar', false)
    await page.locator('[data-testid="sidebar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible()
  })

})

// ─── 5. StatusBar ─────────────────────────────────────────────────────────────

test.describe('5. StatusBar', () => {

  // 5.1 StatusBar renders and is visible on startup
  test('5.1 StatusBar renders and is visible on startup', async ({ page }) => {
    await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()
  })

  // 5.2 StatusBar has 32 px height
  test('5.2 StatusBar has 32 px height', async ({ page }) => {
    const height = await page.evaluate(() =>
      document.querySelector('[data-testid="statusbar"]')!.getBoundingClientRect().height
    )
    expect(height).toBe(32)
  })

  // 5.3 StatusBar background is dark (not blue)
  test('5.3 StatusBar background is dark (#0e0e0e), not blue', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-testid="statusbar"]')!).backgroundColor
    )
    // Expected: rgb(14, 14, 14) = #0e0e0e
    expect(bg).toBe('rgb(14, 14, 14)')
  })

  // 5.4 StatusBar status dot is visible and has teal accent colour
  test('5.4 StatusBar status dot is visible and has teal accent colour', async ({ page }) => {
    // Locate the status dot element via evaluate (CSS module hashes the class)
    const result = await page.evaluate(() => {
      const statusbar = document.querySelector('[data-testid="statusbar"]')!
      // The dot is the first span child
      const dot = statusbar.querySelector('span') as HTMLElement | null
      if (!dot) return null
      const style = getComputedStyle(dot)
      return {
        bg: style.backgroundColor,
        width: dot.getBoundingClientRect().width,
        height: dot.getBoundingClientRect().height,
      }
    })
    expect(result).not.toBeNull()
    // Teal accent: rgb(104, 229, 203)
    expect(result!.bg).toBe('rgb(104, 229, 203)')
    // Must be visible (non-zero size)
    expect(result!.width).toBeGreaterThan(0)
    expect(result!.height).toBeGreaterThan(0)
  })

  // 5.5 StatusBar cursor position shows 'Ln 1, Col 1' on fresh buffer
  test('5.5 StatusBar cursor position shows "Ln 1, Col 1" on fresh buffer', async ({ page }) => {
    await expect(page.locator('[data-testid="cursor-position"]')).toContainText('Ln 1, Col 1')
  })

  // 5.6 StatusBar cursor position updates when typing in the editor
  test('5.6 StatusBar cursor position updates when typing in the editor', async ({ page }) => {
    // Click Monaco editor textarea to focus
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.waitForTimeout(200)

    // Press Escape to dismiss any IntelliSense popup
    await page.keyboard.press('Escape')

    // Type 'Hello' then newline then 'World'
    await page.keyboard.type('Hello')
    await page.keyboard.press('Enter')
    await page.keyboard.type('World')
    await page.waitForTimeout(300)

    // Cursor position should be Ln 2, Col 6
    await expect(page.locator('[data-testid="cursor-position"]')).toContainText('Ln 2, Col 6')
  })

  // 5.7 StatusBar EOL indicator shows 'LF' by default
  test('5.7 StatusBar EOL indicator shows "LF" by default', async ({ page }) => {
    // The EOL indicator text is a clickable span in the statusbar
    await expect(page.locator('[data-testid="statusbar"]')).toContainText('LF')
  })

  // 5.8 StatusBar EOL cycles from LF to CRLF on click
  test('5.8 StatusBar EOL cycles from LF to CRLF on click', async ({ page }) => {
    // Locate the EOL span by its title attribute
    const eolSpan = page.locator('[data-testid="statusbar"] span[title="Click to cycle EOL type"]')
    await expect(eolSpan).toContainText('LF')

    // Click to cycle
    await eolSpan.click()
    await page.waitForTimeout(200)

    // Should now show CRLF
    await expect(eolSpan).toContainText('CRLF')
  })

  // 5.9 StatusBar encoding shows 'UTF-8' by default
  test('5.9 StatusBar encoding shows "UTF-8" by default', async ({ page }) => {
    await expect(page.locator('[data-testid="statusbar"]')).toContainText('UTF-8')
  })

  // 5.10 StatusBar encoding cycles on click
  test('5.10 StatusBar encoding cycles on click', async ({ page }) => {
    // Locate the encoding span by its title attribute
    const encodingSpan = page.locator('[data-testid="statusbar"] span[title="Click to cycle encoding"]')
    await expect(encodingSpan).toContainText('UTF-8')

    // First click: UTF-8 → UTF-8 BOM
    await encodingSpan.click()
    await page.waitForTimeout(200)
    await expect(encodingSpan).toContainText('UTF-8 BOM')

    // Second click: UTF-8 BOM → UTF-16 LE
    await encodingSpan.click()
    await page.waitForTimeout(200)
    await expect(encodingSpan).toContainText('UTF-16 LE')
  })

  // 5.11 StatusBar language shows 'plaintext' for a new untitled buffer
  test('5.11 StatusBar language shows "Plain Text" for a new untitled buffer', async ({ page }) => {
    // New buffers use 'plaintext' (Monaco language id) — the StatusBar shows buf.language directly
    await expect(page.locator('[data-testid="statusbar"]')).toContainText('plaintext')
  })

  // 5.12 StatusBar dirty state shows 'New File' for an unsaved untitled buffer
  test('5.12 StatusBar shows "New File" for an unsaved untitled buffer', async ({ page }) => {
    await expect(page.locator('[data-testid="statusbar"]')).toContainText('New File')
  })

  // 5.13 StatusBar dirty state shows 'Modified' after typing in the editor
  test('5.13 StatusBar shows "Modified" after typing in the editor', async ({ page }) => {
    // Click the Monaco editor textarea and type 'x'
    await page.locator('.monaco-editor textarea').first().click({ force: true })
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.keyboard.type('x')
    await page.waitForTimeout(300)

    // StatusBar should now show 'Modified'
    await expect(page.locator('[data-testid="statusbar"]')).toContainText('Modified')
  })

  // 5.14 StatusBar is hidden when toggled off via IPC
  test('5.14 StatusBar is hidden when toggled off via IPC', async ({ electronApp, page }) => {
    // Assert statusbar is visible initially
    await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()

    // Send IPC to hide statusbar
    await sendIPC(electronApp, 'ui:toggle-statusbar', false)
    await page.locator('[data-testid="statusbar"]').waitFor({ state: 'hidden', timeout: 2_000 })
    await expect(page.locator('[data-testid="statusbar"]')).not.toBeVisible()

    // Restore statusbar
    await sendIPC(electronApp, 'ui:toggle-statusbar', true)
    await page.locator('[data-testid="statusbar"]').waitFor({ state: 'visible', timeout: 2_000 })
    await expect(page.locator('[data-testid="statusbar"]')).toBeVisible()
  })

})

// ─── 6. MD3 Teal CSS Variable Palette ────────────────────────────────────────

test.describe('6. MD3 Teal CSS Variable Palette', () => {

  // 6.1 Root CSS variable --bg resolves to #131313 in dark theme
  test('6.1 --bg CSS variable resolves to #131313 in dark theme', async ({ page }) => {
    const value = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    )
    expect(value).toBe('#131313')
  })

  // 6.2 Root CSS variable --accent resolves to #68e5cb in dark theme
  test('6.2 --accent CSS variable resolves to #68e5cb in dark theme', async ({ page }) => {
    const value = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )
    expect(value).toBe('#68e5cb')
  })

  // 6.3 App root background uses --bg token (#131313)
  test('6.3 App root background uses --bg token (rgb(19, 19, 19))', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-testid="app"]')!).backgroundColor
    )
    // rgb(19, 19, 19) = #131313
    expect(bg).toBe('rgb(19, 19, 19)')
  })

  // 6.4 Light theme switches --bg and --accent tokens via data-theme attribute
  test('6.4 Light theme switches --bg and --accent tokens via IPC', async ({ electronApp, page }) => {
    // Send IPC to switch to light theme
    await sendIPC(electronApp, 'ui:toggle-theme')
    await page.waitForTimeout(300)

    // Evaluate --bg token in light theme
    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    )
    expect(lightBg).toBe('#f5f5f0')

    // Evaluate --accent token in light theme
    const lightAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )
    expect(lightAccent).toBe('#006b5b')

    // Restore dark theme
    await sendIPC(electronApp, 'ui:toggle-theme')
    await page.waitForTimeout(300)

    // Verify tokens reverted
    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    )
    expect(darkBg).toBe('#131313')

    const darkAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    )
    expect(darkAccent).toBe('#68e5cb')
  })

  // 6.5 SideNav background uses --sidenav-bg token (darker than app bg)
  test('6.5 SideNav background is darker than app bg (#0e0e0e)', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-testid="sidenav"]')!).backgroundColor
    )
    // rgb(14, 14, 14) = #0e0e0e
    expect(bg).toBe('rgb(14, 14, 14)')
  })

  // 6.6 StatusBar background uses --statusbar-bg token, matching SideNav bg (dark, not blue)
  test('6.6 StatusBar background uses --statusbar-bg token (#0e0e0e), not blue', async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('[data-testid="statusbar"]')!).backgroundColor
    )
    // rgb(14, 14, 14) = #0e0e0e
    expect(bg).toBe('rgb(14, 14, 14)')
  })

  // 6.7 Input focus border uses --accent (teal) token
  test('6.7 Search input wrapper border uses teal accent on focus', async ({ page }) => {
    // Click the quick search input to focus it
    const input = page.locator('[data-testid="topbar"] input[placeholder="Quick search..."]')
    await input.click()
    await page.waitForTimeout(200)

    // Evaluate the border color of the wrapper (.searchInput div)
    const borderColor = await page.evaluate(() => {
      const topbar = document.querySelector('[data-testid="topbar"]')!
      const inputEl = topbar.querySelector('input') as HTMLInputElement | null
      const wrapper = inputEl?.parentElement as HTMLElement | null
      return wrapper ? getComputedStyle(wrapper).borderColor : null
    })
    // Teal accent on focus: rgb(104, 229, 203) — allow rgba variant
    expect(borderColor).toMatch(/rgba?\(104, 229, 203/)
  })

  // 6.8 SideNav logo icon uses teal gradient background
  test('6.8 SideNav logo icon uses teal gradient background', async ({ page }) => {
    // Evaluate the backgroundImage of the logo icon div inside sidenav
    const bgImage = await page.evaluate(() => {
      const sidenav = document.querySelector('[data-testid="sidenav"]')!
      // The logo is the first child; logoIcon is the first child of logo
      const logo = sidenav.children[0] as HTMLElement
      const logoIcon = logo?.children[0] as HTMLElement | undefined
      return logoIcon ? getComputedStyle(logoIcon).backgroundImage : null
    })
    // Should contain a linear-gradient with teal accent values
    expect(bgImage).not.toBeNull()
    expect(bgImage).toMatch(/linear-gradient/)
    // Should contain teal-ish color values (68e5cb or 104, 229, 203 or 48c9b0)
    expect(bgImage).toMatch(/e5|229|c9b|68e|48c/i)
  })

})
