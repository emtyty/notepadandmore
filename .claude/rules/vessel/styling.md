---
paths:
  - "apps/vessel/**"
---

# Styling Rules

Use **TailwindCSS 4** exclusively. No inline styles, CSS modules, or CSS-in-JS.

## General

- All styles via Tailwind utility classes in JSX `className`.
- Use `cn()` helper (from `clsx` or `tailwind-merge`) to conditionally combine classes — never string concatenation.
- Design tokens (colors, spacing, font sizes) defined in TailwindCSS config — don't hardcode hex colors or pixel values.

## Layout

- Prefer `flex` + `gap-*` over `grid`. Use `grid` only for complex 2D layouts.
- Use `min-h-0` / `min-w-0` to fix flex overflow issues.
- Avoid `absolute` positioning inside scroll containers.

## Responsive

- Vessel is a desktop Electron app — no mobile breakpoints needed.
- Minimum window size enforced in `src/main/index.ts`. Design for that minimum.

## Component Patterns

- Interactive states: use Tailwind's `hover:`, `active:`, `focus:` variants.
- Disabled states: `disabled:opacity-50 disabled:cursor-not-allowed`.
- Dark/light: use CSS variables via Tailwind's `var()` approach if theming is needed.

## Color Palette

- Use the project's color tokens from Tailwind config (e.g., `bg-neutral-900`, `text-slate-300`).
- Status colors: `green-*` for success, `red-*` for error, `yellow-*` for warning, `blue-*` for info/running.
- Never hardcode arbitrary colors like `bg-[#1a1a1a]` unless absolutely necessary for a one-off.

## Don'ts

- No `style={{}}` inline styles (except dynamic values that truly can't be expressed as classes).
- No SCSS or CSS files per component.
- No third-party component libraries beyond what's already installed.
