import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { ditherAllows } from '../tools/painter.js';
import type { PointerInput } from '../tools/tool.js';
import { EditorSession } from './editor-session.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function createSession(size = 8): EditorSession {
  const result = EditorSession.create(
    { width: size, height: size },
    { ids: createSequentialIdGenerator() },
  );
  if (!result.ok) throw new Error('session');
  result.value.setColor('primary', RED);
  return result.value;
}

const at = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  x,
  y,
  button: 'primary',
  shift: false,
  ...extra,
});

function drag(
  session: EditorSession,
  points: readonly [number, number][],
  extra: Partial<PointerInput> = {},
): void {
  const [first, ...rest] = points;
  if (!first) return;
  session.pointerDown(at(first[0], first[1], extra));
  for (const [x, y] of rest) session.pointerMove(at(x, y, extra));
  const last = points[points.length - 1] ?? first;
  session.pointerUp(at(last[0], last[1], extra));
}

function painted(session: EditorSession): Set<string> {
  const { buffer } = session.activeLayer;
  const result = new Set<string>();
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      if (buffer.get(x, y) !== 0) result.add(`${String(x)},${String(y)}`);
    }
  }
  return result;
}

describe('symmetry', () => {
  it('mirrors pencil strokes and keeps one undo step', () => {
    const session = createSession();
    session.setToolOptions({ mirrorX: true });
    drag(session, [
      [0, 1],
      [2, 1],
    ]);
    expect(painted(session)).toEqual(new Set(['0,1', '1,1', '2,1', '7,1', '6,1', '5,1']));
    session.undo();
    expect(painted(session).size).toBe(0);
  });

  it('mirrors in both directions and for the eraser', () => {
    const session = createSession();
    session.setToolOptions({ mirrorX: true, mirrorY: true });
    drag(session, [[1, 1]]);
    expect(painted(session)).toEqual(new Set(['1,1', '6,1', '1,6', '6,6']));
    session.setActiveTool('eraser');
    drag(session, [[1, 1]]);
    expect(painted(session).size).toBe(0);
  });

  it('mirrors shapes and shows the mirror images in the preview', () => {
    const session = createSession(10);
    session.setActiveTool('rectangle');
    session.setToolOptions({ mirrorX: true, shapeFilled: true });
    session.pointerDown(at(0, 0));
    session.pointerMove(at(1, 1));
    const previewed = new Set(
      (session.preview?.pixels ?? []).map((i) => `${String(i % 10)},${String(Math.floor(i / 10))}`),
    );
    session.pointerUp(at(1, 1));
    expect(painted(session)).toEqual(previewed);
    expect(painted(session)).toEqual(
      new Set(['0,0', '1,0', '0,1', '1,1', '8,0', '9,0', '8,1', '9,1']),
    );
  });

  it('does not mirror a fill', () => {
    const session = createSession();
    session.setActiveTool('fill');
    session.setToolOptions({ mirrorX: true, mirrorY: true });
    session.document.previewSelection({ x: 0, y: 0, width: 3, height: 3 });
    drag(session, [[1, 1]]);
    expect(painted(session).size).toBe(9);
  });

  it('always gives a symmetric drawing for random strokes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 0, max: 9 })), {
          minLength: 1,
          maxLength: 12,
        }),
        (points) => {
          const session = createSession(10);
          session.setToolOptions({ mirrorX: true, brushSize: 3 });
          drag(session, points);
          const result = painted(session);
          for (const key of result) {
            const [x, y] = key.split(',').map(Number) as [number, number];
            expect(result.has(`${String(9 - x)},${String(y)}`)).toBe(true);
          }
        },
      ),
    );
  });
});

