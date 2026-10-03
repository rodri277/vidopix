import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import type { PointerInput } from '../tools/tool.js';
import { EditorSession, type SessionEvents } from './editor-session.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function createSession(size = 16): EditorSession {
  const result = EditorSession.create(
    { width: size, height: size },
    { ids: createSequentialIdGenerator() },
  );
  if (!result.ok) throw new Error('session');
  return result.value;
}

const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  x,
  y,
  button: 'primary',
  shift: false,
  ...extra,
});

function drag(session: EditorSession, points: readonly [number, number][], extra = {}): void {
  const [first, ...rest] = points;
  if (!first) return;
  session.pointerDown(at(first[0], first[1], extra));
  for (const [x, y] of rest) session.pointerMove(at(x, y, extra));
  const last = points[points.length - 1] ?? first;
  session.pointerUp(at(last[0], last[1], extra));
}

function painted(session: EditorSession): string[] {
  const { buffer } = session.activeLayer;
  const result: string[] = [];
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (buffer.get(x, y) !== 0) result.push(`${String(x)},${String(y)}`);
    }
  }
  return result;
}

function select(session: EditorSession, x0: number, y0: number, x1: number, y1: number): void {
  session.setActiveTool('select');
  drag(session, [
    [x0, y0],
    [x1, y1],
  ]);
}

describe('select tool', () => {
  it('selects a rectangle by dragging, previewing live and recording one step', () => {
    const session = createSession();
    const selections: (SessionEvents['selectionChanged'] | undefined)[] = [];
    session.on('selectionChanged', (event) => selections.push(event));
    session.setActiveTool('select');
    session.pointerDown(at(2, 3));
    session.pointerMove(at(5, 4));
    expect(session.document.selection).toEqual({ x: 2, y: 3, width: 4, height: 2 });
    expect(session.canUndo).toBe(false);
    session.pointerUp(at(6, 6));

    expect(session.document.selection).toEqual({ x: 2, y: 3, width: 5, height: 4 });
    expect(selections.length).toBeGreaterThan(1);
    session.undo();
    expect(session.document.selection).toBeNull();
  });

  it('clears the selection with a plain click', () => {
    const session = createSession();
    select(session, 1, 1, 4, 4);
    drag(session, [[8, 8]]);
    expect(session.document.selection).toBeNull();
    session.undo();
    expect(session.document.selection).toEqual({ x: 1, y: 1, width: 4, height: 4 });
  });

  it('keeps the selection inside the canvas when dragging past the edge', () => {
    const session = createSession(8);
    select(session, 5, 5, 40, 40);
    expect(session.document.selection).toEqual({ x: 5, y: 5, width: 3, height: 3 });
    select(session, -9, -9, 2, 2);
    expect(session.document.selection).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it('makes a square with shift', () => {
    const session = createSession();
    session.setActiveTool('select');
    drag(
      session,
      [
        [2, 2],
        [8, 4],
      ],
      { shift: true },
    );
    expect(session.document.selection).toEqual({ x: 2, y: 2, width: 7, height: 7 });
  });

  it('restores the previous selection when canceled mid-drag', () => {
    const session = createSession();
    select(session, 1, 1, 3, 3);
    session.pointerDown(at(8, 8));
    session.pointerMove(at(12, 12));
    session.cancelStroke();
    expect(session.document.selection).toEqual({ x: 1, y: 1, width: 3, height: 3 });
    session.pointerUp(at(12, 12));
    expect(session.document.selection).toEqual({ x: 1, y: 1, width: 3, height: 3 });
  });
});

describe('drawing tools respect the selection', () => {
  it('only paints inside it, for freehand, shapes and eraser', () => {
    const session = createSession();
    select(session, 4, 4, 7, 7);
    session.setActiveTool('pencil');
    session.setColor('primary', RED);
    drag(session, [
      [0, 5],
      [15, 5],
    ]);
    expect(painted(session)).toEqual(['4,5', '5,5', '6,5', '7,5']);

    session.setActiveTool('rectangle');
    session.setToolOptions({ shapeFilled: true });
    drag(session, [
      [0, 0],
      [15, 15],
    ]);
    expect(painted(session)).toHaveLength(16);

    session.setActiveTool('eraser');
    drag(session, [
      [0, 6],
      [15, 6],
    ]);
    expect(painted(session)).toHaveLength(12);
  });

  it('previews shapes only inside the selection', () => {
    const session = createSession();
    select(session, 4, 4, 7, 7);
    session.setActiveTool('line');
    session.pointerDown(at(0, 5));
    session.pointerMove(at(15, 5));
    const pixels = session.preview?.pixels ?? [];
    expect(pixels).toHaveLength(4);
    session.cancelStroke();
  });

  it('limits a fill to the selection', () => {
    const session = createSession();
    select(session, 2, 2, 5, 5);
    session.setActiveTool('fill');
    session.setColor('primary', BLUE);
    drag(session, [[3, 3]]);
    expect(painted(session)).toHaveLength(16);
    drag(session, [[0, 0]]);
    expect(painted(session)).toHaveLength(16);
  });
});

describe('move tool', () => {
  function drawn(): EditorSession {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [
      [2, 2],
      [3, 2],
    ]);
    select(session, 2, 2, 3, 2);
    session.setActiveTool('move');
    return session;
  }

  it('drags the selected pixels and leaves them floating until dropped', () => {
    const session = drawn();
    drag(session, [
      [2, 2],
      [6, 5],
    ]);
    expect(session.document.floating).toMatchObject({ x: 6, y: 5 });
    expect(painted(session)).toEqual([]);
    session.setActiveTool('pencil');
    expect(session.document.floating).toBeNull();
    expect(painted(session)).toEqual(['6,5', '7,5']);
  });

  it('can be dragged again while floating and ignores presses outside the selection', () => {
    const session = drawn();
    drag(session, [
      [2, 2],
      [5, 5],
    ]);
    drag(session, [
      [5, 5],
      [7, 5],
    ]);
    expect(session.document.floating).toMatchObject({ x: 7, y: 5 });
    session.document.commitFloating();
    session.setActiveTool('select');
    drag(session, [
      [9, 9],
      [10, 10],
    ]);
    session.setActiveTool('move');
    drag(session, [
      [0, 0],
      [4, 4],
    ]);
    expect(session.document.floating).toBeNull();
  });

  it('drops the floating content when pressing outside of it', () => {
    const session = drawn();
    drag(session, [
      [2, 2],
      [6, 6],
    ]);
    drag(session, [
      [12, 12],
      [13, 13],
    ]);
    expect(session.document.floating).toBeNull();
    expect(painted(session)).toContain('6,6');
  });

  it('puts the content back when a drag is canceled', () => {
    const session = drawn();
    session.pointerDown(at(2, 2));
    session.pointerMove(at(9, 9));
    session.cancelAction();
    expect(session.document.floating).toMatchObject({ x: 2, y: 2 });
    session.cancelAction();
    expect(session.document.floating).toBeNull();
    expect(painted(session)).toEqual(['2,2', '3,2']);
  });

  it('moves the whole layer when nothing is selected', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [[1, 1]]);
    session.setActiveTool('move');
    drag(session, [
      [5, 5],
      [8, 7],
    ]);
    session.document.commitFloating();
    expect(painted(session)).toEqual(['4,3']);
  });

  it('is blocked on a locked layer', () => {
    const session = drawn();
    const blocked: string[] = [];
    session.on('actionBlocked', ({ reason }) => blocked.push(reason));
    session.document.setLayerLocked(session.activeLayer.id, true);
    drag(session, [
      [2, 2],
      [6, 6],
    ]);
    expect(session.document.floating).toBeNull();
    expect(blocked).toEqual(['layer-locked']);
  });
});

