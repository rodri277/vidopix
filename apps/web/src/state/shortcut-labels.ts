import { isMacPlatform } from './shortcuts';

const isMac = isMacPlatform(typeof navigator === 'undefined' ? '' : navigator.platform);

/** Human-readable text for a modifier shortcut, using the symbol for the current platform. */
export function shortcutLabel(keys: string): string {
  const modifier = isMac ? '⌘' : 'Ctrl+';
  const shift = isMac ? '⇧' : 'Shift+';
  return keys.startsWith('Shift+')
    ? `${modifier}${shift}${keys.slice('Shift+'.length)}`
    : `${modifier}${keys}`;
}

/** Turns a table entry such as `Ctrl+Shift+Z / Ctrl+Y` into the symbols of this platform. */
export function shortcutKeys(keys: string): string {
  if (!isMac) return keys;
  return keys
    .replace(/Ctrl\+/g, '⌘')
    .replace(/Shift\+/g, '⇧')
    .replace(/Alt/g, '⌥');
}
