# ADR 007: A versioned project format with migrations

- Status: Accepted
- Phase: 4 (schema version 2 added in Phase 5, see ADR 016)

## Context

Projects are saved in the browser, downloaded as files and opened again, possibly months later by a newer version of the app. The format has to survive that, and a damaged or hostile file must never crash the editor.

## Decision

- A `.vidopix` file is JSON: `{ "format": "vidopix", "schemaVersion": 1, "sprite": { ... } }`. Layers carry their pixels as base64 of R, G, B, A bytes (written in explicit byte order, so the file does not depend on the CPU).
- Reading goes through three steps. **Size** first (20 MB at most, before parsing). Then **version**: files from newer versions are refused with a clear message, files from older ones are upgraded one version at a time by `MIGRATIONS[n]`. Then **validation** with Zod: sprite size 1 to 1024, at most 64 layers, names, opacity, palette colors, and that each layer's pixel data has exactly `width × height × 4` bytes. Anything else returns a `Result` error; nothing throws.
- Unknown extra fields are ignored, so a minor addition does not break older readers.
- The format code lives in `@vidopix/core/project-formats`, a separate entry point, so the app downloads the validator only when it first needs to save or open something. Zod runs without `new Function` (`jitless`), which the Content Security Policy forbids.
- The same file text is what autosave puts in IndexedDB, so there is one format to get right.

## Alternatives considered

- **PNG with a metadata chunk.** Opens in any viewer, but layers and palette are awkward to carry.
- **Binary format.** Smaller, but harder to inspect, diff and migrate. Size is not the limiting factor at 20 MB.

## Consequences

- Version 2 (Phase 5) replaces each layer's `pixels` with a list of `cels`, one per frame, and adds `frames`; `MIGRATIONS[1]` turns a version 1 file into a one-frame animation.
- Changing the schema means bumping `PROJECT_SCHEMA_VERSION` and adding one migration step with a test.
- Base64 makes files about a third larger than the raw pixels; a 256×256 project with eight layers is around 2 MB.
