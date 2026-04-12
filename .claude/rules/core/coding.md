---
paths:
  - "packages/core/**"
---

# Core Package Coding Rules

## TypeScript

- `strict: true` enabled. Never use `any` — prefer `unknown` or proper generics.
- Interfaces: no prefix (`BuildContext`, `BuildPlugin`). Types: same (`BuildEvent`, `AppName`).
- Export everything from `index.ts` — keep the public API surface intentional.
- AsyncGenerator pattern for plugins: `execute(ctx: BuildContext): AsyncGenerator<BuildEvent>`.

## Plugin System

- Every builder must implement `BuilderPlugin` interface: `id`, `dependsOn[]`, `shouldRun(ctx)`, `execute(ctx)`.
- `shouldRun()` is pure — no side effects. It decides based on `BuildContext` flags only.
- `execute()` yields `BuildEvent` objects — never throws to signal failure; yield a `BuildEvent` with `type: 'error'`.
- Keep builders focused: one builder = one concern (e.g., `electron` builds the Electron app only).

## BuildContext

- Immutable per-job. Never mutate after creation — pass through, don't modify.
- All config comes from `BuildContext`. No global state, no environment variable reads inside builders.
- Environment variable reads happen once at `loadConfig()` time, then baked into `BuildContext`.

## Config (Zod)

- All schemas in `config/schema.ts`. Validate at load time, not at runtime.
- Per-app configs in `config/apps/<app-name>.ts`. Follow existing pattern exactly.
- Never hardcode paths inside builders — paths come from `BuildContext`.

## Error Handling

- Use `execa` for shell commands. Catch errors, yield a typed `BuildEvent` with the error details.
- Never `process.exit()` inside library code. Only the CLI entry (`cli.ts`) may call `process.exit()`.
- Wrap external tool calls (codesign, notarize, etc.) with descriptive error messages.

## Testing (Vitest)

- Test files next to source: `foo.test.ts` beside `foo.ts`.
- Test the `execute()` generator by collecting emitted events: `[...await gen]`.
- Mock shell commands with `vi.mock('execa')` — never run real builds in tests.
- Test `shouldRun()` for all relevant flag combinations.

## CLI

- CLI is a thin wrapper around the library. No business logic in `cli.ts`.
- Use `commander` for arg parsing. Use `chalk` for terminal output.
- All output goes through `BuildEmitter` → CLI subscribes and formats.
