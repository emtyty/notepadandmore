import { app, BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'

export class UpdateManager {
  private win: BrowserWindow
  private manualCheckInFlight = false
  private readonly enabled: boolean

  constructor(win: BrowserWindow) {
    this.win = win
    this.enabled = app.isPackaged && process.env['E2E_TEST'] !== '1'

    if (!this.enabled) {
      this.log('info', 'disabled (unpackaged or E2E mode)')
      return
    }

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    // Forward electron-updater internal logs to stdout.
    autoUpdater.logger = {
      info: (msg: unknown) => this.log('info', String(msg)),
      warn: (msg: unknown) => this.log('warn', String(msg)),
      error: (msg: unknown) => this.log('error', String(msg)),
      debug: (msg: string) => this.log('debug', msg),
    }

    this.wireEvents()
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', msg: string, data?: unknown): void {
    const ts = new Date().toISOString()
    const suffix = data !== undefined ? ` ${JSON.stringify(data)}` : ''
    const line = `${ts} [update:${level}] ${msg}${suffix}`
    if (level === 'error' || level === 'warn') {
      console.error(line)
    } else {
      console.log(line)
    }
  }

  private send(channel: string, payload?: unknown): void {
    if (this.win.isDestroyed()) return
    this.win.webContents.send(channel, payload)
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.log('info', 'checking-for-update', { manual: this.manualCheckInFlight })
      this.send('update:checking', { manual: this.manualCheckInFlight })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.log('info', 'update-available', { version: info.version, manual: this.manualCheckInFlight })
      this.send('update:available', { version: info.version, manual: this.manualCheckInFlight })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.log('info', 'update-not-available', { version: info.version, manual: this.manualCheckInFlight })
      this.send('update:not-available', { version: info.version, manual: this.manualCheckInFlight })
      this.manualCheckInFlight = false
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const pct = Math.round(progress.percent)
      if (pct % 10 === 0) {
        this.log('info', 'download-progress', {
          percent: pct,
          bytesPerSecond: Math.round(progress.bytesPerSecond),
          transferred: progress.transferred,
          total: progress.total,
        })
      }
      this.send('update:downloading', { percent: progress.percent })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.log('info', 'update-downloaded', { version: info.version })
      this.send('update:downloaded', { version: info.version })
      this.manualCheckInFlight = false
    })

    autoUpdater.on('error', (err: Error) => {
      this.log('error', 'update-error', { message: err.message, manual: this.manualCheckInFlight })
      this.send('update:error', { message: err.message, manual: this.manualCheckInFlight })
      this.manualCheckInFlight = false
    })
  }

  async checkForUpdates(manual: boolean): Promise<void> {
    if (!this.enabled) return
    this.log('info', 'checkForUpdates called', { manual })
    this.manualCheckInFlight = manual
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // The 'error' event fires too; swallow here to avoid unhandled rejection.
      this.manualCheckInFlight = false
      void err
    }
  }

  quitAndInstall(): void {
    if (!this.enabled) return
    this.log('info', 'quitAndInstall called')
    autoUpdater.quitAndInstall()
  }
}
