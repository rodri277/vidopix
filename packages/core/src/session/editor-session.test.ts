import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import type { PointerInput } from '../tools/tool.js';
import { EditorSession, type SessionEvents } from './editor-session.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);
const GREEN = packRgba(0, 255, 0, 255);

function createSession(width = 16, height = 16, historyBudgetBytes?: number): EditorSession {
  const result = EditorSession.create(
    { width, height },
    {
      ids: createSequentialIdGenerator(),
      ...(historyBudgetBytes === undefined ? {} : { historyBudgetBytes }),
    },
  );
  if (!result.ok) throw new Error('could not create session');
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

function pixels(session: EditorSession): string[] {
  const { buffer } = session.activeLayer;
  const result: string[] = [];
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (buffer.get(x, y) !== 0) result.push(`${String(x)},${String(y)}`);
    }
  }
  return result;
}

describe('EditorSession.create', () => {
  it('fails cleanly for an invalid size', () => {
    const result = EditorSession.create(
      { width: 0, height: 10 },
      { ids: createSequentialIdGenerator() },
    );
    expect(result.ok).toBe(false);
  });

  it('starts with a transparent sprite, black primary and white secondary', () => {
    const session = createSession(8, 4);
    expect(session.sprite.width).toBe(8);
    expect(session.sprite.height).toBe(4);
    expect(pixels(session)).toEqual([]);
    expect(session.primaryColor).toBe(packRgba(0, 0, 0, 255));
    expect(session.secondaryColor).toBe(packRgba(255, 255, 255, 255));
    expect(session.activeTool).toBe('pencil');
    expect(session.canUndo).toBe(false);
  });
});

describe('pencil', () => {
  it('paints a single pixel on click with the primary color', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [[3, 4]]);
    expect(pixels(session)).toEqual(['3,4']);
    expect(session.activeLayer.buffer.get(3, 4)).toBe(RED);
  });

  it('paints with the secondary color when the secondary button is used', () => {
    const session = createSession();
    session.setColor('secondary', BLUE);
    drag(session, [[1, 1]], { button: 'secondary' });
    expect(session.activeLayer.buffer.get(1, 1)).toBe(BLUE);
  });

  it('leaves no gaps when the pointer jumps between samples', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 31 }), fc.integer({ min: 0, max: 31 })), {
          minLength: 2,
          maxLength: 8,
        }),
        (points) => {
          const session = createSession(32, 32);
          drag(session, points);
          const painted = new Set(pixels(session));
          // Every sample point is painted, and each painted pixel touches another (or is alone).
          for (const [x, y] of points) expect(painted.has(`${String(x)},${String(y)}`)).toBe(true);
          for (const key of painted) {
            const [x, y] = key.split(',').map(Number) as [number, number];
            let touching = painted.size === 1;
            for (let dy = -1; dy <= 1 && !touching; dy++) {
              for (let dx = -1; dx <= 1 && !touching; dx++) {
                if ((dx !== 0 || dy !== 0) && painted.has(`${String(x + dx)},${String(y + dy)}`)) {
                  touching = true;
                }
              }
            }
            expect(touching).toBe(true);
          }
        },
      ),
    );
  });

  it('paints a wider brush', () => {
    const session = createSession();
    session.setToolOptions({ brushSize: 3 });
    drag(session, [[5, 5]]);
    expect(pixels(session)).toHaveLength(9);
  });

  it('does not paint outside the sprite', () => {
    const session = createSession(4, 4);
    drag(session, [
      [-5, 2],
      [10, 2],
    ]);
    expect(pixels(session)).toEqual(['0,2', '1,2', '2,2', '3,2']);
  });

  it('makes the whole stroke one history step', () => {
    const session = createSession();
    drag(session, [
      [0, 0],
      [5, 0],
      [5, 5],
    ]);
    expect(pixels(session).length).toBeGreaterThan(5);
    session.undo();
    expect(pixels(session)).toEqual([]);
    expect(session.canUndo).toBe(false);
    session.redo();
    expect(pixels(session).length).toBeGreaterThan(5);
  });

  it('records nothing for a stroke that changes nothing', () => {
    const session = createSession();
    session.setColor('primary', 0);
    drag(session, [[2, 2]]);
    expect(session.canUndo).toBe(false);
  });

  it('ignores moves and releases without a press', () => {
    const session = createSession();
    session.pointerMove(at(1, 1));
    session.pointerUp(at(1, 1));
    expect(pixels(session)).toEqual([]);
  });

  it('ignores a second press while a stroke is in progress', () => {
    const session = createSession();
    session.pointerDown(at(1, 1));
    session.pointerDown(at(8, 8));
    session.pointerUp(at(1, 1));
    expect(pixels(session)).toEqual(['1,1']);
  });

  it('restores the document when the stroke is canceled', () => {
    const session = createSession();
    drag(session, [[0, 0]]);
    const before = pixels(session);
    session.pointerDown(at(2, 2));
    session.pointerMove(at(6, 2));
    expect(pixels(session).length).toBeGreaterThan(before.length);
    session.cancelStroke();
    expect(pixels(session)).toEqual(before);
    session.cancelStroke();
    expect(session.canUndo).toBe(true);
  });

  it('restores the document when a large stroke stored as a rectangle is canceled', () => {
    const session = createSession(8, 8);
    session.setToolOptions({ brushSize: 16 });
    session.pointerDown(at(4, 4));
    session.pointerMove(at(5, 5));
    session.cancelStroke();
    expect(pixels(session)).toEqual([]);
  });
});

