# Phase 1: Infrastructure Setup — Implementation Spec

**Parent PRD:** [novapad-ui-refactor.md](../prd/novapad-ui-refactor.md)  
**Branch:** `novapad`  
**Date:** 2026-04-10  

---

## Objective

Set up the Tailwind CSS + Shadcn/ui infrastructure in the existing Electron renderer so that Phase 2+ components can be rewritten using utility classes and Radix primitives. At the end of Phase 1 the app must still compile and run identically — no visual changes yet.

---

## Pre-conditions

- Branch `novapad` checked out
- `npm install` passes
- `npm run dev` launches the app with current UI

## Post-conditions

- Tailwind CSS compiles and purges correctly in the renderer bundle
- All 49 Shadcn/ui component files exist under `src/renderer/src/components/ui/`
- `cn()` utility available at `@/lib/utils`
- `useIsMobile` and `useToast` hooks available at `@/hooks/`
- Both old CSS modules AND new Tailwind classes work simultaneously (co-existence)
- `npm run dev` still launches the app with zero regressions
- `npm run build` produces a working production bundle

---

## Task 1.1 — Install Tailwind CSS + PostCSS Dependencies

### Dependencies to add (devDependencies)

```bash
npm install -D tailwindcss@^3.4.17 postcss@^8.5.6 autoprefixer@^10.4.21
```

### Dependencies to add (dependencies)

```bash
npm install tailwindcss-animate@^1.0.7 tailwind-merge@^2.6.0 class-variance-authority@^0.7.1 clsx@^2.1.1
```

### Rationale

| Package | Purpose |
|---------|---------|
| `tailwindcss` | Utility-first CSS framework |
| `postcss` | CSS transformer pipeline (Tailwind requires it) |
| `autoprefixer` | Vendor prefix automation |
| `tailwindcss-animate` | Animation utilities for Shadcn components |
| `tailwind-merge` | Intelligent Tailwind class deduplication in `cn()` |
| `class-variance-authority` | Component variant system used by Shadcn (Button, Badge, Toggle, etc.) |
| `clsx` | Conditional className joining used by `cn()` |

---

## Task 1.2 — Install Shadcn/ui + Radix UI Dependencies

### Dependencies to add (dependencies)

```bash
npm install \
  @radix-ui/react-accordion \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-aspect-ratio \
  @radix-ui/react-avatar \
  @radix-ui/react-checkbox \
  @radix-ui/react-collapsible \
  @radix-ui/react-context-menu \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-hover-card \
  @radix-ui/react-label \
  @radix-ui/react-menubar \
  @radix-ui/react-navigation-menu \
  @radix-ui/react-popover \
  @radix-ui/react-progress \
  @radix-ui/react-radio-group \
  @radix-ui/react-scroll-area \
  @radix-ui/react-select \
  @radix-ui/react-separator \
  @radix-ui/react-slider \
  @radix-ui/react-slot \
  @radix-ui/react-switch \
  @radix-ui/react-tabs \
  @radix-ui/react-toast \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group \
  @radix-ui/react-tooltip
```

### Additional Shadcn ecosystem deps

```bash
npm install \
  sonner@^1.7.4 \
  cmdk@^1.1.1 \
  vaul@^0.9.9 \
  react-hook-form@^7.61.1 \
  @hookform/resolvers@^3.10.0 \
  zod@^3.25.76 \
  input-otp@^1.4.2 \
  embla-carousel-react@^8.6.0 \
  react-day-picker@^8.10.1 \
  recharts@^2.15.4
```

> **Note:** `lucide-react` and `react-resizable-panels` are already installed — skip these.

### Dependencies NOT needed

| Package | Why skip |
|---------|----------|
| `next-themes` | Novapad's `sonner.tsx` imports it, but we use Zustand `uiStore.theme`. We will modify `sonner.tsx` to read from our store instead |
| `react-router-dom` | Novapad uses it for pages. Our app is single-page, no router needed |
| `@tanstack/react-query` | Novapad uses it but we have no async query needs — our data flows through Zustand + IPC |
| `@vitejs/plugin-react-swc` | Novapad uses SWC; we keep our existing `@vitejs/plugin-react` (Babel). Both work fine |
| `lovable-tagger` | Dev tool from novapad's scaffold, not needed |

