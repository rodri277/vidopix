import {
  centerViewport,
  fitViewport,
  nextZoom,
  PALETTE_PRESETS,
  presetToColors,
  screenToDocument,
  zoomAt,
  type Color,
  type ColorSlot,
  type EditorSession,
  type Frame,
  type Layer,
  type Palette,
  type PaletteColor,
  type PixelBuffer,
  type Rect,
  type ToolId,
  type ToolOptions,
  type Viewport,
} from '@vidopix/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  DEFAULT_LANGUAGE,
  translate,
  type Language,
  type MessageKey,
  type MessageParams,
} from '../i18n';
import { HISTORY_LABEL_KEYS } from '../i18n/history-labels';
import type { SaveStatus } from './persistence';

export type DialogId =
  | 'new-sprite'
  | 'export'
  | 'extract-palette'
  | 'replace-color'
  | 'recent-projects'
  | 'share'
  | 'shortcuts';

/** What loading a preset or an imported palette does to the sprite's palette. */
export type PaletteLoadMode = 'replace' | 'append';

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
  /** Frames in playing order, and which one is being edited. */
  readonly frames: readonly Frame[];
  readonly activeFrame: number;
  /** Counts changes to the pixels, so thumbnails know when to redraw. Throttled. */
  readonly contentRevision: number;
  readonly selection: Rect | null;
  /** Content lifted or pasted that has not been dropped yet. */
  readonly hasFloating: boolean;
  readonly palette: Palette;
  /** Text for the screen-reader live region. */
  readonly announcement: string;
  /** Short message for the status bar, such as why an action was refused. */
  readonly notice: string;

  // UI only
  readonly editingSlot: ColorSlot;
  readonly language: Language;
  readonly saveStatus: SaveStatus;
  /** Why saving failed, when it did. */
  readonly saveDetail: string;
  /** A new version of the app is downloaded and waiting. */
  readonly updateReady: boolean;
  readonly paletteMode: PaletteLoadMode;
  readonly viewport: Viewport;
  readonly viewSize: { readonly width: number; readonly height: number };
  readonly showGrid: boolean;
  readonly panelsHidden: boolean;
  readonly dialog: DialogId | null;
  readonly cursor: Point | null;
  readonly keyboardCursor: Point | null;
  /** Space is held: dragging pans instead of drawing. */
  readonly panMode: boolean;
  /** The animation is playing; `playFrame` is the frame on screen. Nothing in the document changes. */
  readonly playing: boolean;
  readonly playFrame: number;
  readonly onionPrevious: boolean;
  readonly onionNext: boolean;
  /** 0.1 to 0.8 */
  readonly onionOpacity: number;
}

export interface EditorActions {
  /** Looks a text up in the current language. */
  t(key: MessageKey, params?: MessageParams): string;
  setLanguage(language: Language): void;
  setSaveStatus(status: SaveStatus, detail?: string): void;
  setUpdateReady(ready: boolean): void;
  renameSprite(name: string): void;
  /** Shows a short message in the status bar and announces it to screen readers. */
  notify(message: string): void;
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
  addColorToPalette(color?: Color): void;
  /** Sets the primary (or secondary) color from a palette entry. */
  pickPaletteColor(index: number, slot: ColorSlot): void;
  removePaletteColor(index: number): void;
  movePaletteColor(from: number, to: number): void;
  renamePaletteColor(index: number, name: string): void;
  renamePalette(name: string): void;
  setPaletteMode(mode: PaletteLoadMode): void;
  loadPreset(id: string): void;
  /** Applies colors from an import or an extraction, following the current loading mode. */
  loadPaletteColors(name: string | undefined, colors: readonly PaletteColor[]): void;
  addColorsToPalette(colors: readonly Color[]): void;
  replaceColor(from: Color, to: Color): number;
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
  setActiveFrame(index: number): void;
  /** Moves the active frame by a distance, stopping at the ends. */
  stepFrame(delta: number): void;
  addFrame(): void;
  duplicateFrame(): void;
  deleteFrame(): void;
  moveFrame(from: number, to: number): void;
  setFrameDuration(index: number, milliseconds: number): void;
  /** Gives every frame the duration that plays at this many frames per second. */
  setFps(fps: number): void;
  togglePlayback(): void;
  stopPlayback(): void;
  /** Called by the player for each frame it shows. */
  setPlayFrame(index: number): void;
  toggleOnionPrevious(): void;
  toggleOnionNext(): void;
  setOnionOpacity(opacity: number): void;
}

