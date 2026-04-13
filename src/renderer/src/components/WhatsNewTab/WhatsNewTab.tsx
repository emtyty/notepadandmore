import { Sparkles } from 'lucide-react'

export function WhatsNewTab() {
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
              <div className="text-2xl font-semibold text-foreground leading-tight">v1.0.0</div>
            </div>
          </header>

          <p className="text-base text-foreground leading-relaxed mb-4">
            It finally happened. We got tired of watching you struggle with Wine bottles
            and clunky virtual machines just to open a single <code className="px-1 py-0.5 rounded bg-secondary text-foreground text-sm">.txt</code> file.
            We've finally built a bridge across the OS divide, and surprisingly, the
            whole thing didn't collapse during the first compile.
          </p>

          <h3 className="text-base font-semibold text-foreground mt-8 mb-3">What's New</h3>
          <ul className="space-y-4">
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Mac Support:</span> Yes, you read that right.
              You can now use your $3,000 MacBook Pro to write code in an editor that looks
              like it was designed in 2003. It's called "vintage chic." You're welcome.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Universal Clipboard:</span> Copy on Windows,
              paste on Mac. It's not magic—it's just better engineering. It's real, it's
              here, and it actually works.
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">Retina Ready:</span> We've polished the icons
              to be so sharp they might actually cut your fingers if you touch the screen.
              (Please don't touch the screen; it's not a tablet).
            </li>
            <li className="text-base text-foreground leading-relaxed">
              <span className="font-semibold">The "Tab" Situation:</span> We've finally
              settled the "Tabs vs. Spaces" debate. Just kidding—try it on your side and
              give us your feedback. (We're staying out of the line of fire for now).
            </li>
          </ul>
        </article>
      </div>
    </div>
  )
}
