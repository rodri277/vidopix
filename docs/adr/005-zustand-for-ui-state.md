# ADR 005: Zustand for UI state; the document lives in the core

- Status: Accepted
- Phase: 1

## Context

The interface needs reactive state (active tool, colors, zoom, open dialog, whether undo is available). The document itself, its history and the tools must not depend on React.

## Decision

- **Document state** (sprite, history, tool state) lives in `EditorSession` in `packages/core`. It exposes getters and typed events.
- **UI state** lives in a small Zustand store created per session (`createEditorStore`). It mirrors the few session values the interface renders, subscribing to session events, and adds view-only state (zoom and pan, grid, dialogs, hovered pixel).
- Components read it with selectors, so a change in zoom does not re-render the color panel.
- The renderer is not a React component tree: it subscribes to the store and the session directly and draws on canvases.

## Alternatives considered

- **React context and `useReducer`.** Would re-render large parts of the tree on every pointer move.
- **Storing the document in the store.** Would tie the engine to the UI framework and put large buffers through immutable updates.

## Consequences

- The store is easy to test and to create with a fake session.
- There are two sources of truth for a handful of values (tool, colors). The store never writes them itself; it calls the session and waits for the event, so they cannot drift.