describe('eraser', () => {
  it('clears pixels to transparent and can be undone', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [
      [0, 0],
      [3, 0],
    ]);
    session.setActiveTool('eraser');
    drag(session, [
      [1, 0],
      [2, 0],
    ]);
    expect(pixels(session)).toEqual(['0,0', '3,0']);
    session.undo();
    expect(pixels(session)).toHaveLength(4);
  });
});

describe('fill', () => {
  it('fills the contiguous region and stops at walls', () => {
    const session = createSession(5, 1);
    session.setColor('primary', RED);
    drag(session, [[2, 0]]);
    session.setActiveTool('fill');
    session.setColor('primary', BLUE);
    drag(session, [[0, 0]]);
    expect(session.activeLayer.buffer.get(1, 0)).toBe(BLUE);
    expect(session.activeLayer.buffer.get(2, 0)).toBe(RED);
    expect(session.activeLayer.buffer.get(4, 0)).toBe(0);
  });

  it('can fill every matching pixel regardless of connectivity', () => {
    const session = createSession(5, 1);
    session.setColor('primary', RED);
    drag(session, [[2, 0]]);
    session.setActiveTool('fill');
    session.setToolOptions({ fillMode: 'global' });
    session.setColor('primary', BLUE);
    drag(session, [[0, 0]]);
    expect(session.activeLayer.buffer.get(4, 0)).toBe(BLUE);
  });

  it('is a single undoable step', () => {
    const session = createSession(8, 8);
    session.setActiveTool('fill');
    session.setColor('primary', GREEN);
    drag(session, [[0, 0]]);
    expect(pixels(session)).toHaveLength(64);
    session.undo();
    expect(pixels(session)).toEqual([]);
  });

  it('does nothing when the color is already there', () => {
    const session = createSession(4, 4);
    session.setActiveTool('fill');
    session.setColor('primary', 0);
    drag(session, [[0, 0]]);
    expect(session.canUndo).toBe(false);
  });
});

describe('eyedropper', () => {
  it('picks into the primary slot, or the secondary with the secondary button', () => {
    const session = createSession();
    session.setColor('primary', RED);
    drag(session, [[2, 2]]);
    session.setColor('primary', BLUE);
    drag(session, [[3, 3]]);

    session.setActiveTool('eyedropper');
    drag(session, [[2, 2]]);
    expect(session.primaryColor).toBe(RED);
    drag(session, [[3, 3]], { button: 'secondary' });
    expect(session.secondaryColor).toBe(BLUE);
  });

  it('follows the pointer while pressed and ignores positions outside', () => {
    const session = createSession(4, 4);
    session.setColor('primary', GREEN);
    drag(session, [[1, 1]]);
    session.setActiveTool('eyedropper');
    session.pointerDown(at(0, 0));
    session.pointerMove(at(1, 1));
    expect(session.primaryColor).toBe(GREEN);
    session.pointerMove(at(99, 99));
    expect(session.primaryColor).toBe(GREEN);
    session.pointerUp(at(1, 1));
    session.pointerMove(at(0, 0));
    expect(session.primaryColor).toBe(GREEN);
  });

  it('does not touch the document or the history', () => {
    const session = createSession();
    session.setActiveTool('eyedropper');
    drag(session, [[1, 1]]);
    expect(session.canUndo).toBe(false);
  });

  it('stops picking when canceled', () => {
    const session = createSession(4, 4);
    session.setColor('primary', RED);
    drag(session, [[1, 1]]);
    session.setActiveTool('eyedropper');
    session.setColor('primary', BLUE);
    session.pointerDown(at(1, 1));
    expect(session.primaryColor).toBe(RED);
    session.cancelStroke();
    session.pointerMove(at(2, 2));
    expect(session.primaryColor).toBe(RED);
  });
});

