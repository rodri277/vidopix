import {
  centerViewport,
  fitViewport,
  nextZoom,
  zoomAt,
  type Color,
  type ColorSlot,
  type EditorSession,
  type ToolId,
  type ToolOptions,
  type Viewport,
} from '@vidopix/core';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type DialogId = 'new-sprite' | 'export';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface EditorState {
  // Mirrored from the session
  readonly tool: ToolId;
  readonly primary: Color;
  readonly secondary: Color;
  readonly options: ToolOptions;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
  readonly spriteName: string;
  readonly spriteWidth: number;
  readonly spriteHeight: number;
  /** Increases every time the document is replaced. */
  readonly spriteVersion: number;
  /** Text for the screen-reader live region. */
  readonly announcement: string;

  // UI only
  readonly editingSlot: ColorSlot;
  readonly viewport: Viewport;
  readonly viewSize: { readonly width: number; readonly height: number };
  readonly showGrid: boolean;
  readonly panelsHidden: boolean;
  readonly dialog: DialogId | null;
  readonly cursor: Point | null;
  readonly keyboardCursor: Point | null;
  /** Space is held: dragging pans instead of drawing. */
  readonly panMode: boolean;
}

export interface EditorActions {
  selectTool(tool: ToolId): void;
  setColor(slot: ColorSlot, color: Color): void;
  setEditingSlot(slot: ColorSlot): void;
  swapColors(): void;
  setToolOptions(changes: Partial<ToolOptions>): void;
  adjustBrushSize(delta: number): void;
  undo(): void;
  redo(): void;
  setViewport(viewport: Viewport): void;
  setViewSize(width: number, height: number): void;
  zoomStep(direction: 1 | -1, anchor?: Point): void;
  zoomTo(zoom: number, anchor?: Point): void;
  fitToView(): void;
  toggleGrid(): void;
  togglePanels(): void;
  openDialog(dialog: DialogId): void;
  closeDialog(): void;
  setCursor(cursor: Point | null): void;
  setKeyboardCursor(cursor: Point | null): void;
  setPanMode(active: boolean): void;
}

export type EditorStore = StoreApi<EditorState & EditorActions>;

const INITIAL_VIEW_SIZE = { width: 800, height: 600 };

/**
 * UI state for the editor. Document state lives in the core's `EditorSession`; this store mirrors
 * the parts the interface needs to render and adds view-only state such as zoom and dialogs.
 */
export function createEditorStore(session: EditorSession): EditorStore {
  const store = createStore<EditorState & EditorActions>((set, get) => ({
    tool: session.activeTool,
    primary: session.primaryColor,
    secondary: session.secondaryColor,
    options: session.toolOptions,
    canUndo: session.canUndo,
    canRedo: session.canRedo,
    undoLabel: null,
    redoLabel: null,
    spriteName: session.sprite.name,
    spriteWidth: session.sprite.width,
    spriteHeight: session.sprite.height,
    spriteVersion: 0,
    announcement: '',

    editingSlot: 'primary',
    viewport: centerViewport(
      1,
      INITIAL_VIEW_SIZE.width,
      INITIAL_VIEW_SIZE.height,
      session.sprite.width,
      session.sprite.height,
    ),
    viewSize: INITIAL_VIEW_SIZE,
    showGrid: true,
    panelsHidden: false,
    dialog: null,
    cursor: null,
    keyboardCursor: null,
    panMode: false,

    selectTool: (tool) => {
      session.setActiveTool(tool);
    },
    setColor: (slot, color) => {
      session.setColor(slot, color);
    },
    setEditingSlot: (editingSlot) => {
      set({ editingSlot });
    },
    swapColors: () => {
      session.swapColors();
    },
    setToolOptions: (changes) => {
      session.setToolOptions(changes);
    },
    adjustBrushSize: (delta) => {
      session.setToolOptions({ brushSize: session.toolOptions.brushSize + delta });
    },
    undo: () => {
      session.undo();
    },
    redo: () => {
      session.redo();
    },

    setViewport: (viewport) => {
      set({ viewport });
    },
    setViewSize: (width, height) => {
      const previous = get().viewSize;
      if (previous.width === width && previous.height === height) return;
      set({ viewSize: { width, height } });
    },
    zoomStep: (direction, anchor) => {
      get().zoomTo(nextZoom(get().viewport.zoom, direction), anchor);
    },
    zoomTo: (zoom, anchor) => {
      const { viewport, viewSize } = get();
      const point = anchor ?? { x: viewSize.width / 2, y: viewSize.height / 2 };
      set({ viewport: zoomAt(viewport, zoom, point.x, point.y) });
    },
    fitToView: () => {
      const { viewSize, spriteWidth, spriteHeight } = get();
      set({ viewport: fitViewport(viewSize.width, viewSize.height, spriteWidth, spriteHeight) });
    },

    toggleGrid: () => {
      set({ showGrid: !get().showGrid });
    },
    togglePanels: () => {
      set({ panelsHidden: !get().panelsHidden });
    },
    openDialog: (dialog) => {
      session.cancelStroke();
      set({ dialog });
    },
    closeDialog: () => {
      set({ dialog: null });
    },
    setCursor: (cursor) => {
      const previous = get().cursor;
      if (previous?.x === cursor?.x && previous?.y === cursor?.y) return;
      set({ cursor });
    },
    setKeyboardCursor: (keyboardCursor) => {
      set({ keyboardCursor });
    },
    setPanMode: (panMode) => {
      if (get().panMode !== panMode) set({ panMode });
    },
  }));

  session.on('toolChanged', ({ tool }) => {
    store.setState({ tool });
  });
  session.on('colorsChanged', ({ primary, secondary }) => {
    store.setState({ primary, secondary });
  });
  session.on('optionsChanged', ({ options }) => {
    store.setState({ options });
  });
  session.on('historyChanged', ({ canUndo, canRedo, undoLabel, redoLabel, cause, label }) => {
    const announcement =
      cause === 'undo' && label
        ? `Undid: ${label}`
        : cause === 'redo' && label
          ? `Redid: ${label}`
          : store.getState().announcement;
    store.setState({ canUndo, canRedo, undoLabel, redoLabel, announcement });
  });
  session.on('spriteReplaced', ({ sprite }) => {
    const state = store.getState();
    store.setState({
      spriteName: sprite.name,
      spriteWidth: sprite.width,
      spriteHeight: sprite.height,
      spriteVersion: state.spriteVersion + 1,
      keyboardCursor: null,
      viewport: fitViewport(
        state.viewSize.width,
        state.viewSize.height,
        sprite.width,
        sprite.height,
      ),
    });
  });

  return store;
}
