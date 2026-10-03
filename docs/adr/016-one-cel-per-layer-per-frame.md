# ADR 016: One cel per layer per frame

- Status: Accepted
- Phase: 5

## Context

Phase 5 adds animation. A sprite needs several frames, each with its own picture, and everything built so far (tools, layers, history, selection, floating content, rendering) was written for a single picture per layer.

## Decision

- **Model.** A sprite has a list of frames (`{ id, duration }`) and every layer has one pixel buffer, a _cel_, for each frame: `Layer.cels[frameIndex]`. Frames are not layers; there is no per-frame layer structure, so adding a layer adds a blank cel in every frame and deleting a layer deletes its cels.
- **`Layer.buffer` stays.** It is always the same object as `cels[activeFrame]`. Tools, the renderer and the history keep reading and writing `layer.buffer` and need no change. Switching frame replaces each layer's `buffer` pointer (`setActiveFrame`), which is cheap because the pixels are shared, not copied.
- **Frame edits are document state.** Adding, duplicating, deleting, reordering and retiming frames are pure functions on the document state (`document/frame-ops.ts`) and use the same `StateCommand` machinery as layers (ADR 010). The active frame belongs to the state but changing it is not a history step.
- **Pixel edits remember their frame.** A pixel command is wrapped in a `FrameScopedCommand` that holds the frame id (not its index, since frames can be reordered). Undoing or redoing it first shows that frame, so the change is always visible.
- **Layer operations act on every frame.** Merge down, flatten and replace color work cel by cel and are still one undo step.
- **Playback never touches the document.** The player (`adapters/playback.ts`) only tells the renderer which frame to draw; the renderer composites that frame itself. Nothing is added to the history and nothing is saved while playing.
- **Limits.** At most 128 frames and 256 MB of pixels in total (`width × height × 4 × layers × frames`). Going over either is refused with a message instead of failing later. Durations are whole multiples of 10 ms between 20 ms and 10 s, which is what a GIF can store.
- **Formats.** `.vidopix` moves to schema version 2 (`frames`, and a list of cels per layer) with a migration from version 1 that makes a one-frame animation; the share link format gains a version byte 2 and still reads version 1. Both migrations are tested against files written by version 1.0.0.

## Alternatives considered

- **Frames as groups of layers** (each frame owns its own layer list). Makes layers per frame inconsistent and layer editing much harder to explain.
- **Replacing `buffer` with `cels[activeFrame]` everywhere.** Touches every tool and the renderer for no gain.
- **Storing frames as diffs against the previous one.** Saves memory for long animations but complicates every read; the 256 MB cap is enough for the sizes pixel art uses.

## Consequences

- Memory grows with `layers × frames`. A 64×64 sprite with 8 layers and 128 frames is 16 MB; a 1024×1024 one reaches the cap with 64 cels.
- Any code that replaces a layer must carry `cels` along and keep `buffer` pointing at the active cel; the document state helpers do this.
- A `.vidopix` file with many frames is larger (base64 of every cel) and can reach the 20 MB limit sooner than before.