---

## Task 1.3 — Create PostCSS Config

### File: `postcss.config.js` (project root)

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### Why this works

`electron-vite` uses Vite under the hood. Vite auto-detects `postcss.config.js` in the project root and applies it to all CSS in the renderer bundle. No additional Vite plugin config needed.

### Verification

After creating this file, `npm run dev` must still work. If PostCSS is picked up correctly, Tailwind directives (`@tailwind base`) will be processed when we add them in Task 1.4.

---

## Task 1.4 — Create Tailwind Config

### File: `tailwind.config.ts` (project root)

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/renderer/src/**/*.{ts,tsx}",
    "./src/renderer/index.html",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        toolbar: {
          DEFAULT: "hsl(var(--toolbar))",
          foreground: "hsl(var(--toolbar-foreground))",
          border: "hsl(var(--toolbar-border))",
        },
        tab: {
          active: "hsl(var(--tab-active))",
          inactive: "hsl(var(--tab-inactive))",
          hover: "hsl(var(--tab-hover))",
          foreground: "hsl(var(--tab-foreground))",
          muted: "hsl(var(--tab-muted))",
        },
        statusbar: {
          DEFAULT: "hsl(var(--statusbar))",
          foreground: "hsl(var(--statusbar-foreground))",
        },
        explorer: {
          DEFAULT: "hsl(var(--explorer))",
          foreground: "hsl(var(--explorer-foreground))",
          hover: "hsl(var(--explorer-hover))",
          active: "hsl(var(--explorer-active))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

### Key decisions

| Decision | Rationale |
|----------|-----------|
| `darkMode: ["class"]` | Theme toggle adds/removes `.dark` class on `<html>`. This replaces the current `data-theme` attribute strategy |
| `content` paths | Only scan renderer source — main/preload have no CSS classes |
| Editor-specific tokens | `toolbar`, `tab`, `statusbar`, `explorer`, `sidebar` — custom color tokens for our editor chrome, matching novapad's design |
| `--radius: 0.25rem` | Small radius matching novapad's compact editor aesthetic |

---

## Task 1.5 — Create Tailwind Base CSS

### File: `src/renderer/src/styles/tailwind.css` (NEW)

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 220 14% 96%;
    --foreground: 220 20% 15%;

    --card: 0 0% 100%;
    --card-foreground: 220 20% 15%;

    --popover: 0 0% 100%;
    --popover-foreground: 220 20% 15%;

    --primary: 215 80% 50%;
    --primary-foreground: 0 0% 100%;

    --secondary: 220 14% 90%;
    --secondary-foreground: 220 20% 15%;

    --muted: 220 14% 92%;
    --muted-foreground: 220 10% 46%;

    --accent: 215 80% 50%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 13% 87%;
    --input: 220 13% 87%;
    --ring: 215 80% 50%;

    --radius: 0.25rem;

    /* Editor-specific tokens */
    --toolbar: 220 14% 94%;
    --toolbar-foreground: 220 20% 25%;
    --toolbar-border: 220 13% 85%;
    --tab-active: 0 0% 100%;
    --tab-inactive: 220 14% 92%;
    --tab-hover: 220 14% 96%;
    --tab-foreground: 220 20% 15%;
    --tab-muted: 220 10% 50%;
    --statusbar: 215 80% 50%;
    --statusbar-foreground: 0 0% 100%;
    --explorer: 220 14% 97%;
    --explorer-foreground: 220 20% 25%;
    --explorer-hover: 215 60% 90%;
    --explorer-active: 215 80% 95%;
    --gutter: 220 14% 94%;
    --gutter-foreground: 220 10% 60%;
    --line-highlight: 215 60% 95%;

    --sidebar-background: 220 14% 97%;
    --sidebar-foreground: 220 20% 25%;
    --sidebar-primary: 215 80% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 215 60% 90%;
    --sidebar-accent-foreground: 220 20% 15%;
    --sidebar-border: 220 13% 87%;
    --sidebar-ring: 215 80% 50%;
  }

  .dark {
    --background: 220 16% 12%;
    --foreground: 220 14% 90%;

    --card: 220 16% 15%;
    --card-foreground: 220 14% 90%;

    --popover: 220 16% 15%;
    --popover-foreground: 220 14% 90%;

    --primary: 215 80% 55%;
    --primary-foreground: 0 0% 100%;

    --secondary: 220 16% 20%;
    --secondary-foreground: 220 14% 90%;

    --muted: 220 16% 18%;
    --muted-foreground: 220 10% 55%;

    --accent: 215 80% 55%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 62% 45%;
    --destructive-foreground: 0 0% 100%;

    --border: 220 16% 22%;
    --input: 220 16% 22%;
    --ring: 215 80% 55%;

    --toolbar: 220 16% 14%;
    --toolbar-foreground: 220 14% 80%;
    --toolbar-border: 220 16% 20%;
    --tab-active: 220 16% 18%;
    --tab-inactive: 220 16% 12%;
    --tab-hover: 220 16% 16%;
    --tab-foreground: 220 14% 90%;
    --tab-muted: 220 10% 50%;
    --statusbar: 215 80% 40%;
    --statusbar-foreground: 0 0% 100%;
    --explorer: 220 16% 13%;
    --explorer-foreground: 220 14% 80%;
    --explorer-hover: 215 40% 22%;
    --explorer-active: 215 50% 25%;
    --gutter: 220 16% 14%;
    --gutter-foreground: 220 10% 40%;
    --line-highlight: 215 30% 18%;

    --sidebar-background: 220 16% 13%;
    --sidebar-foreground: 220 14% 80%;
    --sidebar-primary: 215 80% 55%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 215 40% 22%;
    --sidebar-accent-foreground: 220 14% 90%;
    --sidebar-border: 220 16% 20%;
    --sidebar-ring: 215 80% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
}

