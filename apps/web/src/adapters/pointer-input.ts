import type { EditorSession, PointerInput } from '@vidopix/core';
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

  const localPoint = (event: MouseEvent): { x: number; y: number } => {
    const bounds = element.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const toInput = (event: MouseEvent, button: PointerInput['button']): PointerInput => {
    const point = localPoint(event);
    const pixel = renderer.toDocument(point.x, point.y);
    return { x: pixel.x, y: pixel.y, button, shift: event.shiftKey };
  };

  const onPointerDown = (event: PointerEvent): void => {
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

  const finish = (event: PointerEvent): void => {
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
