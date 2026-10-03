# ADR 010: Layers and selection as a replaceable document state

- Status: Accepted
- Phase: 2

## Context

Phase 2 adds layers (add, delete, duplicate, rename, reorder, hide, lock, opacity, merge, flatten) and a selection. Every one of these must be undoable, and none of them should make the history expensive: moving a layer in the list must not copy any pixels.

## Decision

- Everything that is not pixel data lives in one immutable value, `DocumentState`: the sprite (with its layer list), the active layer id and the selection. Layer edits are pure functions that return a new state (`layer-ops.ts`), or the same object when nothing changes.
- Layer pixel buffers are mutable and **shared** between states. A layer property change, a reorder, or a selection change therefore costs a few object references, not a copy of the pixels.
- `StateCommand` undoes a change by swapping the whole state back. Only buffers that exist in one state and not the other (a deleted or newly created layer) are counted in `sizeBytes`, so they count against the 64 MB history budget.
- Merge down is a `CompoundCommand`: a pixel patch on the lower layer plus a state change, undone together.
- `DocumentEditor` owns the state, the history and the events; `EditorSession` keeps tools, colors and options and exposes the editor as `session.document`.
- Switching the active layer is deliberately **not** a history step; it is navigation, not an edit.

## Alternatives considered

- **Mutating the layer list in place with inverse operations.** Every operation needs a hand-written inverse, and a missed case corrupts undo.
- **Snapshotting pixels for every layer change.** Correct but costs megabytes per step.

## Consequences

- Adding a new layer-like feature means adding one pure function and one call; undo comes for free.
- The renderer only has to react to `documentChanged` and `layersChanged`; it never inspects history.
- Opacity sliders use a preview that is not recorded, then a single step when released, so dragging a slider leaves one history entry.