@layer utilities {
  .font-mono {
    font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', 'Courier New', monospace;
  }
  .editor-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .editor-scrollbar::-webkit-scrollbar-track {
    background: hsl(var(--muted));
  }
  .editor-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 5px;
  }
  .editor-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
  }
}
```

### Integration with existing CSS

We create this as a **separate file** (`tailwind.css`) rather than replacing `global.css`. Both stylesheets will co-exist during the migration:

- `global.css` — current Material Design 3 styles (old components read from these vars)
- `tailwind.css` — new Tailwind base + HSL theme vars (new components read from these vars)

### Update `main.tsx` to import both

```diff
 import React from 'react'
 import ReactDOM from 'react-dom/client'
 import App from './App'
 import './styles/global.css'
+import './styles/tailwind.css'

-// Apply theme synchronously before first render so CSS vars resolve immediately
-document.documentElement.setAttribute('data-theme', 'dark')
+// Apply theme synchronously before first render
+// - 'data-theme' attr: read by old CSS module components (global.css)
+// - 'dark' class: read by new Tailwind components (tailwind.css)
+document.documentElement.setAttribute('data-theme', 'dark')
+document.documentElement.classList.add('dark')

 ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
   <React.StrictMode>
     <App />
   </React.StrictMode>
 )
```

### CSP Note

The Google Fonts import uses an external URL. The current CSP in `src/renderer/index.html` restricts `style-src` to `'self' 'unsafe-inline'` and `font-src` to `'self' data:`. We need to update CSP to allow Google Fonts:

```diff
-<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src blob:;" />
+<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; worker-src blob:;" />
```

**Alternative (offline-first):** Instead of Google Fonts CDN, install `@fontsource/jetbrains-mono` and import locally. This avoids CSP changes and works offline:

```bash
npm install @fontsource/jetbrains-mono
```

Then in `tailwind.css` replace the `@import url(...)` with:
```css
/* imported in main.tsx instead */
```

And in `main.tsx`:
```ts
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
```

> **Recommendation:** Use the `@fontsource` approach. The app is a desktop Electron app — it must work offline. This also keeps CSP unchanged.

---

## Task 1.6 — Create `cn()` Utility

### File: `src/renderer/src/lib/utils.ts` (NEW)

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

This is the standard Shadcn utility used by every UI primitive for conditional class merging. The `@/lib/utils` import path is already aliased via `tsconfig.web.json` (`@/*` -> `src/renderer/src/*`).

---

## Task 1.7 — Create Shadcn Config

### File: `components.json` (project root)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/renderer/src/styles/tailwind.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Key differences from novapad

| Field | Novapad | Ours | Why |
|-------|---------|------|-----|
| `tailwind.css` | `src/index.css` | `src/renderer/src/styles/tailwind.css` | Our CSS lives deeper in the Electron renderer structure |
| `rsc` | `false` | `false` | Same — no React Server Components in Electron |
| `aliases` | `@/...` | `@/...` | Same — our tsconfig already maps `@/*` to `src/renderer/src/*` |

---

## Task 1.8 — Copy Shadcn/ui Component Files

### Target directory: `src/renderer/src/components/ui/`

Copy all 49 files from `/Users/haht/Documents/Workspace/viber/novapad/src/components/ui/` to `src/renderer/src/components/ui/`:

```
accordion.tsx         dialog.tsx           menubar.tsx          separator.tsx
alert-dialog.tsx      drawer.tsx           navigation-menu.tsx  sheet.tsx
alert.tsx             dropdown-menu.tsx    pagination.tsx       sidebar.tsx
aspect-ratio.tsx      form.tsx             popover.tsx          skeleton.tsx
avatar.tsx            hover-card.tsx       progress.tsx         slider.tsx
badge.tsx             input-otp.tsx        radio-group.tsx      sonner.tsx
breadcrumb.tsx        input.tsx            resizable.tsx        switch.tsx
button.tsx            label.tsx            scroll-area.tsx      table.tsx
calendar.tsx                               select.tsx           tabs.tsx
card.tsx                                                        textarea.tsx
carousel.tsx                                                    toast.tsx
chart.tsx                                                       toaster.tsx
checkbox.tsx                                                    toggle-group.tsx
collapsible.tsx                                                 toggle.tsx
command.tsx                                                     tooltip.tsx
context-menu.tsx                                                use-toast.ts
```

### Modifications required after copy

#### 1. `sonner.tsx` — Remove `next-themes` dependency

The novapad version imports `useTheme` from `next-themes`. Replace with a direct read from our `uiStore`:

```tsx
// BEFORE (novapad)
import { useTheme } from "next-themes"

// AFTER (ours)
import { useUIStore } from "@/store/uiStore"
```

And update the component body:

```tsx
// BEFORE
const { theme = "system" } = useTheme()

// AFTER
const theme = useUIStore((s) => s.theme)
```

#### 2. `sidebar.tsx` — Remove `next-themes` reference if any

Check if sidebar.tsx uses `next-themes`. If not, no change needed. The sidebar component imports from `use-mobile` hook which we provide in Task 1.9.

#### 3. All files — Verify `@/` import paths resolve

All Shadcn files use `@/lib/utils`, `@/components/ui/...`, `@/hooks/...`. Since our tsconfig already maps `@/*` to `src/renderer/src/*`, these should resolve correctly. Verify with `npm run build`.

---

## Task 1.9 — Create Supporting Hooks

### File: `src/renderer/src/hooks/use-mobile.tsx` (NEW)

```tsx
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
```

> This is used by Shadcn's `sidebar.tsx` component. In an Electron desktop app this will always return `false`, but the hook must exist for the import to resolve.

### File: `src/renderer/src/hooks/use-toast.ts` (NEW)

Copy from novapad's `src/hooks/use-toast.ts` — this is the Shadcn/Radix toast state manager used by `toaster.tsx`. It is independent of our Zustand `uiStore` toast system and can co-exist.

Full content: 186 lines (reducer-based toast queue with `useToast()` hook and `toast()` imperative API). Copy verbatim from novapad source.

---

## Task 1.10 — Verify Co-existence

### What must work after Phase 1

| Check | How to verify |
|-------|---------------|
| App compiles | `npm run build` exits 0 |
| App launches | `npm run dev` opens the Electron window |
| Current UI unchanged | All existing components render with their CSS module styles |
| Tailwind processes | Add a temporary `<div className="bg-primary text-primary-foreground p-4">Tailwind works</div>` in `App.tsx`, verify it renders a blue box |
| Shadcn imports resolve | Add a temporary `import { Button } from '@/components/ui/button'` in any file, verify no compile error |
| Dark class applied | Inspect `<html>` element — should have both `data-theme="dark"` and `class="dark"` |
| No CSS conflicts | Old components (CSS modules with scoped classes) should not be affected by Tailwind reset |

### Potential conflict: Tailwind base reset vs. existing global.css

Tailwind's `@tailwind base` applies Preflight (a CSS reset). This could conflict with our existing `global.css` reset (`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`).

**Mitigation:** The resets are compatible — both set `box-sizing: border-box` and zero margins. Tailwind Preflight also resets headings, lists, etc., which is fine for our app (we don't use raw HTML elements).

If any visual regression appears, we can scope Tailwind's base:
```css
@tailwind base; /* Can be replaced with manual Preflight if needed */
```

### Potential conflict: `border-border` in Tailwind base

The `* { @apply border-border; }` rule in `tailwind.css` sets a default border color on ALL elements. This could affect existing components that use `border` without specifying a color.

**Mitigation:** Since CSS modules scope their classes, and our existing components explicitly set border colors via CSS vars (`border: 1px solid var(--border)`), there should be no conflict. The Tailwind rule uses `border-color` only (not `border-style` or `border-width`), so it's a safe default.

---

## File Summary

### New files created (10)

| File | Purpose |
|------|---------|
| `postcss.config.js` | PostCSS pipeline with Tailwind + Autoprefixer |
| `tailwind.config.ts` | Tailwind theme config with editor-specific tokens |
| `components.json` | Shadcn CLI config |
| `src/renderer/src/styles/tailwind.css` | Tailwind directives + HSL theme variables (light + dark) |
| `src/renderer/src/lib/utils.ts` | `cn()` utility |
| `src/renderer/src/hooks/use-mobile.tsx` | Mobile breakpoint hook (required by sidebar.tsx) |
| `src/renderer/src/hooks/use-toast.ts` | Radix toast state manager (required by toaster.tsx) |
| `src/renderer/src/components/ui/*.tsx` | 49 Shadcn/ui component files |

### Modified files (2)

| File | Change |
|------|--------|
| `src/renderer/src/main.tsx` | Add `import './styles/tailwind.css'` + add `classList.add('dark')` |
| `src/renderer/src/components/ui/sonner.tsx` | Replace `next-themes` import with `uiStore` |

### Package changes

| Type | Count | ~Size impact |
|------|-------|------|
| New devDependencies | 3 | Build-time only |
| New dependencies | ~35 | ~150KB gzipped (Radix is tree-shaken) |

---

## Execution Checklist

```
[x] 1.1  npm install Tailwind + PostCSS deps
[x] 1.2  npm install Radix + Shadcn ecosystem deps
[x] 1.3  Create postcss.config.js
[x] 1.4  Create tailwind.config.ts
[x] 1.5  Create tailwind.css + update main.tsx imports
[x] 1.6  Create lib/utils.ts (cn utility)
[x] 1.7  Create components.json
[x] 1.8  Copy 49 Shadcn/ui files + patch sonner.tsx
[x] 1.9  Create use-mobile.tsx + use-toast.ts hooks
[x] 1.10 Verify: npm run build && npm run dev — no regressions
```

---

## Implementation Output

**Completed:** 2026-04-10

### Deviations from spec

| Spec | Actual | Reason |
|------|--------|--------|
| Google Fonts CDN for JetBrains Mono | `@fontsource/jetbrains-mono` (local) | Electron app must work offline; avoids CSP changes |
| CSP update in `index.html` | Not needed | Using `@fontsource` instead of CDN — no external font requests |
| `tailwind.css` has `@import url(...)` for fonts | Fonts imported in `main.tsx` via `@fontsource` | Cleaner separation; font CSS is loaded before Tailwind processes |

### Build verification

| Check | Result |
|-------|--------|
| `npm run build` | Pass — zero errors, zero warnings (only benign `"use client"` directive notice from lucide-react) |
| PostCSS detection | Vite auto-detected `postcss.config.js`. Note: logs a `MODULE_TYPELESS_PACKAGE_JSON` info message because project `package.json` lacks `"type": "module"` — harmless, does not affect output |
| Tailwind in output | 355 Tailwind-related matches in production CSS bundle |
| Old CSS co-existence | 11 matches for old Material Design 3 vars (`--tab-bar-bg`, `--sidenav-bg`, etc.) confirmed present |
| Output CSS size | `index-DQXlszSb.css` — 379.46 KB (includes both old global.css + new tailwind.css + all font faces) |
| Font assets | JetBrains Mono woff/woff2 files (400/500/600/700, latin/latin-ext/cyrillic/greek/vietnamese) bundled into `out/renderer/assets/` |

### Files created

```
postcss.config.js                                          — PostCSS pipeline
tailwind.config.ts                                         — Tailwind theme + editor tokens
components.json                                            — Shadcn CLI config
src/renderer/src/styles/tailwind.css                       — HSL theme vars (light + dark)
src/renderer/src/lib/utils.ts                              — cn() utility
src/renderer/src/hooks/use-mobile.tsx                      — Mobile breakpoint hook
src/renderer/src/hooks/use-toast.ts                        — Radix toast state manager (186 lines)
src/renderer/src/components/ui/accordion.tsx
src/renderer/src/components/ui/alert-dialog.tsx
src/renderer/src/components/ui/alert.tsx
src/renderer/src/components/ui/aspect-ratio.tsx
src/renderer/src/components/ui/avatar.tsx
src/renderer/src/components/ui/badge.tsx
src/renderer/src/components/ui/breadcrumb.tsx
src/renderer/src/components/ui/button.tsx
src/renderer/src/components/ui/calendar.tsx
src/renderer/src/components/ui/card.tsx
src/renderer/src/components/ui/carousel.tsx
src/renderer/src/components/ui/chart.tsx
src/renderer/src/components/ui/checkbox.tsx
src/renderer/src/components/ui/collapsible.tsx
src/renderer/src/components/ui/command.tsx
src/renderer/src/components/ui/context-menu.tsx
src/renderer/src/components/ui/dialog.tsx
src/renderer/src/components/ui/drawer.tsx
src/renderer/src/components/ui/dropdown-menu.tsx
src/renderer/src/components/ui/form.tsx
src/renderer/src/components/ui/hover-card.tsx
src/renderer/src/components/ui/input-otp.tsx
src/renderer/src/components/ui/input.tsx
src/renderer/src/components/ui/label.tsx
src/renderer/src/components/ui/menubar.tsx
src/renderer/src/components/ui/navigation-menu.tsx
src/renderer/src/components/ui/pagination.tsx
src/renderer/src/components/ui/popover.tsx
src/renderer/src/components/ui/progress.tsx
src/renderer/src/components/ui/radio-group.tsx
src/renderer/src/components/ui/resizable.tsx
src/renderer/src/components/ui/scroll-area.tsx
src/renderer/src/components/ui/select.tsx
src/renderer/src/components/ui/separator.tsx
src/renderer/src/components/ui/sheet.tsx
src/renderer/src/components/ui/sidebar.tsx
src/renderer/src/components/ui/skeleton.tsx
src/renderer/src/components/ui/slider.tsx
src/renderer/src/components/ui/sonner.tsx                  — patched: uiStore instead of next-themes
src/renderer/src/components/ui/switch.tsx
src/renderer/src/components/ui/table.tsx
src/renderer/src/components/ui/tabs.tsx
src/renderer/src/components/ui/textarea.tsx
src/renderer/src/components/ui/toast.tsx
src/renderer/src/components/ui/toaster.tsx
src/renderer/src/components/ui/toggle-group.tsx
src/renderer/src/components/ui/toggle.tsx
src/renderer/src/components/ui/tooltip.tsx
src/renderer/src/components/ui/use-toast.ts                — re-exports from @/hooks/use-toast
```

### Files modified

```
src/renderer/src/main.tsx
  + import '@fontsource/jetbrains-mono/400.css'
  + import '@fontsource/jetbrains-mono/500.css'
  + import '@fontsource/jetbrains-mono/600.css'
  + import '@fontsource/jetbrains-mono/700.css'
  + import './styles/tailwind.css'
  + document.documentElement.classList.add('dark')
```

### Dependencies added

**devDependencies (3):**
- `tailwindcss@^3.4.17`
- `postcss@^8.5.6`
- `autoprefixer@^10.4.21`

**dependencies (39):**
- `tailwindcss-animate`, `tailwind-merge`, `class-variance-authority`, `clsx`
- `@fontsource/jetbrains-mono`
- `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`
- `sonner`, `cmdk`, `vaul`, `react-hook-form`, `@hookform/resolvers`, `zod`, `input-otp`, `embla-carousel-react`, `react-day-picker`, `recharts`
