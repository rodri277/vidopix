import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { SHORTCUT_GROUPS } from './shortcut-table';
import { resolveShortcut } from './shortcuts';

describe('shortcut help table', () => {
  const entries = SHORTCUT_GROUPS.flatMap((group) => group.entries);

  it('only lists keys that really do something', () => {
    for (const entry of entries) {
      if (!entry.input) continue;
      const input = {
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...entry.input,
      };
      expect(resolveShortcut(input, false), `${entry.label} (${entry.keys})`).not.toBeNull();
    }
  });

  it('uses only texts that exist', () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(en[group.title]).toBeTruthy();
      for (const entry of group.entries) expect(en[entry.label]).toBeTruthy();
    }
  });

  it('covers every tool shortcut', () => {
    const labels = new Set(entries.map((entry) => entry.label));
    for (const tool of [
      'pencil',
      'eraser',
      'fill',
      'eyedropper',
      'line',
      'rectangle',
      'ellipse',
      'select',
      'move',
    ]) {
      expect(labels.has(`tool.${tool}` as never), tool).toBe(true);
    }
  });
});
