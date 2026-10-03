import type { ToolId } from '@vidopix/core';
import {
  ArrowLeftRight,
  Circle,
  Eraser,
  Minus,
  Pencil,
  PaintBucket,
  Pipette,
  Square,
  type LucideIcon,
} from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../../design-system/cx';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './Toolbar.module.css';

interface ToolEntry {
  readonly id: ToolId;
  readonly label: string;
  readonly key: string;
  readonly icon: LucideIcon;
}

const TOOLS: readonly ToolEntry[] = [
  { id: 'pencil', label: 'Pencil', key: 'B', icon: Pencil },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser },
  { id: 'fill', label: 'Fill', key: 'G', icon: PaintBucket },
  { id: 'eyedropper', label: 'Eyedropper', key: 'I', icon: Pipette },
  { id: 'line', label: 'Line', key: 'L', icon: Minus },
  { id: 'rectangle', label: 'Rectangle', key: 'U', icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', icon: Circle },
];

export function Toolbar() {
  const { store } = useEditor();
  const activeTool = useEditorState((state) => state.tool);
  const primary = useEditorState((state) => state.primary);
  const secondary = useEditorState((state) => state.secondary);
  const editingSlot = useEditorState((state) => state.editingSlot);
  const containerRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: one stop in the Tab order, arrows move between tools.
  const onKeyDown = (event: KeyboardEvent): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>('[data-tool]') ?? [],
    );
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else next = buttons.length - 1;
    buttons[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={styles.toolbar}
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => {
        const pressed = id === activeTool;
        return (
          <button
            key={id}
            type="button"
            className={styles.tool}
            data-tool={id}
            data-tooltip={`${label} (${key})`}
            aria-label={label}
            aria-keyshortcuts={key}
            aria-pressed={pressed}
            tabIndex={pressed ? 0 : -1}
            onClick={() => {
              store.getState().selectTool(id);
            }}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        );
      })}
      <div className={styles.spacer} />
      <div className={styles.colors}>
        <button
          type="button"
          className={cx(styles.swatch, styles.secondary)}
          style={{ background: toCssColor(secondary) }}
          aria-label="Secondary color"
          aria-pressed={editingSlot === 'secondary'}
          onClick={() => {
            store.getState().setEditingSlot('secondary');
          }}
        />
        <button
          type="button"
          className={cx(styles.swatch, styles.primary)}
          style={{ background: toCssColor(primary) }}
          aria-label="Primary color"
          aria-pressed={editingSlot === 'primary'}
          onClick={() => {
            store.getState().setEditingSlot('primary');
          }}
        />
      </div>
      <button
        type="button"
        className={styles.swap}
        data-tooltip="Swap colors (X)"
        aria-label="Swap colors"
        aria-keyshortcuts="X"
        onClick={() => {
          store.getState().swapColors();
        }}
      >
        <ArrowLeftRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
