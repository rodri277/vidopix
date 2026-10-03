# ADR 009: Whole-number scale in device pixels

- Status: Accepted
- Phase: 1

## Context

Pixel art must look sharp. If one art pixel covers a fractional number of device pixels (for example zoom 3 at a device pixel ratio of 1.5), some pixels render wider than others.

## Decision

- The zoom the user sees is a whole number of CSS pixels per art pixel (1× to 64×). The renderer draws in device pixels with `scale = max(1, round(zoom × devicePixelRatio))`, a whole number, and pans in whole device pixels.
- Pointer positions are converted with the same scale and pan, so what is drawn and what is hit-tested always agree.
- The pure zoom/pan math (`zoomAt`, `fitViewport`, `screenToDocument`) lives in the core and is property-tested; the renderer only applies it.
- All canvas content is drawn with `imageSmoothingEnabled = false`. Assets are never inlined by the bundler, so the Content Security Policy can stay `default-src 'self'` (fonts are files, not `data:` URIs).

## Consequences

- At fractional device pixel ratios the visible zoom can be a few percent off the nominal one; pixels stay uniform.
- Canvases are as large as the view in device pixels and only the visible part of the sprite is drawn, so a 1024×1024 sprite at 64× costs no more than a small one.
