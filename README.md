# Vidopix

[Español](README.es.md)

A pixel art editor that runs in your browser: no install, no account, and a built-in palette generator.

> **Status:** Phase 1 (base editor, v0.1.0). Layers, selections and palettes come in the next phases. The live demo link and screenshots are added once the app is deployed.

## Goals

- A portfolio piece that shows architecture, algorithms, performance and product design.
- Genuinely usable: an artist should be able to make a 64×64 sprite from start to finish and export it.
- Fast to load and, from Phase 4, usable offline.

## What it does today

- Pencil, eraser (1 to 16 px), fill (contiguous or global, with tolerance), eyedropper, line, rectangle and ellipse. Shift constrains lines to 0/45/90 degrees and shapes to squares and circles.
- Integer zoom from 1x to 64x anchored on the pointer, panning, pixel grid, transparency checkerboard.
- Primary and secondary colors with hex and OKLCH sliders.
- Undo and redo that never run out of steps, only out of a memory budget (64 MB by default).
- PNG export at 1x to 32x.
- Fully usable from the keyboard: arrow keys move a pixel cursor, hold Enter to draw.

## Measured performance

Numbers from this repository's own benchmarks and E2E run on the author's machine (Apple silicon Mac, headless Chromium). They are not estimates; run `pnpm bench` and `pnpm e2e` to reproduce them on yours.

| Metric                                         | Target       | Measured                     |
| ---------------------------------------------- | ------------ | ---------------------------- |
| Flood fill 1024×1024, algorithm only           | < 50 ms      | about 12 ms                  |
| Flood fill 1024×1024, including the undo patch | < 50 ms      | about 34 ms                  |
| Frame time while drawing on 256×256            | 60 fps       | 16.7 ms mean (vsync-limited) |
| 500 strokes undone and redone on 256×256       | within 64 MB | passes (unit test)           |
| Initial JavaScript (gzip)                      | < 150 kB     | 88 kB                        |

Lighthouse scores have not been measured yet.

## Stack

TypeScript (strict), React, Vite, pnpm workspaces, Vitest + fast-check, Playwright + axe-core, ESLint, Prettier, dependency-cruiser, GitHub Actions and Vercel. See [SPEC.md](SPEC.md) section 3 for the reasoning.

## Architecture

A pure TypeScript engine (`packages/core`, no DOM) and a React app (`apps/web`) that only paints and translates events. The boundary is enforced in CI. See [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr).

## Getting started

Requires Node 24 LTS (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

Useful scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`.

## How this was built

Developed with Claude Code from a written specification ([SPEC.md](SPEC.md)). This section will cover what was asked, what was reviewed and decided by the author, and what was corrected, once there is more to tell.

## Credits and license

By vidotho. MIT licensed, see [LICENSE](LICENSE).
