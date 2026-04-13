import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'

/**
 * Wraps electron-updater autoUpdater and forwards events to the renderer via IPC.
 *
 * Behavior:
 * - Silent auto-download on detection (autoDownload: true).
 * - Explicit restart required on install (autoInstallOnAppQuit: false) — users see
 *   a persistent toast with a "Restart now" action.
 * - No-op when the app is unpackaged or running under E2E_TEST.
 * - Tracks whether the last check was user-initiated (manual=true) so the renderer
 *   can suppress "no update" / error toasts on silent startup checks.
 */
export class UpdateManager {
  private win: BrowserWindow
  private manualCheckInFlight = false
  private readonly enabled: boolean

  constructor(win: BrowserWindow) {
    this.win = win
    this.enabled = app.isPackaged && process.env['E2E_TEST'] !== '1'

    if (!this.enabled) return

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = null

    this.wireEvents()
  }

  private send(channel: string, payload?: unknown): void {
    if (this.win.isDestroyed()) return
    this.win.webContents.send(channel, payload)
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.send('update:checking', { manual: this.manualCheckInFlight })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.send('update:available', { version: info.version, manual: this.manualCheckInFlight })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.send('update:not-available', { version: info.version, manual: this.manualCheckInFlight })
      this.manualCheckInFlight = false
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.send('update:downloading', { percent: progress.percent })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.send('update:downloaded', { version: info.version })
      this.manualCheckInFlight = false
    })

    autoUpdater.on('error', (err: Error) => {
      this.send('update:error', { message: err.message, manual: this.manualCheckInFlight })
      this.manualCheckInFlight = false
    })
  }

  /**
   * Trigger an update check. `manual=true` means the user initiated via the
   * Help menu — renderer should show feedback toasts. `manual=false` is the
   * silent startup check — errors and "no update" are suppressed.
   */
  async checkForUpdates(manual: boolean): Promise<void> {
    if (!this.enabled) return
    this.manualCheckInFlight = manual
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // The 'error' event will fire too; swallow here to avoid unhandled rejection.
      this.manualCheckInFlight = false
      void err
    }
  }

  /**
   * Quit and install the downloaded update. Caller must ensure the download
   * has completed (i.e., 'update:downloaded' event was received).
   */
  quitAndInstall(): void {
    if (!this.enabled) return
    autoUpdater.quitAndInstall()
  }
}
