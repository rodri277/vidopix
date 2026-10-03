# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.2.3] - 2026-10-03

### Changed

- The header animation is now a square icon: a 64×64 scene exported at 4× (256×256), so every art pixel is a whole number of screen pixels and it stays sharp when shown at 64 px. The warrior and the fire fill the frame with a 6 px safe margin, there is no lettering, the background is opaque with a thin frame to stand apart from dark cards, and the 12 frames last 160 ms each and loop without a jump.

## [1.2.2] - 2026-10-03

### Changed

- The README header is now an animation of a warrior resting at a campfire: five layers and twelve frames with a flickering fire, sparks, smoke, twinkling stars and the name in the sky. `pnpm campfire` builds it, opens it in the editor as a project and exports it with the editor's GIF export. The slime hop stays in the animation section.

## [1.2.1] - 2026-10-03

### Fixed

- The header animation had a stray white dot in its last frames and its stars never twinkled: the selection used to clear the slime was still active and clipped the star edits. Stars now twinkle in every frame, away from the title and the slime's path.

## [1.2.0] - 2026-10-03

### Added

- A first visit asks what size of canvas to start with (presets or custom), once. Canceling starts with a small canvas; later visits pick up the last project as before.
- Adding frames is easier to find: a labeled "New frame" button in the timeline, and an "Add frame" tile at the end of the strip.

## [1.1.2] - 2026-10-03

### Added

- `pnpm e2e:webkit` runs the end-to-end tests on WebKit, the engine of Safari. 63 pass and 4 skip where Playwright cannot do what the test needs.
- A header animation drawn in the editor (four layers, eight frames) and exported with its own GIF export; `pnpm showcase` redraws it.

### Fixed

- On Safari, which has no idle callbacks, the saving code was requested 200 ms after load, so a reload in that window lost the last change. It now starts right after the first task and on the first edit.

## [1.1.1] - 2026-10-03

### Added

- README with a header GIF made in the editor, a screenshot per area, a Mermaid architecture diagram, measured highlights, deploy instructions, known limits and a roadmap, in English and Spanish. `pnpm media` regenerates the screenshots and the GIF.
- An index of the decision records in `docs/adr/README.md`.

### Fixed

- The tool options bar no longer squeezes its controls or lets a slider value run into the next control; on narrow windows it scrolls sideways.

## [1.1.0] - 2026-10-03

### Added

- Animation. Each layer has one image per frame; a timeline panel under the canvas adds, duplicates, deletes and reorders frames (buttons, Alt+arrows or drag) and edits the duration of each one in milliseconds. A frames-per-second field sets all durations at once (ADR 016).
- Looping playback that respects every frame's duration, with `P` to play and pause and `,` and `.` to step. Playing never changes the document or the history.
- Onion skin: the previous frame tinted red and the next one blue behind the current frame, switched on separately, with adjustable opacity.
- Export an animated GIF, encoded in a Web Worker with progress and cancel: exact palette when the colors fit, quantized otherwise, 1-bit transparency, each frame's own duration, looping forever (ADR 017).
- Export a spritesheet as a PNG plus a JSON file with the position and duration of every frame, in a grid with a chosen number of columns.
- Layer operations (add, duplicate, merge down, flatten, replace color) work on every frame, and undo returns to the frame an edit was made in.
- Limits of 128 frames and 256 MB of pixels per sprite, refused with a message.

### Changed

- `.vidopix` files move to schema version 2 and share links to format 2. Files and links made by 1.0.0 still open, as a one-frame animation.
- The export dialog is now "Export" and offers PNG, animated GIF and spritesheet.

## [1.0.0] - 2026-10-03

### Added

- Automatic saving to the browser (IndexedDB), a list of recent projects with thumbnails, and reopening the last project on the next visit. A synchronous emergency copy means reloading or closing the page right after a change loses nothing (ADR 013).
- Open and save `.vidopix` files: versioned JSON validated on reading, with migrations between versions and limits of 20 MB, 1024×1024 pixels and 64 layers (ADR 007). The sprite name is editable from the top bar.
- Share a sprite as a link: the sprite is compressed inside the URL fragment, nothing is uploaded, and opening a link imports it as a new project (ADR 014).
- Installable and usable offline: a service worker, a web manifest and icons. Updates wait until the user accepts them from the status bar.
- Drawing aids: horizontal and vertical symmetry with guides on the canvas, 4×4 ordered (Bayer) dithering with adjustable density, a pixel-perfect mode for the pencil that removes extra corner pixels, and optional pen pressure for the brush size.
- Touch: pinch to zoom and two fingers to pan, without drawing while fingers are down. Larger targets on touch screens, and a layout that works down to 768 px of width.
- The interface in English and Spanish, following the browser language with a switch in the Help menu (ADR 015).
- A keyboard shortcuts panel (`?` or Help menu), generated from the same table the shortcuts are checked against.
- `pnpm lighthouse`, which measures the production build.

### Changed

- Palette file formats, project formats and Zod load on demand. Zod runs without `eval`, which the Content Security Policy forbids.
- The two color swatches are separate squares, so each is a touch target of its own.
- The `Open file` item and `Ctrl/Cmd+O`, `Ctrl/Cmd+S` shortcuts were added to the File menu.

## [0.3.0] - 2026-10-03

### Added

- A palette per sprite: add, remove, reorder, rename and edit colors, with every change undoable. Palette colors are always opaque.
- Palette panel with an accessible swatch grid (click for the primary color, Shift+click or right click for the secondary, arrows to move, Alt+arrows to reorder, F2 to rename, Delete to remove, drag and drop), and a choice between replacing the palette and adding to it when loading.
- Six preset palettes, checked against the data published on Lospec and credited to their authors: PICO-8, DawnBringer 16 and 32, Sweetie 16, Endesga 32 and Resurrect 64.
- Import and export of palettes as `.gpl` (GIMP), `.hex` (Lospec) and versioned JSON. Imported files are validated and errors name the line. Export and import is lossless (ADR 012).
- Palette extraction from an image with median cut, from 4 to 64 colors, in a Web Worker with a progress bar and a cancel button.
- Color harmonies in OKLCH (analogous, complementary, triadic, tetradic, monochromatic), shade ramps with hue shifting, and a WCAG contrast checker for the primary and secondary colors (ADR 006).
- Replace a color across all unlocked layers as one undo step, limited to the selection when there is one.
- Tabs for Color, Palette and Generate in the side panel.
- Benchmarks for palette extraction and a Playwright test that extracts a palette from a 4000×3000 image and cancels an extraction in progress.

### Changed

- Palette file formats (and Zod) load on demand, so the first download stays small. The size budget now also covers the extraction worker.
- Names no longer keep control characters such as line breaks.

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
