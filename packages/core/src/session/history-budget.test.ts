import { describe, expect, it } from 'vitest';
import { DEFAULT_HISTORY_BUDGET_BYTES } from '../history/history-manager.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { EditorSession } from './editor-session.js';

/** Small deterministic generator so the strokes are the same on every run. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('long editing sessions', () => {
  it('undoes and redoes 500 strokes on a 256x256 sprite within the memory budget', () => {
    const session = EditorSession.create(
      { width: 256, height: 256 },
      { ids: createSequentialIdGenerator() },
    );
    if (!session.ok) throw new Error('could not create session');
    const editor = session.value;
    const random = lcg(42);
    editor.setToolOptions({ brushSize: 3 });

    for (let stroke = 0; stroke < 500; stroke++) {
      editor.setColor('primary', (0xff000000 | Math.floor(random() * 0xffffff)) >>> 0);
      const point = (): { x: number; y: number } => ({
        x: Math.floor(random() * 256),
        y: Math.floor(random() * 256),
      });
      const start = point();
      editor.pointerDown({ ...start, button: 'primary', shift: false });
      for (let i = 0; i < 5; i++) {
        editor.pointerMove({ ...point(), button: 'primary', shift: false });
      }
      const end = point();
      editor.pointerUp({ ...end, button: 'primary', shift: false });
      expect(editor.historyBytes).toBeLessThanOrEqual(DEFAULT_HISTORY_BUDGET_BYTES);
    }

    const finalPixels = editor.activeLayer.buffer.clone();
    let undone = 0;
    while (editor.canUndo) {
      editor.undo();
      undone++;
    }
    // Everything fits in the default 64 MB, so every stroke can be undone.
    expect(undone).toBe(500);
    expect(editor.activeLayer.buffer.data.every((value) => value === 0)).toBe(true);

    while (editor.canRedo) editor.redo();
    expect(editor.activeLayer.buffer.equals(finalPixels)).toBe(true);
  });
});
