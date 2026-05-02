import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

export function WhatsNewTab() {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void window.api.app
      .getVersion()
      .then((v) => {
        if (!cancelled) setVersion(v)
      })
      .catch(() => {
        if (!cancelled) setVersion('')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden bg-background" data-testid="whatsnew-tab">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">What's New</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-[680px] mx-auto px-8 py-10">
          <header className="flex items-center gap-3 mb-6">
            <Sparkles size={32} strokeWidth={1.4} className="text-primary shrink-0" />
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Release</div>
              <div className="text-2xl font-semibold text-foreground leading-tight">
                {version ? `v${version}` : ''}
              </div>
            </div>
          </header>

          <p className="text-base text-foreground leading-relaxed mb-4">
            A big maintenance and polish drop. The installer is dramatically smaller, your
            unsaved scratch tabs survive a crash, file associations actually work, and the
            plugin system grew up. Less ceremony, more editing.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-8 mb-3">What's New</h3>
          <ul className="space-y-4">
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Slimmer installer:</span> The Windows installer
              dropped from <span className="font-mono text-sm">254&nbsp;MB</span> to
              <span className="font-mono text-sm"> 93&nbsp;MB</span> (-63%). Your bandwidth
              and your SSD both said thanks.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Notepad++-style snapshot &amp; restore:</span>{' '}
              Unsaved buffers are persisted to disk and brought back exactly as you left them
              after a relaunch — even untitled scratch tabs, even after a crash.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">File associations &amp; Open&nbsp;With:</span>{' '}
              Register the app as a handler for common text formats, with proper Windows
              "Open with" / "Edit with" integration.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Auto-update:</span> Built on electron-updater —
              new versions land in the background and prompt you to restart, no more manual
              installer hunts.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Plugin Manager, redesigned:</span> Plugins now
              live in a full VS&nbsp;Code-style page (not a tiny dialog), with a dedicated
              detail view per plugin.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Smarter file detection:</span> Google's Magika
              ML model identifies file types by content, not extension — so a mislabeled
              <span className="font-mono text-sm"> .txt</span> still gets the right syntax
              highlighting.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">TableLens CSV viewer:</span> Open a
              <span className="font-mono text-sm"> .csv</span> and get a real table view with
              sorting and column sizing — no more squinting at commas.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Beautify everywhere:</span> Format JSON, SQL,
              and XML alongside the existing formatters. Paste detection now figures out the
              language for you.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Quality of life:</span> Full file path in the
              status bar, double-click the tab strip to open a new document, and a pile of
              dialog and session-restore fixes you'll only notice because nothing breaks.
            </li>
          </ul>
        </article>
      </div>
    </div>
  )
}
