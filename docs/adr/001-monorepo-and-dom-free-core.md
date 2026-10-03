# ADR 001: Monorepo with a DOM-free core

- Status: Accepted
- Phase: 0

## Context

Vidopix is a pixel art editor whose value is in its engine: drawing algorithms, history, layers, color science and file formats. Those parts have to be fast, deterministic and easy to test. The UI, in contrast, is expected to change more often and depends on the browser.

## Decision

Use a pnpm workspace with two packages:

- `packages/core`: all domain logic in pure TypeScript. Its `tsconfig` does not include the `dom` lib, and it may not import React or any browser-bound library.
- `apps/web`: the React app and the browser adapters (canvas, IndexedDB, workers). It talks to the core only through `EditorSession` and the ports the core defines.

The boundary is enforced in CI with dependency-cruiser (`.dependency-cruiser.cjs`), and `tools/check-boundaries.test.mjs` proves the rules fail when violated.

## Alternatives considered

- **Single package with folders.** Simpler, but nothing stops domain code from reaching into the DOM or React over time.
- **Many small packages (algorithms, history, io...).** Better isolation, but more configuration for a project of this size. The core can be split later if needed.

## Consequences

- The engine runs in Vitest without a browser, which keeps tests fast and property-based tests cheap.
- The UI could be replaced without touching the engine.
- Adapters must be written for every browser capability (rendering, storage, workers), which is a deliberate cost.