describe('paste', () => {
  it('floats the clipboard and switches to the move tool', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [
      [1, 1],
      [2, 1],
    ]);
    select(session, 1, 1, 2, 1);
    expect(session.document.copySelection()).not.toBeNull();

    expect(session.paste({ x: 8, y: 8 })).toBe(true);
    expect(session.activeTool).toBe('move');
    expect(session.document.floating).not.toBeNull();
    session.undo();
    expect(session.document.floating).toBeNull();
  });

  it('pastes an external image the same way', () => {
    const session = createSession();
    const image = PixelBuffer.create(2, 2);
    image.fill(BLUE);
    expect(session.pasteBuffer(image, { x: 8, y: 8 })).toBe(true);
    session.document.commitFloating();
    expect(painted(session)).toHaveLength(4);
  });

  it('does not switch tools when there is nothing to paste or the layer is locked', () => {
    const session = createSession();
    expect(session.paste({ x: 1, y: 1 })).toBe(false);
    expect(session.activeTool).toBe('pencil');
    const image = PixelBuffer.create(1, 1);
    session.document.setLayerLocked(session.activeLayer.id, true);
    expect(session.pasteBuffer(image, { x: 1, y: 1 })).toBe(false);
    expect(session.activeTool).toBe('pencil');
  });
});