describe('shapes', () => {
  it('draws a line on release and previews it while dragging', () => {
    const session = createSession();
    session.setActiveTool('line');
    session.pointerDown(at(0, 0));
    session.pointerMove(at(4, 0));
    expect(pixels(session)).toEqual([]);
    expect(session.preview?.pixels).toHaveLength(5);
    session.pointerUp(at(4, 0));
    expect(session.preview).toBeNull();
    expect(pixels(session)).toHaveLength(5);
  });

  it('draws rectangle outlines and filled rectangles', () => {
    const session = createSession();
    session.setActiveTool('rectangle');
    drag(session, [
      [0, 0],
      [3, 3],
    ]);
    expect(pixels(session)).toHaveLength(12);
    session.undo();
    session.setToolOptions({ shapeFilled: true });
    drag(session, [
      [0, 0],
      [3, 3],
    ]);
    expect(pixels(session)).toHaveLength(16);
  });

  it('draws ellipses inside their box', () => {
    const session = createSession();
    session.setActiveTool('ellipse');
    drag(session, [
      [2, 2],
      [10, 8],
    ]);
    const painted = pixels(session).map((key) => key.split(',').map(Number) as [number, number]);
    expect(painted.length).toBeGreaterThan(10);
    for (const [x, y] of painted) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(10);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(8);
    }
  });

  it('constrains with shift: squares and 45 degree lines', () => {
    const session = createSession();
    session.setActiveTool('rectangle');
    drag(
      session,
      [
        [1, 1],
        [6, 3],
      ],
      { shift: true },
    );
    const square = pixels(session);
    expect(square).toContain('6,6');
    expect(square).not.toContain('3,3');

    const other = createSession();
    other.setActiveTool('line');
    drag(
      other,
      [
        [0, 0],
        [6, 2],
      ],
      { shift: true },
    );
    expect(pixels(other)).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0']);
  });

  it('uses the brush size for lines', () => {
    const session = createSession();
    session.setActiveTool('line');
    session.setToolOptions({ brushSize: 2 });
    drag(session, [
      [2, 2],
      [6, 2],
    ]);
    expect(pixels(session)).toHaveLength(12);
  });

  it('clips shapes that extend outside the sprite', () => {
    const session = createSession(4, 4);
    session.setActiveTool('rectangle');
    session.setToolOptions({ shapeFilled: true });
    drag(session, [
      [-3, -3],
      [2, 2],
    ]);
    expect(pixels(session)).toHaveLength(9);
  });

  it('can be canceled without touching the document', () => {
    const session = createSession();
    session.setActiveTool('ellipse');
    session.pointerDown(at(0, 0));
    session.pointerMove(at(8, 8));
    session.cancelStroke();
    expect(session.preview).toBeNull();
    session.pointerUp(at(8, 8));
    expect(pixels(session)).toEqual([]);
    expect(session.canUndo).toBe(false);
  });

  it('ignores moves and releases when no drag is active', () => {
    const session = createSession();
    session.setActiveTool('line');
    session.pointerMove(at(3, 3));
    session.pointerUp(at(3, 3));
    expect(pixels(session)).toEqual([]);
  });
});

describe('tool options and colors', () => {
  it('clamps the brush size to 1-16 and the tolerance to 0-255', () => {
    const session = createSession();
    session.setToolOptions({ brushSize: 99, tolerance: 999 });
    expect(session.toolOptions.brushSize).toBe(16);
    expect(session.toolOptions.tolerance).toBe(255);
    session.setToolOptions({ brushSize: -5, tolerance: -1 });
    expect(session.toolOptions.brushSize).toBe(1);
    expect(session.toolOptions.tolerance).toBe(0);
    session.setToolOptions({ brushSize: 4.4 });
    expect(session.toolOptions.brushSize).toBe(4);
  });

  it('swaps primary and secondary colors', () => {
    const session = createSession();
    session.setColor('primary', RED);
    session.setColor('secondary', BLUE);
    session.swapColors();
    expect(session.primaryColor).toBe(BLUE);
    expect(session.secondaryColor).toBe(RED);
  });

  it('abandons a stroke in progress when the tool changes', () => {
    const session = createSession();
    session.pointerDown(at(1, 1));
    session.pointerMove(at(5, 1));
    session.setActiveTool('line');
    expect(pixels(session)).toEqual([]);
  });

  it('does nothing when selecting the tool that is already active', () => {
    const session = createSession();
    const events: string[] = [];
    session.on('toolChanged', () => events.push('changed'));
    session.setActiveTool('pencil');
    expect(events).toEqual([]);
  });
});