export const MIN_FPS = 1;
export const MAX_FPS = 50;
export const ONION_OPACITY_RANGE = { min: 0.1, max: 0.8, default: 0.4 } as const;
const CONTENT_REVISION_DELAY = 120;

export type EditorStore = StoreApi<EditorState & EditorActions>;

const INITIAL_VIEW_SIZE = { width: 800, height: 600 };

/**
 * UI state for the editor. Document state lives in the core's `EditorSession`; this store mirrors
 * the parts the interface needs to render and adds view-only state such as zoom and dialogs.
 */
export function createEditorStore(
  session: EditorSession,
  clipboard: SystemClipboard,
  initialLanguage: Language = DEFAULT_LANGUAGE,
  onLanguageChange: (language: Language) => void = () => undefined,
): EditorStore {
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let revisionTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (key: MessageKey, params?: MessageParams): string =>
    translate(store.getState().language, key, params);
  const labelText = (label: string): string => {
    const key = HISTORY_LABEL_KEYS[label];
    return key ? say(key) : label;
  };
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
      showNotice(say('notice.copyBlocked'));
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
    frames: session.sprite.frames,
    activeFrame: session.document.activeFrame,
    contentRevision: 0,
    selection: null,
    hasFloating: false,
    palette: session.document.palette,
    announcement: '',
    notice: '',

    editingSlot: 'primary',
    language: initialLanguage,
    saveStatus: 'saved',
    saveDetail: '',
    updateReady: false,
    paletteMode: 'replace',
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
    playing: false,
    playFrame: 0,
    onionPrevious: false,
    onionNext: false,
    onionOpacity: ONION_OPACITY_RANGE.default,

    t: (key, params) => translate(get().language, key, params),
    setLanguage: (language) => {
      set({ language });
      onLanguageChange(language);
    },
    setSaveStatus: (saveStatus, detail = '') => {
      set({ saveStatus, saveDetail: detail });
    },
    renameSprite: (name) => {
      session.document.renameSprite(name);
    },
    setUpdateReady: (updateReady) => {
      set({ updateReady });
    },
    notify: (message) => {
      showNotice(message);
    },
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
    addColorToPalette: (color) => {
      const { editingSlot, primary, secondary } = get();
      session.document.addPaletteColor(color ?? (editingSlot === 'primary' ? primary : secondary));
    },
    pickPaletteColor: (index, slot) => {
      const entry = get().palette.colors[index];
      if (entry) session.setColor(slot, entry.color);
    },
    removePaletteColor: (index) => {
      session.document.removePaletteColor(index);
    },
    movePaletteColor: (from, to) => {
      session.document.movePaletteColor(from, to);
    },
    renamePaletteColor: (index, name) => {
      session.document.renamePaletteColor(index, name);
    },
    renamePalette: (name) => {
      session.document.renamePalette(name);
    },
    setPaletteMode: (paletteMode) => {
      set({ paletteMode });
    },
    loadPreset: (id) => {
      const preset = PALETTE_PRESETS.find((candidate) => candidate.id === id);
      if (preset) get().loadPaletteColors(preset.name, presetToColors(preset));
    },
    loadPaletteColors: (name, colors) => {
      if (get().paletteMode === 'append') {
        session.document.appendPaletteColors(colors);
      } else {
        session.document.loadPalette(name ?? session.document.palette.name, colors);
      }
    },
    addColorsToPalette: (colors) => {
      session.document.appendPaletteColors(colors.map((color) => ({ color })));
    },
    replaceColor: (from, to) => {
      const changed = session.document.replaceColor(from, to);
      showNotice(
        changed === 0
          ? say('notice.colorMissing')
          : changed === 1
            ? say('notice.replacedOne')
            : say('notice.replacedMany', { count: changed }),
      );
      return changed;
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
      if (!session.paste(pasteCenter())) showNotice(say('notice.nothingToPaste'));
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
    setActiveFrame: (index) => {
      get().stopPlayback();
      session.cancelStroke();
      session.document.setActiveFrame(index);
    },
    stepFrame: (delta) => {
      const { activeFrame, frames } = get();
      const next = Math.min(frames.length - 1, Math.max(0, activeFrame + delta));
      if (next !== activeFrame) get().setActiveFrame(next);
    },
    addFrame: () => {
      get().stopPlayback();
      session.cancelStroke();
      session.document.addFrame();
    },
    duplicateFrame: () => {
      get().stopPlayback();
      session.cancelStroke();
      session.document.duplicateFrame();
    },
    deleteFrame: () => {
      get().stopPlayback();
      session.cancelStroke();
      session.document.deleteFrame();
    },
    moveFrame: (from, to) => {
      get().stopPlayback();
      session.cancelStroke();
      session.document.moveFrame(from, to);
    },
    setFrameDuration: (index, milliseconds) => {
      session.document.setFrameDuration(index, milliseconds);
    },
    setFps: (fps) => {
      if (!Number.isFinite(fps)) return;
      const clamped = Math.min(MAX_FPS, Math.max(MIN_FPS, fps));
      session.document.setAllFrameDurations(1000 / clamped);
    },
    togglePlayback: () => {
      if (get().playing) {
        get().stopPlayback();
        return;
      }
      session.cancelStroke();
      session.document.commitFloating();
      set({ playing: true, playFrame: get().activeFrame });
    },
    stopPlayback: () => {
      if (get().playing) set({ playing: false });
    },
    setPlayFrame: (playFrame) => {
      if (get().playFrame !== playFrame) set({ playFrame });
    },
    toggleOnionPrevious: () => {
      set({ onionPrevious: !get().onionPrevious });
    },
    toggleOnionNext: () => {
      set({ onionNext: !get().onionNext });
    },
    setOnionOpacity: (opacity) => {
      const { min, max } = ONION_OPACITY_RANGE;
      set({ onionOpacity: Math.min(max, Math.max(min, opacity)) });
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
        ? say('history.undid', { label: labelText(label) })
        : cause === 'redo' && label
          ? say('history.redid', { label: labelText(label) })
          : store.getState().announcement;
    store.setState({ canUndo, canRedo, undoLabel, redoLabel, announcement });
  });
  session.on('layersChanged', ({ sprite, activeLayerId }) => {
    store.setState({ layers: sprite.layers, activeLayerId });
  });
  session.on('framesChanged', ({ frames, activeFrame }) => {
    const previous = store.getState();
    const changedFrame = previous.activeFrame !== activeFrame && previous.frames.length > 0;
    const duration = frames[activeFrame]?.duration ?? 0;
    store.setState({
      frames,
      activeFrame,
      ...(changedFrame
        ? {
            announcement: say('timeline.frameInfo', {
              number: activeFrame + 1,
              total: frames.length,
              duration,
            }),
          }
        : {}),
    });
  });
  session.on('documentChanged', () => {
    if (revisionTimer !== undefined) return;
    revisionTimer = setTimeout(() => {
      revisionTimer = undefined;
      store.setState({ contentRevision: store.getState().contentRevision + 1 });
    }, CONTENT_REVISION_DELAY);
  });
  session.on('paletteChanged', ({ palette }) => {
    store.setState({ palette });
  });
  session.on('selectionChanged', ({ selection }) => {
    store.setState({ selection });
  });
  session.on('floatingChanged', ({ floating }) => {
    store.setState({ hasFloating: floating !== null });
  });
  session.on('actionBlocked', ({ reason }) => {
    showNotice(say(`blocked.${reason}`));
  });
  session.on('spriteReplaced', ({ sprite }) => {
    const state = store.getState();
    store.setState({
      playing: false,
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
