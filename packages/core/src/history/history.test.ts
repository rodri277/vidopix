import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { PixelPatchCommand, type Command } from './command.js';
import { HistoryManager } from './history-manager.js';
import { PatchRecorder } from './patch-recorder.js';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

function strokeCommand(
  buffer: PixelBuffer,
  label: string,
  pixels: readonly [number, number, number][],
): Command | null {
  const recorder = new PatchRecorder(buffer);
  for (const [x, y, color] of pixels) recorder.setPixel(x, y, color);
  const patch = recorder.finish();
  return patch ? new PixelPatchCommand(label, buffer, patch) : null;
}

describe('PatchRecorder', () => {
  it('writes through to the buffer', () => {
    const buffer = PixelBuffer.create(4, 4);
    new PatchRecorder(buffer).setPixel(2, 3, RED);
    expect(buffer.get(2, 3)).toBe(RED);
  });

  it('remembers the original color even if a pixel is painted twice', () => {
    const buffer = PixelBuffer.create(4, 4);
    buffer.set(1, 1, BLUE);
    const original = buffer.clone();
    const command = strokeCommand(buffer, 'stroke', [
      [1, 1, RED],
      [1, 1, 0],
      [1, 1, RED],
    ]);
    expect(buffer.get(1, 1)).toBe(RED);
    command?.revert();
    expect(buffer.equals(original)).toBe(true);
  });

  it('yields no patch when the stroke changes nothing', () => {
    const buffer = PixelBuffer.create(4, 4);
    expect(strokeCommand(buffer, 'noop', [[0, 0, 0]])).toBeNull();
    expect(
      strokeCommand(buffer, 'there and back', [
        [0, 0, RED],
        [0, 0, 0],
      ]),
    ).toBeNull();
  });

  it('ignores pixels outside the buffer', () => {
    const buffer = PixelBuffer.create(2, 2);
    expect(
      strokeCommand(buffer, 'outside', [
        [-1, 0, RED],
        [2, 2, RED],
      ]),
    ).toBeNull();
  });

  it('reports the dirty area since the last call', () => {
    const buffer = PixelBuffer.create(8, 8);
    const recorder = new PatchRecorder(buffer);
    expect(recorder.takeDirty()).toBeNull();
    recorder.setPixel(1, 1, RED);
    recorder.setPixel(4, 3, RED);
    expect(recorder.takeDirty()).toEqual({ x: 1, y: 1, width: 4, height: 3 });
    expect(recorder.takeDirty()).toBeNull();
  });
});

describe('HistoryManager', () => {
  it('undoes and redoes a recorded stroke', () => {
    const buffer = PixelBuffer.create(4, 4);
    const history = new HistoryManager();
    const command = strokeCommand(buffer, 'Pencil', [
      [0, 0, RED],
      [1, 0, RED],
    ]);
    expect(command).not.toBeNull();
    if (command) history.record(command);

    expect(history.undoLabel).toBe('Pencil');
    const undone = history.undo();
    expect(undone?.label).toBe('Pencil');
    expect(undone?.dirty).toEqual({ x: 0, y: 0, width: 2, height: 1 });
    expect(buffer.get(0, 0)).toBe(0);
    expect(history.canRedo).toBe(true);

    history.redo();
    expect(buffer.get(1, 0)).toBe(RED);
    expect(history.canRedo).toBe(false);
  });

  it('returns null when there is nothing to undo or redo', () => {
    const history = new HistoryManager();
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
    expect(history.undoLabel).toBeNull();
    expect(history.redoLabel).toBeNull();
  });

  it('applies a command when executed', () => {
    const buffer = PixelBuffer.create(4, 4);
    const recorder = new PatchRecorder(buffer);
    recorder.setPixel(0, 0, RED);
    const patch = recorder.finish();
    if (!patch) throw new Error('expected a patch');
    buffer.set(0, 0, 0);

    const history = new HistoryManager();
    const dirty = history.execute(new PixelPatchCommand('Redo me', buffer, patch));
    expect(buffer.get(0, 0)).toBe(RED);
    expect(dirty).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(history.undoCount).toBe(1);
  });

  it('empties the redo stack when a new command is recorded', () => {
    const buffer = PixelBuffer.create(4, 4);
    const history = new HistoryManager();
    const first = strokeCommand(buffer, 'first', [[0, 0, RED]]);
    const second = strokeCommand(buffer, 'second', [[1, 0, RED]]);
    if (first) history.record(first);
    if (second) history.record(second);
    history.undo();
    expect(history.canRedo).toBe(true);

    const third = strokeCommand(buffer, 'third', [[2, 0, RED]]);
    if (third) history.record(third);
    expect(history.canRedo).toBe(false);
    expect(history.undoCount).toBe(2);
  });

  it('keeps the memory counter in sync', () => {
    const buffer = PixelBuffer.create(4, 4);
    const history = new HistoryManager();
    const command = strokeCommand(buffer, 'one', [[0, 0, RED]]);
    if (command) history.record(command);
    expect(history.usedBytes).toBe(command?.sizeBytes);
    history.clear();
    expect(history.usedBytes).toBe(0);
    expect(history.canUndo).toBe(false);
  });

  it('drops the oldest steps once over budget but always keeps the newest', () => {
    const buffer = PixelBuffer.create(32, 32);
    const history = new HistoryManager(20);
    const commands = [0, 1, 2, 3].map((x) =>
      strokeCommand(buffer, `step ${String(x)}`, [[x, 0, RED]]),
    );
    for (const command of commands) if (command) history.record(command);

    // A single-pixel patch is stored as a 1x1 rectangle (8 bytes), so only two fit in 20 bytes.
    expect(history.undoCount).toBe(2);
    expect(history.usedBytes).toBeLessThanOrEqual(20);
    expect(history.undoLabel).toBe('step 3');

    const huge = new HistoryManager(1);
    const only = strokeCommand(buffer, 'too big', [[10, 10, RED]]);
    if (only) huge.record(only);
    expect(huge.undoCount).toBe(1);
  });

  it('restores the original buffer after undoing any sequence, and the final one after redoing', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(
            fc.tuple(
              fc.integer({ min: 0, max: 11 }),
              fc.integer({ min: 0, max: 11 }),
              fc.constantFrom(0, RED, BLUE),
            ),
            { minLength: 1, maxLength: 60 },
          ),
          { minLength: 1, maxLength: 12 },
        ),
        (strokes) => {
          const buffer = PixelBuffer.create(12, 12);
          const original = buffer.clone();
          const history = new HistoryManager();

          strokes.forEach((pixels, index) => {
            const command = strokeCommand(buffer, `stroke ${String(index)}`, pixels);
            if (command) history.record(command);
          });
          const final = buffer.clone();
          const steps = history.undoCount;

          for (let i = 0; i < steps; i++) history.undo();
          expect(buffer.equals(original)).toBe(true);
          for (let i = 0; i < steps; i++) history.redo();
          expect(buffer.equals(final)).toBe(true);
        },
      ),
    );
  });
});
