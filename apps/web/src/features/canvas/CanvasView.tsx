import { useEffect, useRef, type KeyboardEvent } from 'react';
import { CanvasRenderer, type CursorShape } from '../../adapters/canvas-renderer';
import { attachPointerInput } from '../../adapters/pointer-input';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './CanvasView.module.css';

const KEYBOARD_STEP = 1;
const KEYBOARD_BIG_STEP = 8;

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function CanvasView() {
  const { session, store } = useEditor();
  const viewportRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const keyboardStrokeRef = useRef(false);
  const panMode = useEditorState((state) => state.panMode);

  useEffect(() => {
    const viewport = viewportRef.current;
    const documentCanvas = documentRef.current;
    const gridCanvas = gridRef.current;
    const overlayCanvas = overlayRef.current;
    if (!viewport || !documentCanvas || !gridCanvas || !overlayCanvas) return;

    const renderer = new CanvasRenderer(
      { document: documentCanvas, overlay: overlayCanvas, grid: gridCanvas },
      session,
    );
    rendererRef.current = renderer;
    const detachPointer = attachPointerInput(viewport, renderer, session, store);

    let measured = false;
    const measure = (): void => {
      const { width, height } = viewport.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.resize(width, height, window.devicePixelRatio);
      store.getState().setViewSize(width, height);
      if (!measured) {
        measured = true;
        store.getState().fitToView();
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener('resize', measure);

    const cursorShape = (): CursorShape | null => {
      const { cursor, keyboardCursor, tool, options } = store.getState();
      const position = keyboardCursor ?? cursor;
      if (!position) return null;
      const sized = tool === 'pencil' || tool === 'eraser' || tool === 'line';
      return {
        x: position.x,
        y: position.y,
        size: sized ? options.brushSize : 1,
        keyboard: keyboardCursor !== null,
      };
    };

    const sync = (): void => {
      const state = store.getState();
      renderer.setViewport(state.viewport);
      renderer.setGridVisible(state.showGrid);
      renderer.setCursor(cursorShape());
    };
    sync();

    let previous = store.getState();
    const unsubscribe = store.subscribe((state) => {
      if (state.viewport !== previous.viewport) renderer.setViewport(state.viewport);
      if (state.showGrid !== previous.showGrid) renderer.setGridVisible(state.showGrid);
      if (
        state.cursor !== previous.cursor ||
        state.keyboardCursor !== previous.keyboardCursor ||
        state.tool !== previous.tool ||
        state.options !== previous.options
      ) {
        renderer.setCursor(cursorShape());
      }
      previous = state;
    });

    return () => {
      unsubscribe();
      observer.disconnect();
      window.removeEventListener('resize', measure);
      detachPointer();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [session, store]);

  // Keep the view pointing at the keyboard cursor when it moves off screen.
  const revealKeyboardCursor = (x: number, y: number): void => {
    const state = store.getState();
    const { viewport, viewSize } = state;
    const left = viewport.panX + x * viewport.zoom;
    const top = viewport.panY + y * viewport.zoom;
    let { panX, panY } = viewport;
    if (left < 0) panX -= left;
    else if (left + viewport.zoom > viewSize.width) panX -= left + viewport.zoom - viewSize.width;
    if (top < 0) panY -= top;
    else if (top + viewport.zoom > viewSize.height) panY -= top + viewport.zoom - viewSize.height;
    if (panX !== viewport.panX || panY !== viewport.panY) {
      state.setViewport({ zoom: viewport.zoom, panX: Math.round(panX), panY: Math.round(panY) });
    }
  };

  const keyboardPosition = (): { x: number; y: number } => {
    const state = store.getState();
    const start = state.keyboardCursor ?? state.cursor;
    return start ?? { x: Math.floor(state.spriteWidth / 2), y: Math.floor(state.spriteHeight / 2) };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const arrow = ARROWS[event.key];
    const state = store.getState();
    if (state.hasFloating && event.key === 'Enter') {
      event.preventDefault();
      state.commitFloating();
      return;
    }
    if (arrow && (state.hasFloating || state.tool === 'move')) {
      // Arrow keys carry the selected pixels (or the whole layer) instead of the pixel cursor.
      event.preventDefault();
      const step = event.altKey ? KEYBOARD_BIG_STEP : KEYBOARD_STEP;
      session.document.nudge(arrow[0] * step, arrow[1] * step);
      return;
    }
    if (arrow) {
      event.preventDefault();
      const step = event.altKey ? KEYBOARD_BIG_STEP : KEYBOARD_STEP;
      const current = keyboardPosition();
      const x = Math.min(state.spriteWidth - 1, Math.max(0, current.x + arrow[0] * step));
      const y = Math.min(state.spriteHeight - 1, Math.max(0, current.y + arrow[1] * step));
      state.setKeyboardCursor({ x, y });
      revealKeyboardCursor(x, y);
      if (keyboardStrokeRef.current) {
        session.pointerMove({ x, y, button: 'primary', shift: event.shiftKey });
      }
      return;
    }
    if (event.key === 'Enter' && !event.repeat && !keyboardStrokeRef.current) {
      event.preventDefault();
      const { x, y } = keyboardPosition();
      store.getState().setKeyboardCursor({ x, y });
      keyboardStrokeRef.current = true;
      session.pointerDown({ x, y, button: 'primary', shift: event.shiftKey });
    }
  };

  const finishKeyboardStroke = (shift: boolean): void => {
    if (!keyboardStrokeRef.current) return;
    keyboardStrokeRef.current = false;
    const { x, y } = keyboardPosition();
    session.pointerUp({ x, y, button: 'primary', shift });
  };

  return (
    // A drawing surface is a custom widget: it takes focus and handles its own keys (see aria-label).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={viewportRef}
      className={styles.viewport}
      data-pan={panMode}
      role="application"
      aria-label="Drawing canvas. Arrow keys move the pixel cursor, Alt with arrows moves 8 pixels, hold Enter to draw. With the Move tool, arrow keys move the selected pixels."
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- same reason as above
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (event.key === 'Enter') finishKeyboardStroke(event.shiftKey);
      }}
      onBlur={() => {
        if (keyboardStrokeRef.current) {
          keyboardStrokeRef.current = false;
          session.cancelStroke();
        }
        store.getState().setKeyboardCursor(null);
      }}
    >
      <canvas ref={documentRef} className={styles.layer} aria-hidden="true" />
      <canvas ref={gridRef} className={styles.layer} aria-hidden="true" />
      <canvas ref={overlayRef} className={styles.layer} aria-hidden="true" />
    </div>
  );
}
