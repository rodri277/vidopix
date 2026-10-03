# Vidopix

Browser-based pixel art editor with a built-in palette generator. By vidotho.

**Source of truth: [SPEC.md](SPEC.md).** If something conflicts with it or is missing, ask before improvising. Work phase by phase (SPEC section 8), present a short plan at the start of each phase and wait for confirmation.

## Commands

Node is pinned in `.nvmrc` (use `fnm use`); pnpm via `packageManager`.

```bash
pnpm install          # install (frozen lockfile in CI)
pnpm dev              # run the web app
pnpm lint             # ESLint (strict type-checked) + architecture boundaries
pnpm format:check     # Prettier
pnpm typecheck        # tsc in every package
pnpm test             # core (coverage) + web component tests + boundary tests
pnpm bench            # core benchmarks (fill, strokes); prints a table, asserts nothing
pnpm build            # production build of apps/web
pnpm size             # bundle size budget (150 kB gzip)
pnpm e2e              # Playwright + axe against the production build
```

Before closing any task: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm e2e` if the UI changed. All green.

## Architecture

- `packages/core`: pure TypeScript, **no DOM**, no React. All domain logic. `tsconfig` has no `dom` lib.
- `apps/web`: React UI and browser adapters. Talks to the core only through `EditorSession`; never writes pixels directly.
- Every document mutation goes through a `Command` so it lands in history.
- Boundaries are enforced by dependency-cruiser (`.dependency-cruiser.cjs`) and proven by `tools/check-boundaries.test.mjs`.
- `features/*` never import each other; share through `state/` or `design-system/`.
- Architecture decisions live in `docs/adr/`. Add an ADR for every relevant decision.

## Where things live

- `EditorSession` (core) is the only door to the document. Tools are strategies in `packages/core/src/tools`. Layers, selection, clipboard and history live in `session.document` (`DocumentEditor`); layer edits are pure functions in `document/layer-ops.ts`.
- The palette lives on the sprite; edit it through `session.document` (`addPaletteColor`, `loadPalette`, `replaceColor`, ...). Palette file formats are imported from `@vidopix/core/palette-formats` (a separate entry so the app can load them on demand); do not add them back to the core index.
- Any code that edits the document must first drop floating content (`commitFloating`); `DocumentEditor` does it for its own operations.
- Pure viewport math is in the core (`viewport/`); the renderer (`apps/web/src/adapters/canvas-renderer.ts`) only applies it.
- UI state is a Zustand store (`apps/web/src/state/editor-store.ts`) that mirrors session events (ADR 005).
- Keyboard shortcuts are defined in one place: `apps/web/src/state/shortcuts.ts`.
- `app/App.tsx` is the only place features are composed; `features/*` never import each other.

## Conventions

- Code, names, comments and commits in English. UI in English (Spanish added in Phase 4).
- TDD in `packages/core`: write the test first, then the implementation. Coverage ≥ 90 % is enforced.
- Strict TypeScript: no `any`, no `@ts-ignore`, no forgotten `console.log`, no `export default` (except tool config files).
- Expected errors in the core (malformed files) are returned as `Result`; exceptions are for programmer errors.
- Colors are packed RGBA in a `Uint32Array`; see `packages/core/src/domain/color.ts`.
- Small functions, pure when possible. Comments explain why, not what.
- No new dependency without a one-line justification in the PR.
- Do not optimize without measuring: benchmark first (`vitest bench`).
- Do not mix features from different phases in one PR.

## Git workflow

- Conventional Commits (`feat(core): add scanline flood fill`), enforced by commitlint.
- One branch and one PR per phase: `phase/<n>-<name>`.
- Hooks (Husky): lint-staged on commit, commitlint on commit message.
- Close each phase with a version tag and a CHANGELOG entry.

## Toolchain notes

- TypeScript is pinned to 6.0.x and ESLint to 9.39.x until `typescript-eslint` and `eslint-plugin-jsx-a11y` support the newer majors (ADR 008).
- Vite inlining of assets is disabled so the strict CSP (`vercel.json` and `apps/web/vite.config.ts`, kept in sync) holds.
