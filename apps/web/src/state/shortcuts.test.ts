import { describe, expect, it } from 'vitest';
import { isMacPlatform, isTextEntry, resolveShortcut, type KeyInput } from './shortcuts';

const key = (name: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key: name,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe('resolveShortcut', () => {
  it.each([
    ['b', 'pencil'],
    ['e', 'eraser'],
    ['g', 'fill'],
    ['i', 'eyedropper'],
    ['l', 'line'],
    ['u', 'rectangle'],
    ['o', 'ellipse'],
    ['m', 'select'],
    ['v', 'move'],
  ])('selects a tool with %s', (letter, tool) => {
    expect(resolveShortcut(key(letter), false)).toEqual({ type: 'tool', tool });
    expect(resolveShortcut(key(letter.toUpperCase()), false)).toEqual({ type: 'tool', tool });
  });

  it('handles single-key actions', () => {
    expect(resolveShortcut(key('x'), false)).toEqual({ type: 'swap-colors' });
    expect(resolveShortcut(key('['), false)).toEqual({ type: 'brush-size', delta: -1 });
    expect(resolveShortcut(key(']'), false)).toEqual({ type: 'brush-size', delta: 1 });
    expect(resolveShortcut(key('+'), false)).toEqual({ type: 'zoom-in' });
    expect(resolveShortcut(key('='), false)).toEqual({ type: 'zoom-in' });
    expect(resolveShortcut(key('-'), false)).toEqual({ type: 'zoom-out' });
    expect(resolveShortcut(key('0'), false)).toEqual({ type: 'zoom-fit' });
    expect(resolveShortcut(key('1'), false)).toEqual({ type: 'zoom-100' });
    expect(resolveShortcut(key('Escape'), false)).toEqual({ type: 'cancel' });
  });

  it('uses Ctrl on Windows/Linux and Cmd on macOS for the modifier shortcuts', () => {
    expect(resolveShortcut(key('z', { ctrlKey: true }), false)).toEqual({ type: 'undo' });
    expect(resolveShortcut(key('z', { metaKey: true }), true)).toEqual({ type: 'undo' });
    expect(resolveShortcut(key('z', { metaKey: true }), false)).toBeNull();
    expect(resolveShortcut(key('z', { ctrlKey: true }), true)).toBeNull();
  });

  it('supports both redo shortcuts', () => {
    expect(resolveShortcut(key('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({
      type: 'redo',
    });
    expect(resolveShortcut(key('y', { ctrlKey: true }), false)).toEqual({ type: 'redo' });
  });

  it('maps the file and view shortcuts', () => {
    expect(resolveShortcut(key('n', { ctrlKey: true }), false)).toEqual({ type: 'new-sprite' });
    expect(resolveShortcut(key('e', { ctrlKey: true }), false)).toEqual({ type: 'export' });
    expect(resolveShortcut(key("'", { ctrlKey: true }), false)).toEqual({ type: 'toggle-grid' });
    expect(resolveShortcut(key('\\', { ctrlKey: true }), false)).toEqual({
      type: 'toggle-panels',
    });
  });

  it('maps selection, clipboard and layer shortcuts', () => {
    const mod = { ctrlKey: true };
    expect(resolveShortcut(key('a', mod), false)).toEqual({ type: 'select-all' });
    expect(resolveShortcut(key('d', mod), false)).toEqual({ type: 'deselect' });
    expect(resolveShortcut(key('c', mod), false)).toEqual({ type: 'copy' });
    expect(resolveShortcut(key('x', mod), false)).toEqual({ type: 'cut' });
    expect(resolveShortcut(key('j', mod), false)).toEqual({ type: 'duplicate-layer' });
    expect(resolveShortcut(key('N', { ...mod, shiftKey: true }), false)).toEqual({
      type: 'new-layer',
    });
    expect(resolveShortcut(key(']', mod), false)).toEqual({ type: 'layer-up' });
    expect(resolveShortcut(key('[', mod), false)).toEqual({ type: 'layer-down' });
    expect(resolveShortcut(key('Delete'), false)).toEqual({ type: 'delete-selection' });
    expect(resolveShortcut(key('Backspace'), false)).toEqual({ type: 'delete-selection' });
    expect(resolveShortcut(key('Enter'), false)).toEqual({ type: 'commit' });
    // Paste is left to the browser's paste event, which can read images without a prompt.
    expect(resolveShortcut(key('v', mod), false)).toBeNull();
  });

  it('maps opening, saving and help', () => {
    expect(resolveShortcut(key('o', { ctrlKey: true }), false)).toEqual({ type: 'open-file' });
    expect(resolveShortcut(key('s', { ctrlKey: true }), false)).toEqual({ type: 'save-file' });
    expect(resolveShortcut(key('?', { shiftKey: true }), false)).toEqual({
      type: 'shortcuts-help',
    });
  });

  it('does not steal browser shortcuts or Alt combinations', () => {
    expect(resolveShortcut(key('b', { altKey: true }), false)).toBeNull();
    expect(resolveShortcut(key('n', { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(resolveShortcut(key('r', { ctrlKey: true }), false)).toBeNull();
    expect(resolveShortcut(key('q'), false)).toBeNull();
    expect(resolveShortcut(key('Tab'), false)).toBeNull();
  });
});

describe('isMacPlatform', () => {
  it('detects Apple platforms', () => {
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('iPhone')).toBe(true);
    expect(isMacPlatform('Win32')).toBe(false);
    expect(isMacPlatform('Linux x86_64')).toBe(false);
  });
});

describe('isTextEntry', () => {
  it('treats text fields as text entry but not sliders or buttons', () => {
    const text = document.createElement('input');
    text.type = 'text';
    const range = document.createElement('input');
    range.type = 'range';
    expect(isTextEntry(text)).toBe(true);
    expect(isTextEntry(document.createElement('textarea'))).toBe(true);
    expect(isTextEntry(document.createElement('select'))).toBe(true);
    expect(isTextEntry(range)).toBe(false);
    expect(isTextEntry(document.createElement('button'))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });

  it('treats editable content as text entry', () => {
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isTextEntry(editable)).toBe(true);
  });
});
