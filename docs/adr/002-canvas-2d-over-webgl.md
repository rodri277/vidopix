# ADR 002: Canvas 2D over WebGL

- Status: Accepted
- Phase: 0

## Context

The editor renders sprites up to 1024×1024 px at integer zoom levels from 1× to 64×, with a handful of stacked layers. The renderer needs crisp pixels, partial redraws of dirty rectangles and a simple path to export.

## Decision

Render with Canvas 2D, using `OffscreenCanvas` where work moves into workers. Draw with `imageSmoothingEnabled = false` and `image-rendering: pixelated`, and account for `devicePixelRatio`.

The renderer sits behind a `Renderer` port in the core, so another implementation can replace it later.

## Alternatives considered

- **WebGL / WebGPU.** Worth it for large images or heavy blend modes, but the extra complexity is not justified for pixel art at this size. It would also push pixel data to the GPU and complicate the pixel-exact tests.

## Consequences

- Simple code, and exports can be verified pixel by pixel against the model.
- The performance targets (60 fps at 256×256 with 8 layers, flood fill of 1024×1024 under 50 ms) must be measured with benchmarks, not assumed. If they cannot be met, this ADR is revisited with data.
