# ADR 017: GIF and spritesheet export

- Status: Accepted
- Phase: 5

## Context

An animation has to leave the editor as something other tools understand: an animated GIF for sharing, and a spritesheet with its coordinates for games. A GIF of many frames can take long enough to encode that doing it on the page would freeze the interface.

## Decision

- **Encoder.** `gifenc` (about 4 kB gzipped, no dependencies, MIT) writes the GIF. It lives in `packages/core` behind its own entry point, `@vidopix/core/gif`, so it can be tested with the rest of the engine and stays out of the first download. It ships no types; `src/types/gifenc.d.ts` declares the few functions used.
- **In a worker.** `gif.worker.ts` receives a copy of the pixels (transferred, not cloned), encodes and sends the bytes back with progress. The dialog shows the progress and a cancel button that terminates the worker. The spritesheet is built on the page: it only copies pixels and takes about a millisecond.
- **Palette.** A GIF has one palette of 256 colors. If all frames together use 255 or fewer colors (256 when nothing is transparent) the palette is exact and the result is lossless. Otherwise colors are reduced by `gifenc`'s quantizer from a sample of the pixels and every pixel is mapped to the nearest. Pixel art almost always takes the exact path.
- **Transparency.** A GIF has one transparent index and no partial alpha: pixels with at least 50 % alpha become opaque (their color kept), the rest transparent. With a transparent index every frame is written with "restore to background" disposal, so frames do not pile up. With a background color chosen in the dialog the frames are flattened onto it first and no transparency is written.
- **Timing and loop.** Each frame's duration is written in hundredths of a second (the durations are already multiples of 10 ms) and the loop count is infinite.
- **Spritesheet.** Frames are laid out left to right, top to bottom in a grid with a chosen number of columns (8 by default) and no padding. A JSON file lists `meta` (`image`, `size`, `frameCount`, `scale`) and, for each frame, `x`, `y`, `w`, `h` and `duration` in milliseconds. A test lays out sheets of random sizes and checks that every rectangle holds exactly that frame's pixels; an end-to-end test does the same with the downloaded files.
- Both formats use the same whole-number scale as the PNG export (1x to 32x, at most 16384 px per side).

## Alternatives considered

- **Encoding on the page.** Simpler, but an encode with many colors can take over half a second.
- **A hand-written encoder.** LZW is not hard, but a tested library is less to maintain.
- **WebCodecs / `canvas.toBlob('image/gif')`.** Browsers do not encode GIF; WebCodecs has no GIF encoder.
- **APNG or animated WebP.** Better quality, but sharing a GIF is still what most people want; they can be added later behind the same dialog.

## Consequences

- The quantized path is the slow one: about 0.5 s for 32 frames of 64×64 with thousands of different colors (an exact palette takes about 50 ms). It runs in the worker, so the page stays responsive.
- Two downloads (image and JSON) can make the browser ask for permission to download multiple files.
