import type { MessageKey } from '../i18n';
import type { KeyInput } from './shortcuts';

/**
 * Every shortcut the help panel shows. Entries with an `input` are checked against the real
 * shortcut resolver by a test, so the list cannot drift from what the keys actually do.
 */
export interface ShortcutEntry {
  readonly label: MessageKey;
  /** What to show, with `Ctrl` standing for Cmd on a Mac. */
  readonly keys: string;
  /** The key press this entry describes, for the consistency test. */
  readonly input?: Pick<KeyInput, 'key'> & Partial<KeyInput>;
}

export interface ShortcutGroup {
  readonly title: MessageKey;
  readonly entries: readonly ShortcutEntry[];
}

const mod = { ctrlKey: true } as const;

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'shortcuts.group.tools',
    entries: [
      { label: 'tool.pencil', keys: 'B', input: { key: 'b' } },
      { label: 'tool.eraser', keys: 'E', input: { key: 'e' } },
      { label: 'tool.fill', keys: 'G', input: { key: 'g' } },
      { label: 'tool.eyedropper', keys: 'I', input: { key: 'i' } },
      { label: 'shortcuts.altEyedropper', keys: 'Alt' },
      { label: 'tool.line', keys: 'L', input: { key: 'l' } },
      { label: 'tool.rectangle', keys: 'U', input: { key: 'u' } },
      { label: 'tool.ellipse', keys: 'O', input: { key: 'o' } },
      { label: 'tool.select', keys: 'M', input: { key: 'm' } },
      { label: 'tool.move', keys: 'V', input: { key: 'v' } },
      { label: 'shortcuts.brushSmaller', keys: '[', input: { key: '[' } },
      { label: 'shortcuts.brushBigger', keys: ']', input: { key: ']' } },
    ],
  },
  {
    title: 'shortcuts.group.editing',
    entries: [
      { label: 'edit.undo', keys: 'Ctrl+Z', input: { key: 'z', ...mod } },
      { label: 'edit.redo', keys: 'Ctrl+Shift+Z / Ctrl+Y', input: { key: 'y', ...mod } },
      { label: 'edit.cut', keys: 'Ctrl+X', input: { key: 'x', ...mod } },
      { label: 'edit.copy', keys: 'Ctrl+C', input: { key: 'c', ...mod } },
      { label: 'edit.paste', keys: 'Ctrl+V' },
      { label: 'edit.delete', keys: 'Delete', input: { key: 'Delete' } },
      { label: 'edit.selectAll', keys: 'Ctrl+A', input: { key: 'a', ...mod } },
      { label: 'edit.deselect', keys: 'Ctrl+D', input: { key: 'd', ...mod } },
      { label: 'edit.swapColors', keys: 'X', input: { key: 'x' } },
      { label: 'shortcuts.secondary', keys: '' },
    ],
  },
  {
    title: 'shortcuts.group.view',
    entries: [
      { label: 'view.zoomIn', keys: '+', input: { key: '+' } },
      { label: 'view.zoomOut', keys: '-', input: { key: '-' } },
      { label: 'view.fit', keys: '0', input: { key: '0' } },
      { label: 'view.actualSize', keys: '1', input: { key: '1' } },
      { label: 'shortcuts.pan', keys: 'Space + drag' },
      { label: 'shortcuts.zoomWheel', keys: 'Mouse wheel' },
      { label: 'view.showGrid', keys: "Ctrl+'", input: { key: "'", ...mod } },
      { label: 'view.hidePanels', keys: 'Ctrl+\\', input: { key: '\\', ...mod } },
    ],
  },
  {
    title: 'shortcuts.group.layers',
    entries: [
      { label: 'layer.new', keys: 'Ctrl+Shift+N', input: { key: 'N', shiftKey: true, ...mod } },
      { label: 'layer.duplicate', keys: 'Ctrl+J', input: { key: 'j', ...mod } },
      { label: 'layer.moveUp', keys: 'Ctrl+]', input: { key: ']', ...mod } },
      { label: 'layer.moveDown', keys: 'Ctrl+[', input: { key: '[', ...mod } },
    ],
  },
  {
    title: 'shortcuts.group.file',
    entries: [
      { label: 'file.new', keys: 'Ctrl+N', input: { key: 'n', ...mod } },
      { label: 'file.open', keys: 'Ctrl+O', input: { key: 'o', ...mod } },
      { label: 'file.save', keys: 'Ctrl+S', input: { key: 's', ...mod } },
      { label: 'file.exportPng', keys: 'Ctrl+E', input: { key: 'e', ...mod } },
      { label: 'shortcuts.help', keys: '?', input: { key: '?', shiftKey: true } },
    ],
  },
  {
    title: 'shortcuts.group.canvas',
    entries: [
      { label: 'shortcuts.moveCursor', keys: '← ↑ → ↓' },
      { label: 'shortcuts.moveCursorFar', keys: 'Alt + ← ↑ → ↓' },
      { label: 'shortcuts.drawKeyboard', keys: 'Enter' },
      { label: 'shortcuts.nudge', keys: '← ↑ → ↓' },
      { label: 'shortcuts.drop', keys: 'Enter', input: { key: 'Enter' } },
      { label: 'shortcuts.cancel', keys: 'Esc', input: { key: 'Escape' } },
    ],
  },
];
