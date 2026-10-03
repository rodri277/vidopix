import { describe, expect, it, vi } from 'vitest';
import { frameAt, offsetOf, startPlayback } from './playback';

const frames = [
  { id: 'a', duration: 100 },
  { id: 'b', duration: 300 },
  { id: 'c', duration: 20 },
];

describe('frameAt', () => {
  it('finds the frame for a moment in the loop', () => {
    expect(frameAt(frames, 0)).toBe(0);
    expect(frameAt(frames, 99)).toBe(0);
    expect(frameAt(frames, 100)).toBe(1);
    expect(frameAt(frames, 399)).toBe(1);
    expect(frameAt(frames, 400)).toBe(2);
    expect(frameAt(frames, 419)).toBe(2);
  });

  it('loops, also for very long or negative times', () => {
    expect(frameAt(frames, 420)).toBe(0);
    expect(frameAt(frames, 420 * 1000 + 150)).toBe(1);
    expect(frameAt(frames, -10)).toBe(2);
  });

  it('copes with no frames', () => {
    expect(frameAt([], 50)).toBe(0);
  });
});

describe('offsetOf', () => {
  it('adds up the durations before a frame', () => {
    expect(offsetOf(frames, 0)).toBe(0);
    expect(offsetOf(frames, 2)).toBe(400);
  });
});

describe('startPlayback', () => {
  it('reports each frame once, in order, following the clock', () => {
    let now = 1000;
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const shown: number[] = [];
    const stop = startPlayback(
      () => frames,
      0,
      (index) => shown.push(index),
      () => now,
    );
    const advance = (ms: number): void => {
      now += ms;
      callbacks.shift()?.(now);
    };
    advance(50);
    advance(60);
    advance(300);
    advance(20);
    expect(shown).toEqual([0, 1, 2, 0]);
    stop();
    vi.unstubAllGlobals();
  });

  it('starts from the given frame', () => {
    const shown: number[] = [];
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    startPlayback(
      () => frames,
      2,
      (index) => shown.push(index),
      () => 5,
    );
    expect(shown).toEqual([2]);
    vi.unstubAllGlobals();
  });
});
