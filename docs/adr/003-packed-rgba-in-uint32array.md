# ADR 003: Pixels as packed RGBA in a `Uint32Array`

- Status: Accepted
- Phase: 1

## Context

Every pixel operation (drawing, flood fill, history, compositing, export) touches many pixels. The data also has to reach a canvas without a conversion step.

## Decision

A `PixelBuffer` stores one pixel per `Uint32Array` element, row-major. A color is a single number packed so that, on little-endian hardware, the bytes in memory are R, G, B, A. That is exactly the layout of `ImageData`, so the renderer wraps the same memory in an `ImageData` and calls `putImageData` without copying.

`Color` helpers (`packRgba`, `unpackRgba`, `parseHex`, `toHex`) are the only code that knows the layout. A test checks the byte order against a `Uint8Array` view of the same memory.

## Alternatives considered

- **`Uint8ClampedArray` with 4 entries per pixel.** Direct for canvas, but comparing, copying and filling a pixel takes four operations instead of one.
- **Palette indices (`Uint8Array`).** Compact, but forces indexed color on every sprite and makes alpha and layers harder.
- **Objects per pixel.** Far too slow and heavy at 1024×1024.

## Consequences

- Comparing colors is `===`, and a flood fill or patch moves one 32-bit word per pixel.
- The layout assumes a little-endian CPU. That is true of every browser target in practice; a big-endian machine would fail the byte-order test instead of corrupting colors silently.
- `PixelBuffer.data` is typed `Uint32Array<ArrayBuffer>` so it can back an `ImageData` without a type escape hatch.
