import { describe, expect, it } from 'vitest';
import { constrainLine, constrainSquare } from './constrain.js';

const origin = { x: 10, y: 10 };

describe('constrainLine', () => {
  it('snaps near-horizontal drags to a horizontal line', () => {
    expect(constrainLine(origin, { x: 20, y: 12 })).toEqual({ x: 20, y: 10 });
  });

  it('snaps near-vertical drags to a vertical line', () => {
    expect(constrainLine(origin, { x: 9, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it('snaps diagonal-ish drags to 45 degrees in the same quadrant', () => {
    expect(constrainLine(origin, { x: 16, y: 13 })).toEqual({ x: 16, y: 16 });
    expect(constrainLine(origin, { x: 4, y: 13 })).toEqual({ x: 4, y: 16 });
    expect(constrainLine(origin, { x: 7, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('leaves a zero-length drag alone', () => {
    expect(constrainLine(origin, origin)).toEqual(origin);
  });
});

describe('constrainSquare', () => {
  it('uses the longer side and keeps the drag direction', () => {
    expect(constrainSquare(origin, { x: 14, y: 12 })).toEqual({ x: 14, y: 14 });
    expect(constrainSquare(origin, { x: 7, y: 2 })).toEqual({ x: 2, y: 2 });
    expect(constrainSquare(origin, { x: 12, y: 3 })).toEqual({ x: 17, y: 3 });
  });
});
