import type { Frame } from '@vidopix/core';

/** Index of the frame showing `elapsed` milliseconds into a loop, and the loop's length. */
export function frameAt(frames: readonly Frame[], elapsed: number): number {
  const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
  if (total <= 0) return 0;
  let remaining = ((elapsed % total) + total) % total;
  for (const [index, frame] of frames.entries()) {
    if (remaining < frame.duration) return index;
    remaining -= frame.duration;
  }
  return frames.length - 1;
}

/** Time from the start of a loop to the start of `index`. */
export function offsetOf(frames: readonly Frame[], index: number): number {
  return frames.slice(0, index).reduce((sum, frame) => sum + frame.duration, 0);
}

/**
 * Plays the animation in a loop from `start`, calling `onFrame` whenever the frame to show
 * changes. Time is measured from the start rather than added up per frame, so a slow tick never
 * makes the animation run late. `frames` is read on every tick, so edits take effect at once.
 * Returns a function that stops it.
 */
export function startPlayback(
  getFrames: () => readonly Frame[],
  start: number,
  onFrame: (index: number) => void,
  clock: () => number = () => performance.now(),
): () => void {
  const origin = clock() - offsetOf(getFrames(), start);
  let handle = 0;
  let shown = -1;
  const tick = (): void => {
    const frames = getFrames();
    const index = frameAt(frames, clock() - origin);
    if (index !== shown) {
      shown = index;
      onFrame(index);
    }
    handle = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(handle);
  };
}
