# ADR 004: History by pixel patches with a memory budget

- Status: Accepted
- Phase: 1

## Context

Undo and redo must be exact (byte for byte) and cheap, from a one-pixel click to a flood fill of a 1024×1024 canvas. A fixed number of steps (say 100) is the wrong limit: a hundred small strokes cost kilobytes, a hundred full-canvas fills cost hundreds of megabytes.

## Decision

- Every operation is a `Command` with `apply`, `revert`, `label` and `sizeBytes`.
- A whole stroke is one command: pointer moves accumulate in a `PatchRecorder` and close on pointer up.
- A `PixelPatch` stores what changed in whichever form is cheaper: a **sparse** list (index, before, after: 12 bytes per changed pixel) or the **bounding rectangle** before and after (8 bytes per pixel of the box). The recorder remembers the original color on the first touch of each pixel, so painting a pixel twice in a stroke still reverts correctly.
- `HistoryManager` limits memory, not steps: 64 MB by default. When exceeded, the oldest undo steps are dropped; the newest always stays. Recording a new command empties the redo stack.

## Alternatives considered

- **Full snapshots.** Simple, but a 1024×1024 snapshot is 4 MB per step.
- **Inverse operations.** Not exact for tools like fill that depend on what was underneath.

## Consequences

- A property test applies random edits, undoes all of them and checks the buffer is identical; another does 500 strokes on 256×256 within the budget.
- Operations that are not pixel edits (layers in Phase 2) become other `Command` implementations with no change to the history.