describe('dithering', () => {
  it('draws only the pixels of the pattern', () => {
    const session = createSession(8);
    session.setToolOptions({ dither: 8, brushSize: 8 });
    drag(session, [[3, 3]]);
    const result = painted(session);
    expect(result.size).toBe(32);
    for (const key of result) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(ditherAllows(x, y, 8)).toBe(true);
    }
  });

  it('dithers a fill and clamps the density', () => {
    const session = createSession(8);
    session.setActiveTool('fill');
    session.setToolOptions({ dither: 4 });
    drag(session, [[0, 0]]);
    expect(painted(session).size).toBe(16);
    session.setToolOptions({ dither: 99 });
    expect(session.toolOptions.dither).toBe(16);
    session.setToolOptions({ dither: -3 });
    expect(session.toolOptions.dither).toBe(1);
  });

  it('two overlapping strokes blend into the same pattern', () => {
    const session = createSession(8);
    session.setToolOptions({ dither: 8, brushSize: 4 });
    drag(session, [[2, 2]]);
    drag(session, [[3, 3]]);
    const result = painted(session);
    for (const key of result) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(ditherAllows(x, y, 8)).toBe(true);
    }
  });
});

describe('pixel-perfect pencil', () => {
  const staircase: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
  ];

  it('is off by default, leaving the doubled corners', () => {
    const session = createSession();
    drag(session, staircase);
    expect(painted(session).size).toBe(5);
  });

  it('removes the corner pixels so the diagonal is one pixel wide', () => {
    const session = createSession();
    session.setToolOptions({ pixelPerfect: true });
    drag(session, staircase);
    expect(painted(session)).toEqual(new Set(['0,0', '1,1', '2,2']));
  });

  it('leaves straight lines alone and rounds right-angle turns', () => {
    const session = createSession();
    session.setToolOptions({ pixelPerfect: true });
    drag(session, [
      [0, 0],
      [3, 0],
    ]);
    expect(painted(session)).toEqual(new Set(['0,0', '1,0', '2,0', '3,0']));
    drag(session, [
      [5, 0],
      [5, 2],
      [7, 2],
    ]);
    // The pixel at the turn is the redundant middle of an "L", so it is dropped.
    expect(painted(session).has('5,2')).toBe(false);
    expect(painted(session).has('5,1')).toBe(true);
    expect(painted(session).has('6,2')).toBe(true);
  });

  it('puts back what was under a removed corner instead of erasing it', () => {
    const session = createSession();
    session.setColor('primary', BLUE);
    drag(session, [[1, 0]]);
    session.setColor('primary', RED);
    session.setToolOptions({ pixelPerfect: true });
    drag(session, staircase);
    expect(session.activeLayer.buffer.get(1, 0)).toBe(BLUE);
    expect(session.activeLayer.buffer.get(2, 1)).toBe(0);
  });

  it('works together with symmetry and stays one undo step', () => {
    const session = createSession();
    session.setToolOptions({ pixelPerfect: true, mirrorX: true });
    drag(session, staircase);
    expect(painted(session)).toEqual(new Set(['0,0', '1,1', '2,2', '7,0', '6,1', '5,2']));
    session.undo();
    expect(painted(session).size).toBe(0);
  });

  it('does nothing special for the eraser or wide brushes', () => {
    const session = createSession();
    session.setToolOptions({ pixelPerfect: true, brushSize: 2 });
    drag(session, staircase);
    expect(painted(session).size).toBeGreaterThan(5);
  });

  it('can be canceled without leaving anything behind', () => {
    const session = createSession();
    session.setToolOptions({ pixelPerfect: true });
    session.pointerDown(at(0, 0));
    session.pointerMove(at(1, 0));
    session.pointerMove(at(1, 1));
    session.cancelStroke();
    expect(painted(session).size).toBe(0);
  });
});

describe('pen pressure', () => {
  it('scales the brush with pressure only when enabled and reported', () => {
    const session = createSession(16);
    session.setToolOptions({ brushSize: 8, pressure: true });
    drag(session, [[8, 8]], { pressure: 0.5 });
    expect(painted(session).size).toBe(16);
    session.undo();

    drag(session, [[8, 8]]);
    expect(painted(session).size).toBe(64);
    session.undo();

    session.setToolOptions({ pressure: false });
    drag(session, [[8, 8]], { pressure: 0.25 });
    expect(painted(session).size).toBe(64);
  });

  it('never goes below one pixel', () => {
    const session = createSession();
    session.setToolOptions({ brushSize: 8, pressure: true });
    drag(session, [[4, 4]], { pressure: 0 });
    expect(painted(session).size).toBe(1);
  });
});