describe('events', () => {
  it('announces dirty areas, history changes and unsubscribes', () => {
    const session = createSession();
    const dirty: SessionEvents['documentChanged'][] = [];
    const history: SessionEvents['historyChanged'][] = [];
    const offDirty = session.on('documentChanged', (event) => dirty.push(event));
    session.on('historyChanged', (event) => history.push(event));

    drag(session, [
      [1, 1],
      [3, 1],
    ]);
    expect(dirty.length).toBeGreaterThan(0);
    expect(history.at(-1)).toMatchObject({ cause: 'record', label: 'Pencil', canUndo: true });

    session.undo();
    expect(history.at(-1)).toMatchObject({
      cause: 'undo',
      label: 'Pencil',
      canUndo: false,
      canRedo: true,
      redoLabel: 'Pencil',
    });
    expect(dirty.at(-1)).toEqual({ dirty: { x: 1, y: 1, width: 3, height: 1 } });

    session.redo();
    expect(history.at(-1)).toMatchObject({ cause: 'redo', undoLabel: 'Pencil' });

    offDirty();
    const count = dirty.length;
    drag(session, [[8, 8]]);
    expect(dirty).toHaveLength(count);
  });

  it('reports color, option and preview changes', () => {
    const session = createSession();
    const log: string[] = [];
    session.on('colorsChanged', () => log.push('colors'));
    session.on('optionsChanged', () => log.push('options'));
    session.on('toolChanged', ({ tool }) => log.push(`tool:${tool}`));
    session.setColor('primary', RED);
    session.setToolOptions({ brushSize: 2 });
    session.setActiveTool('line');
    expect(log).toEqual(['colors', 'options', 'tool:line']);
  });

  it('undo and redo with an empty history do nothing', () => {
    const session = createSession();
    const events: string[] = [];
    session.on('historyChanged', () => events.push('history'));
    session.undo();
    session.redo();
    expect(events).toEqual([]);
  });
});

describe('newSprite', () => {
  it('replaces the document, clears the history and notifies', () => {
    const session = createSession();
    drag(session, [[1, 1]]);
    const events: string[] = [];
    session.on('spriteReplaced', ({ sprite }) => events.push(`sprite:${String(sprite.width)}`));
    session.on('historyChanged', ({ cause }) => events.push(cause));

    const result = session.newSprite({ width: 64, height: 64, name: 'Hero' });
    expect(result.ok).toBe(true);
    expect(session.sprite.name).toBe('Hero');
    expect(session.sprite.width).toBe(64);
    expect(session.canUndo).toBe(false);
    expect(events).toEqual(['sprite:64', 'clear']);
  });

  it('keeps the current document when the size is invalid', () => {
    const session = createSession();
    drag(session, [[1, 1]]);
    expect(session.newSprite({ width: 2000, height: 10 }).ok).toBe(false);
    expect(session.sprite.width).toBe(16);
    expect(pixels(session)).toEqual(['1,1']);
  });

  it('abandons a stroke in progress', () => {
    const session = createSession();
    session.pointerDown(at(1, 1));
    session.newSprite({ width: 8, height: 8 });
    session.pointerMove(at(5, 5));
    expect(pixels(session)).toEqual([]);
  });
});

describe('exportImage', () => {
  it('exports what was drawn, scaled', () => {
    const session = createSession(4, 4);
    session.setColor('primary', RED);
    drag(session, [[1, 2]]);
    const result = session.exportImage({ scale: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.width).toBe(8);
    expect(result.value.pixels[4 * 8 + 2]).toBe(RED);
    expect(result.value.pixels[5 * 8 + 3]).toBe(RED);
    expect(result.value.pixels[0]).toBe(0);
  });

  it('reports invalid scales', () => {
    expect(createSession().exportImage({ scale: 0 }).ok).toBe(false);
  });
});

describe('history budget', () => {
  it('drops the oldest steps when the memory budget is exceeded', () => {
    const session = createSession(64, 64, 100);
    for (let i = 0; i < 20; i++) drag(session, [[i, 0]]);
    expect(session.historyBytes).toBeLessThanOrEqual(100);
    let undone = 0;
    while (session.canUndo) {
      session.undo();
      undone++;
    }
    expect(undone).toBeLessThan(20);
    expect(undone).toBeGreaterThan(0);
  });
});
