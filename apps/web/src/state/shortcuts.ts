import type { ToolId } from '@vidopix/core';

export type ShortcutAction =
  | { readonly type: 'tool'; readonly tool: ToolId }
  | { readonly type: 'swap-colors' }
  | { readonly type: 'brush-size'; readonly delta: number }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'zoom-in' }
  | { readonly type: 'zoom-out' }
  | { readonly type: 'zoom-fit' }
  | { readonly type: 'zoom-100' }
  | { readonly type: 'toggle-grid' }
  | { readonly type: 'toggle-panels' }
  | { readonly type: 'new-sprite' }
  | { readonly type: 'export' }
  | { readonly type: 'cancel' }
  | { readonly type: 'select-all' }
  | { readonly type: 'deselect' }
  | { readonly type: 'delete-selection' }
  | { readonly type: 'copy' }
  | { readonly type: 'cut' }
  | { readonly type: 'new-layer' }
  | { readonly type: 'duplicate-layer' }
  | { readonly type: 'commit' }
  | { readonly type: 'layer-up' }
  | { readonly type: 'layer-down' };

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const TOOL_KEYS: Readonly<Record<string, ToolId>> = {
  b: 'pencil',
  e: 'eraser',
  g: 'fill',
  i: 'eyedropper',
  l: 'line',
  u: 'rectangle',
  o: 'ellipse',
  m: 'select',
  v: 'move',
};

/** Ctrl on Windows and Linux, Cmd on macOS. */
export function isMacPlatform(platform: string): boolean {
  return /mac|iphone|ipad/i.test(platform);
}

/** Maps a key press to an editor action. The single place where shortcuts are defined. */
export function resolveShortcut(input: KeyInput, isMac: boolean): ShortcutAction | null {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const mod = isMac ? input.metaKey : input.ctrlKey;
  const otherMod = isMac ? input.ctrlKey : input.metaKey;
  if (otherMod) return null;

  if (mod) {
    if (key === 'z') return { type: input.shiftKey ? 'redo' : 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (input.altKey) return null;
    if (key === 'n') return { type: input.shiftKey ? 'new-layer' : 'new-sprite' };
    if (key === 'a') return { type: 'select-all' };
    if (key === 'd') return { type: 'deselect' };
    if (key === 'c') return { type: 'copy' };
    if (key === 'x') return { type: 'cut' };
    if (key === 'j') return { type: 'duplicate-layer' };
    if (key === ']') return { type: 'layer-up' };
    if (key === '[') return { type: 'layer-down' };
    if (key === 'e') return { type: 'export' };
    if (key === "'") return { type: 'toggle-grid' };
    if (key === '\\') return { type: 'toggle-panels' };
    return null;
  }

  if (input.altKey) return null;
  if (key === 'Escape') return { type: 'cancel' };
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete-selection' };
  if (key === 'Enter') return { type: 'commit' };
  const tool = TOOL_KEYS[key];
  if (tool) return { type: 'tool', tool };
  switch (key) {
    case 'x':
      return { type: 'swap-colors' };
    case '[':
      return { type: 'brush-size', delta: -1 };
    case ']':
      return { type: 'brush-size', delta: 1 };
    case '+':
    case '=':
      return { type: 'zoom-in' };
    case '-':
      return { type: 'zoom-out' };
    case '0':
      return { type: 'zoom-fit' };
    case '1':
      return { type: 'zoom-100' };
    default:
      return null;
  }
}

/** Keys typed into these elements must never trigger editor shortcuts. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button'].includes(target.type);
  }
  return false;
}
