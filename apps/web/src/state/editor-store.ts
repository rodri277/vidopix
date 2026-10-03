import {
  centerViewport,
  fitViewport,
  nextZoom,
  screenToDocument,
  zoomAt,
  type BlockReason,
  type Color,
  type ColorSlot,
  type EditorSession,
  type Layer,
  type PixelBuffer,
  type Rect,
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

/** Moves images between the app and the operating system clipboard. */
export interface SystemClipboard {
  writeImage(image: PixelBuffer): Promise<void>;
  /** The image on the system clipboard, or null when there is none. */
  readImage(): Promise<PixelBuffer | null>;
}

const NOTICE_MILLISECONDS = 3500;

const BLOCKED_MESSAGES: Readonly<Record<BlockReason, string>> = {
  'layer-locked': 'The active layer is locked',
  'layer-hidden': 'The active layer is hidden',
  'nothing-selected': 'Nothing is selected',
  'single-layer': 'A sprite needs at least one layer',
  'color-in-palette': 'That color is already in the palette',
  'palette-full': 'The palette is full (256 colors)',
};

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
  /** Layers from bottom to top. */
  readonly layers: readonly Layer[];
  readonly activeLayerId: string;
  readonly selection: Rect | null;
  /** Content lifted or pasted that has not been dropped yet. */
  readonly hasFloating: boolean;
  /** Text for the screen-reader live region. */
  readonly announcement: string;
  /** Short message for the status bar, such as why an action was refused. */
  readonly notice: string;

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
  addLayer(): void;
  duplicateLayer(): void;
  deleteLayer(): void;
  mergeDown(): void;
  flatten(): void;
  setActiveLayer(id: string): void;
  renameLayer(id: string, name: string): void;
  moveLayer(id: string, toIndex: number): void;
  /** Moves the active layer up (+1) or down (-1) in the stack. */
  shiftActiveLayer(delta: 1 | -1): void;
  setLayerVisible(id: string, visible: boolean): void;
  setLayerLocked(id: string, locked: boolean): void;
  previewLayerOpacity(id: string, opacity: number): void;
  commitLayerOpacity(id: string, opacity: number): void;
  selectAll(): void;
  deselect(): void;
  deleteSelection(): void;
  commitFloating(): void;
  copy(): void;
  cut(): void;
  paste(): Promise<void>;
  pasteImage(image: PixelBuffer): void;
  /** Pastes what was last copied inside the app. */
  pasteInternal(): void;
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
export function createEditorStore(session: EditorSession, clipboard: SystemClipboard): EditorStore {
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const showNotice = (message: string): void => {
    clearTimeout(noticeTimer);
    store.setState({ notice: message, announcement: message });
    noticeTimer = setTimeout(() => {
      store.setState({ notice: '' });
    }, NOTICE_MILLISECONDS);
  };

  /** Where pasted content lands: the middle of what is on screen, kept inside the sprite. */
  const pasteCenter = (): { x: number; y: number } => {
    const { viewport, viewSize, spriteWidth, spriteHeight } = store.getState();
    const point = screenToDocument(viewport, viewSize.width / 2, viewSize.height / 2);
    const inside = point.x >= 0 && point.y >= 0 && point.x < spriteWidth && point.y < spriteHeight;
    return inside ? point : { x: spriteWidth / 2, y: spriteHeight / 2 };
  };

  const copyToSystem = (image: PixelBuffer): void => {
    clipboard.writeImage(image).catch(() => {
      showNotice('Copied inside Vidopix only; the browser blocked the system clipboard');
    });
  };

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
    layers: session.sprite.layers,
    activeLayerId: session.activeLayer.id,
    selection: null,
    hasFloating: false,
    announcement: '',
    notice: '',

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
    addLayer: () => {
      session.document.addLayer();
    },
    duplicateLayer: () => {
      session.document.duplicateLayer();
    },
    deleteLayer: () => {
      session.document.deleteLayer();
    },
    mergeDown: () => {
      session.document.mergeDown();
    },
    flatten: () => {
      session.document.flatten();
    },
    setActiveLayer: (id) => {
      session.document.setActiveLayer(id);
    },
    renameLayer: (id, name) => {
      session.document.renameLayer(id, name);
    },
    moveLayer: (id, toIndex) => {
      session.document.moveLayer(id, toIndex);
    },
    shiftActiveLayer: (delta) => {
      const { layers, activeLayerId } = get();
      const index = layers.findIndex((layer) => layer.id === activeLayerId);
      if (index >= 0) session.document.moveLayer(activeLayerId, index + delta);
    },
    setLayerVisible: (id, visible) => {
      session.document.setLayerVisible(id, visible);
    },
    setLayerLocked: (id, locked) => {
      session.document.setLayerLocked(id, locked);
    },
    previewLayerOpacity: (id, opacity) => {
      session.document.previewLayerOpacity(id, opacity);
    },
    commitLayerOpacity: (id, opacity) => {
      session.document.setLayerOpacity(id, opacity);
    },
    selectAll: () => {
      session.cancelStroke();
      session.document.selectAll();
    },
    deselect: () => {
      session.cancelStroke();
      session.document.deselect();
    },
    deleteSelection: () => {
      session.cancelStroke();
      session.document.deleteSelection();
    },
    commitFloating: () => {
      session.document.commitFloating();
    },
    copy: () => {
      const pixels = session.document.copySelection();
      if (pixels) copyToSystem(pixels);
    },
    cut: () => {
      session.cancelStroke();
      const pixels = session.document.cutSelection();
      if (pixels) copyToSystem(pixels);
    },
    paste: async () => {
      let image: PixelBuffer | null = null;
      try {
        image = await clipboard.readImage();
      } catch {
        // Permission denied or unsupported: fall back to the app's own clipboard.
      }
      if (image) session.pasteBuffer(image, pasteCenter());
      else get().pasteInternal();
    },
    pasteInternal: () => {
      if (!session.paste(pasteCenter())) showNotice('Nothing to paste');
    },
    pasteImage: (image) => {
      session.pasteBuffer(image, pasteCenter());
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
  session.on('layersChanged', ({ sprite, activeLayerId }) => {
    store.setState({ layers: sprite.layers, activeLayerId });
  });
  session.on('selectionChanged', ({ selection }) => {
    store.setState({ selection });
  });
  session.on('floatingChanged', ({ floating }) => {
    store.setState({ hasFloating: floating !== null });
  });
  session.on('actionBlocked', ({ reason }) => {
    showNotice(BLOCKED_MESSAGES[reason]);
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