describe('layers in the session', () => {
  it('draws on the active layer only and blocks hidden or locked ones', () => {
    const session = createSession();
    const blocked: string[] = [];
    session.on('actionBlocked', ({ reason }) => blocked.push(reason));
    session.setColor('primary', RED);
    drag(session, [[1, 1]]);
    session.document.addLayer();
    drag(session, [[2, 2]]);
    expect(session.sprite.layers[0]?.buffer.get(1, 1)).toBe(RED);
    expect(session.sprite.layers[0]?.buffer.get(2, 2)).toBe(0);
    expect(session.activeLayer.buffer.get(2, 2)).toBe(RED);

    session.document.setLayerLocked(session.activeLayer.id, true);
    drag(session, [[3, 3]]);
    session.document.setLayerLocked(session.activeLayer.id, false);
    session.document.setLayerVisible(session.activeLayer.id, false);
    drag(session, [[4, 4]]);
    expect(blocked).toEqual(['layer-locked', 'layer-hidden']);
    expect(painted(session)).toEqual(['2,2']);
  });

  it('lets the eyedropper and selection work on locked layers, and picks the visible color', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [[5, 5]]);
    session.document.addLayer();
    session.setColor('primary', BLUE);
    drag(session, [[6, 6]]);
    session.document.setLayerLocked(session.activeLayer.id, true);

    session.setActiveTool('eyedropper');
    drag(session, [[5, 5]]);
    expect(session.primaryColor).toBe(RED);
    drag(session, [[6, 6]], { button: 'secondary' });
    expect(session.secondaryColor).toBe(BLUE);

    select(session, 1, 1, 3, 3);
    expect(session.document.selection).not.toBeNull();
  });

  it('exports every visible layer', () => {
    const session = createSession(4);
    session.setColor('primary', RED);
    drag(session, [[0, 0]]);
    session.document.addLayer();
    session.setColor('primary', BLUE);
    drag(session, [[1, 0]]);
    const image = session.exportImage({ scale: 1 });
    expect(image.ok && [...image.value.pixels.slice(0, 2)]).toEqual([RED, BLUE]);
  });

  it('commits floating content before exporting', () => {
    const session = createSession(4);
    session.setColor('primary', RED);
    drag(session, [[0, 0]]);
    session.setActiveTool('move');
    drag(session, [
      [0, 0],
      [2, 2],
    ]);
    const image = session.exportImage({ scale: 1 });
    expect(image.ok && image.value.pixels[2 * 4 + 2]).toBe(RED);
  });
});

describe('dirty areas on multi-layer sprites', () => {
  it('only reports the stroke area when drawing, not the whole sprite', () => {
    const session = createSession(64);
    session.document.addLayer();
    session.document.addLayer();
    const dirty: SessionEvents['documentChanged'][] = [];
    session.on('documentChanged', (event) => dirty.push(event));
    drag(session, [
      [10, 10],
      [12, 10],
    ]);
    expect(dirty.length).toBeGreaterThan(0);
    for (const { dirty: rect } of dirty) {
      expect(rect.width * rect.height).toBeLessThanOrEqual(3);
    }
  });
});

describe('long sessions with layers', () => {
  it('undoes and redoes a mixed sequence of layer, selection and pixel steps', () => {
    const session = createSession(8);
    session.setColor('primary', RED);
    drag(session, [[1, 1]]);
    session.document.addLayer();
    session.setColor('primary', BLUE);
    drag(session, [
      [2, 2],
      [4, 2],
    ]);
    select(session, 2, 2, 4, 2);
    session.setActiveTool('move');
    drag(session, [
      [2, 2],
      [2, 5],
    ]);
    session.document.commitFloating();
    session.document.mergeDown();
    session.document.flatten();

    const final = session.sprite.layers.map((layer) => [...layer.buffer.data]);
    let steps = 0;
    while (session.canUndo) {
      session.undo();
      steps++;
    }
    expect(steps).toBeGreaterThan(5);
    expect(session.sprite.layers).toHaveLength(1);
    expect(painted(session)).toEqual([]);

    while (session.canRedo) session.redo();
    expect(session.sprite.layers.map((layer) => [...layer.buffer.data])).toEqual(final);
  });
});

describe('openSprite', () => {
  it('replaces the document with the given sprite and clears history', () => {
    const session = createSession(8);
    drag(session, [[1, 1]]);
    const other = createSession(4).sprite;
    session.openSprite(other);
    expect(session.sprite).toBe(other);
    expect(session.canUndo).toBe(false);
  });

  it('abandons a stroke in progress', () => {
    const session = createSession(8);
    session.pointerDown(at(1, 1));
    session.openSprite(createSession(4).sprite);
    session.pointerMove(at(2, 2));
    expect(painted(session)).toEqual([]);
  });
});
