# Architecture

Vidopix follows ports and adapters: a DOM-free engine in `packages/core` and a React app in `apps/web` that only paints and translates events. See [ADR 001](adr/001-monorepo-and-dom-free-core.md) and [SPEC.md](../SPEC.md) section 4.

## Layers

```mermaid
flowchart LR
  subgraph web["apps/web (browser)"]
    UI["React features"]
    State["UI state (Zustand)"]
    Adapters["Adapters: CanvasRenderer, IdbStorage, workers, file IO"]
  end
  subgraph core["packages/core (pure TypeScript)"]
    Session["EditorSession (facade)"]
    Tools["Tools (strategy)"]
    History["Commands + HistoryManager"]
    Domain["Sprite, Layer, PixelBuffer, Palette, Color"]
    Ports["Ports: Renderer, Storage, IdGenerator"]
  end
  UI --> Session
  UI --> State
  Session --> Tools --> History --> Domain
  Session -- "typed events" --> UI
  Adapters -. implement .-> Ports
  Session --> Ports
```

Arrows only go down into the core or come out of it as events. The core never knows about React or the browser.

## Current state (Phase 2)

The engine in `packages/core` has the document model, algorithms, tools, history, color math, export and viewport math. `DocumentEditor` owns the layers, the selection, floating (moved or pasted) content, the clipboard and the history; `EditorSession` adds the tools, colors and pointer input on top (ADR 010, ADR 011). `apps/web` has the Canvas 2D renderer, pointer and keyboard input, the menus, the layers and color panels, and the dialogs. Palettes, persistence and animation arrive in later phases.

## Lifecycle of a stroke

1. The pointer adapter receives Pointer Events (including coalesced samples, with pointer capture) and converts screen coordinates to document pixels using the renderer's whole-number scale.
2. `EditorSession` forwards the event to the active tool.
3. The tool writes pixels through a `PatchRecorder`, which remembers the original color of each pixel; successive samples are joined with Bresenham so fast moves leave no gaps.
4. The session emits `documentChanged` with the dirty rectangle.
5. The renderer recomposes only that area (`compositeRegion`) and redraws it on the next `requestAnimationFrame`.
6. On `pointerup` the recorder closes into a `PixelPatch` and enters the history as a single command (ADR 004).

## Boundaries enforced in CI

- `core` imports nothing from `apps/` and no UI or browser-bound library.
- `features/*` do not import each other; they share code through `state/` or `design-system/`.
- No circular dependencies.

Run them with `pnpm lint`. `tools/check-boundaries.test.mjs` verifies that the rules do fail on violations.

## Keyboard drawing

The canvas is a focusable widget. Arrow keys move a pixel cursor (Alt moves 8 pixels), and holding Enter behaves like pressing the primary mouse button: it starts a stroke, arrow keys extend it, releasing Enter ends it. Escape cancels the stroke. This goes through the same `EditorSession` calls as the mouse.

## Layers and floating content

Document state that is not pixels (layers, active layer, selection) is one immutable value replaced on each change, with pixel buffers shared between versions (ADR 010). Moving or pasting pixels is a single open transaction: the content floats above the layer until it is dropped, and a cancel puts everything back (ADR 011). Every edit first drops floating content, so the history never sees a half-finished move.
