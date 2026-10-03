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
