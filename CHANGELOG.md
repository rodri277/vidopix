# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-03

### Added

- Layers: add, delete, duplicate, rename, reorder (drag and drop, Alt with arrow keys, or buttons), show and hide, lock, opacity, merge down and flatten. Every operation can be undone (ADR 010).
- Rectangular selection (M) with select all, deselect and Shift for a square. Pencil, eraser, fill and shapes only change pixels inside the selection.
- Move tool (V): drag the selected pixels, or the whole layer when nothing is selected; content stays floating until dropped with Enter, and Escape puts it back. A whole move is one undo step (ADR 011).
- Copy, cut, paste and delete. Copy and cut also write a PNG to the system clipboard, and paste reads an image from it when the browser allows.
- Layers panel with accessible controls, a marching-ants selection outline (still when reduced motion is requested), and messages when an action is refused (locked or hidden layer, nothing selected).
- The eyedropper now picks the visible color from all layers and works on locked layers.
- Composition recalculates only the dirty rectangle (`compositeRegion`) and a benchmark for eight layers.
- ADRs 010 and 011, E2E tests for layers and selection, and a frame-rate probe with eight layers.

### Changed

- Flood fill accepts bounds, so it never leaves the selection.
- The Dependabot configuration ignores major bumps of `@types/node`, `typescript`, `eslint` and `@eslint/js`, which are held back on purpose (ADR 008).

## [0.1.0] - 2026-10-03

### Added

- Editing engine in `packages/core`: pixel buffers, layers and sprites; Bresenham lines, midpoint ellipses, rectangles and an iterative scanline flood fill (contiguous or global, with tolerance).
- Patch-based undo/redo with a 64 MB memory budget instead of a fixed number of steps (ADR 004).
- Pencil and eraser (1 to 16 px), fill, eyedropper, line, rectangle and ellipse, with Shift to constrain lines to 0/45/90 degrees and shapes to squares and circles. A stroke is always one history step and a fast pointer jump leaves no gaps.
- `EditorSession` facade with typed events; the interface never touches pixels directly.
- OKLab and OKLCH conversions with gamut mapping by chroma reduction, validated against published reference values.
- Whole-number zoom from 1x to 64x anchored on the pointer, panning (Space, middle button), pixel grid and transparency checkerboard, rendered with Canvas 2D at whole-number device-pixel scale (ADR 009).
- Primary and secondary colors with hex and OKLCH sliders, alpha, swap with X.
- New sprite dialog (16 to 256 px presets and custom sizes up to 1024); the editor opens with a 32x32 transparent sprite.
- PNG export at whole-number scales from 1x to 32x, with transparent or white background.
- Keyboard-only drawing: arrow keys move a pixel cursor, hold Enter to draw; Alt with arrows moves 8 pixels.
- Menus (File, Edit, View), tool shortcuts, undo/redo announcements for screen readers.
- Benchmarks (`pnpm bench`), component tests with Testing Library, and a pixel-exact E2E suite.
- ADRs 003, 004, 005 and 009.

### Changed

- The empty shell is replaced by the editor. Panels hide with Ctrl/Cmd+\ instead of Tab so Tab stays available for keyboard navigation.
- Filled controls use `--accent-strong` (`#6b45f0`) because white text on the base accent `#7c5cff` measures 4.35:1, below WCAG AA.

## [0.0.1] - 2026-10-03

### Added

- pnpm monorepo with `packages/core` (DOM-free engine) and `apps/web` (React app).
- Packed RGBA `Color` with hex parsing and formatting in the core, with unit and property-based tests.
- Empty UI shell: top bar, tool options, toolbox, canvas area, side panel and status bar, with design tokens as CSS variables and self-hosted Inter and JetBrains Mono.
- Strict TypeScript, ESLint (strict type-checked, react-hooks, jsx-a11y), Prettier, Husky, lint-staged and commitlint.
- Architecture boundary checks with dependency-cruiser, and tests proving they fail on violations.
- Playwright E2E smoke test with axe-core accessibility checks, run against the production build.
- GitHub Actions pipeline (lint, typecheck, tests with coverage, build, bundle size, E2E), Vercel deployment config with a strict CSP, and Dependabot.
- `CLAUDE.md`, READMEs (English and Spanish), architecture document and ADRs 001, 002 and 008.
