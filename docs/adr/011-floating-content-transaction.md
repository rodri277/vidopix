# ADR 011: Moving and pasting as one open transaction

- Status: Accepted
- Phase: 2

## Context

Moving selected pixels and pasting both lift pixels off the layer and place them somewhere else, often after several drags. The user expects a single undo step for the whole operation, and expects Escape to put everything back.

## Decision

- Lifted or pasted pixels become **floating content**: a small pixel buffer with a position, drawn above the document by the renderer. It is not part of any layer until dropped.
- Lifting a selection erases its source area immediately through a `PatchRecorder`, which keeps the original colors. The transaction stays open while the content floats and can be dragged many times.
- **Dropping** blends the content onto the layer through the same recorder and closes it into one patch, plus a selection change if the selection moved, as a single `CompoundCommand`. **Canceling** reverts the recorded patch, so the layer is back exactly as it was.
- Floating content is dropped by Enter, by pressing outside of it, by switching tool, by any layer or selection edit, and before exporting. Undo while content floats cancels it instead of undoing an earlier step.
- The selection is a rectangle (`Rect | null`) in this phase. Moving content with transparent pixels blends over what is underneath rather than replacing it, so a mask is not needed yet; one will be added together with the first non-rectangular selection.
- Paste lands in the middle of the visible area and switches to the Move tool, so it can be dragged (or nudged with the arrow keys) before it is dropped.

## Alternatives considered

- **Committing on every mouse release.** Simple, but a placement adjustment would cost several history steps and make Escape meaningless.
- **Moving the pixels in the layer while dragging.** Needs a rollback buffer anyway and makes the renderer treat the layer as unstable.

## Consequences

- The renderer draws one extra image (the floating content) and the selection outline in the overlay; layers are untouched until the drop.
- Every code path that edits the document must first drop floating content. That rule lives in `DocumentEditor`, not in the callers.
- Copy and cut also write a PNG to the system clipboard when the browser allows it; the app keeps its own copy so copy and paste always work inside Vidopix.
