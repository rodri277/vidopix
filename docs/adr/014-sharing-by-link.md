# ADR 014: Sharing a sprite inside the link

- Status: Accepted
- Phase: 4

## Context

There is no backend, so a shared sprite cannot be uploaded anywhere. It has to travel inside the link itself.

## Decision

- The link is `…/#s=<data>`. The data is a compact binary form of the sprite (magic bytes, version, sizes, palette, per-layer flags, opacity, name and RGBA pixels), compressed with the browser's `CompressionStream('deflate-raw')` and written as base64url. It lives in the fragment, so it is never sent to any server.
- A link is offered only up to 6000 characters, because chat apps and some servers truncate long URLs. Above that, the dialog says so and points to saving a `.vidopix` file.
- Opening a link imports the sprite as a **new project** and removes the fragment from the address, so the user's own work is not replaced and reloading does not import it a second time.
- Decoding is defensive: the declared size is checked against a 4 MB limit before anything is allocated, decompression stops at that limit, and every truncated or damaged link returns an error instead of throwing. Tests feed every prefix of a valid link and random bytes to the decoder.
- Identifiers are not part of the link; fresh ones are generated on opening.

## Alternatives considered

- **Putting the `.vidopix` JSON in the link.** Base64 of raw pixels is too long even for small sprites.
- **A hosted short-link service.** Would add a server, an account and privacy questions this project avoids.

## Consequences

- Flat-color pixel art compresses well; a 32×32 sprite with a few layers is a few hundred characters. Noisy or large sprites will not fit and need the file.
- Browsers without `CompressionStream` cannot create or open links; the dialog says so.
