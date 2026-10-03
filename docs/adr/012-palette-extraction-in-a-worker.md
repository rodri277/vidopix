# ADR 012: Palette extraction in a worker, file formats on demand

- Status: Accepted
- Phase: 3

## Context

Extracting a palette from a photo means decoding it (a 4000×3000 image is 48 MB of pixels) and quantizing it. Doing this on the main thread would freeze the editor. Separately, validating imported JSON with Zod added about 25 kB gzip to the first download for a feature most visits never use.

## Decision

- **Extraction runs in a module Web Worker** (`palette.worker.ts`). It decodes the file with `createImageBitmap`, draws it onto an `OffscreenCanvas` no larger than 256×256 and runs median cut (`medianCut` in the core, a pure function) on that copy. Progress messages feed a `<progress>` bar.
- **Cancel means `worker.terminate()`**: the work stops at once, with no cooperative checks inside the algorithm.
- Median cut weights colors by how many pixels use them, splits the box with the largest population × range along its widest channel, averages each box and sorts the result from dark to light. Transparent pixels are ignored. Output is deterministic.
- **Palette file formats are a separate entry point** (`@vidopix/core/palette-formats`) loaded with a dynamic `import()` when the user imports or exports. The format parsers return `Result` values with the line of the problem; JSON is validated with Zod and carries a `schemaVersion`.
- The size budget is checked separately for the first download (index chunk) and for the worker.

## Alternatives considered

- **Main thread in chunks (`requestIdleCallback`).** Keeps the page alive but is slower and still janks while decoding.
- **Quantizing the full image.** Costs seconds for no visible gain: the palette of a 256×256 reduction is the same one a person would pick.

## Consequences

- A flat-color 4000×3000 image took 70 to 120 ms end to end in the E2E test, with the longest gap between frames at 17 ms. Real photographs decode slower; the page stays responsive either way because the work is off the main thread.
- Median cut can give muddy colors when asked for very few colors from a noisy image. That is a property of the algorithm and is left as is.
