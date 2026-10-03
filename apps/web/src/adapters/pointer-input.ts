import {
  pinchViewport,
  type EditorSession,
  type PointerInput,
  type TouchPair,
  type Viewport,
} from '@vidopix/core';
import type { EditorStore } from '../state/editor-store';
import type { CanvasRenderer } from './canvas-renderer';

interface PanDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startPanX: number;
  readonly startPanY: number;
}

/**
 * Turns Pointer Events on the canvas into core input (document pixels), pans and zooms the view,
 * and keeps the hovered pixel in the store. Pointer capture keeps strokes alive outside the canvas.
 */
export function attachPointerInput(
  element: HTMLElement,
  renderer: CanvasRenderer,
  session: EditorSession,
  store: EditorStore,
): () => void {
  let drawingPointer: number | null = null;
  let pan: PanDrag | null = null;
  let lastPixel: { x: number; y: number } | null = null;

  // Two-finger gestures: pinch to zoom and drag to pan. While fingers are down, nothing is drawn.
  const touches = new Map<number, { x: number; y: number }>();
  let gesture: { from: TouchPair; view: Viewport } | null = null;
  let gestureBlocksDrawing = false;

  const touchPair = (): TouchPair | null => {
    const [a, b] = [...touches.values()];
    return a && b ? { a: { ...a }, b: { ...b } } : null;
  };

  const localPoint = (event: MouseEvent): { x: number; y: number } => {
    const bounds = element.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const toInput = (event: PointerEvent, button: PointerInput['button']): PointerInput => {
    const point = localPoint(event);
    const pixel = renderer.toDocument(point.x, point.y);
    // Only pens report a meaningful pressure; a mouse always says 0.5 while pressed.
    const pressure = event.pointerType === 'pen' ? { pressure: event.pressure } : {};
    return { x: pixel.x, y: pixel.y, button, shift: event.shiftKey, ...pressure };
  };

  const startGestureIfTwoFingers = (): void => {
    const pair = touchPair();
    if (!pair || touches.size !== 2) return;
    // A second finger turns whatever the first one was doing into a gesture.
    session.cancelStroke();
    drawingPointer = null;
    lastPixel = null;
    gestureBlocksDrawing = true;
    gesture = { from: pair, view: store.getState().viewport };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      const point = localPoint(event);
      touches.set(event.pointerId, point);
      element.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
      if (touches.size >= 2) {
        startGestureIfTwoFingers();
        return;
      }
      if (gestureBlocksDrawing) return;
    }
    if (pan || drawingPointer !== null) return;
    element.focus({ preventScroll: true });
    const wantsPan = event.button === 1 || (event.button === 0 && store.getState().panMode);
    if (wantsPan) {
      event.preventDefault();
      const { viewport } = store.getState();
      pan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: viewport.panX,
        startPanY: viewport.panY,
      };
      element.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    drawingPointer = event.pointerId;
    element.setPointerCapture(event.pointerId);
    store.getState().setKeyboardCursor(null);
    const input = toInput(event, event.button === 2 ? 'secondary' : 'primary');
    lastPixel = { x: input.x, y: input.y };
    session.pointerDown(input);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
      touches.set(event.pointerId, localPoint(event));
      const pair = touchPair();
      if (gesture && pair) {
        store.getState().setViewport(pinchViewport(gesture.view, gesture.from, pair));
        return;
      }
      if (gestureBlocksDrawing) return;
    }
    const point = localPoint(event);
    const hovered = renderer.toDocument(point.x, point.y);
    const state = store.getState();
    state.setCursor(hovered);

    if (pan?.pointerId === event.pointerId) {
      const { viewport } = state;
      state.setViewport({
        zoom: viewport.zoom,
        panX: Math.round(pan.startPanX + event.clientX - pan.startX),
        panY: Math.round(pan.startPanY + event.clientY - pan.startY),
      });
      return;
    }

    if (drawingPointer !== event.pointerId) return;
    const button: PointerInput['button'] = (event.buttons & 2) !== 0 ? 'secondary' : 'primary';
    // Browsers may batch several samples into one event; using all of them keeps fast strokes smooth.
    const coalesced = 'getCoalescedEvents' in event ? event.getCoalescedEvents() : [];
    const samples = coalesced.length > 0 ? coalesced : [event];
    for (const sample of samples) {
      const input = toInput(sample, button);
      if (lastPixel?.x === input.x && lastPixel.y === input.y) continue;
      lastPixel = { x: input.x, y: input.y };
      session.pointerMove(input);
    }
  };

  const endTouch = (event: PointerEvent): boolean => {
    if (event.pointerType !== 'touch') return false;
    touches.delete(event.pointerId);
    if (touches.size < 2) gesture = null;
    if (touches.size === 0) gestureBlocksDrawing = false;
    return gestureBlocksDrawing;
  };

  const finish = (event: PointerEvent): void => {
    if (endTouch(event)) return;
    if (pan?.pointerId === event.pointerId) {
      pan = null;
      return;
    }
    if (drawingPointer !== event.pointerId) return;
    drawingPointer = null;
    lastPixel = null;
    session.pointerUp(toInput(event, event.button === 2 ? 'secondary' : 'primary'));
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (endTouch(event)) return;
    if (pan?.pointerId === event.pointerId) {
      pan = null;
      return;
    }
    if (drawingPointer !== event.pointerId) return;
    drawingPointer = null;
    lastPixel = null;
    session.cancelStroke();
  };

  const onPointerLeave = (): void => {
    if (drawingPointer === null) store.getState().setCursor(null);
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (event.deltaY === 0) return;
    store.getState().zoomStep(event.deltaY < 0 ? 1 : -1, localPoint(event));
  };

  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', finish);
  element.addEventListener('pointercancel', onPointerCancel);
  element.addEventListener('pointerleave', onPointerLeave);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', finish);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('pointerleave', onPointerLeave);
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('contextmenu', onContextMenu);
  };
}
