import type { ToolId } from '@vidopix/core';
import {
  ArrowLeftRight,
  Circle,
  Eraser,
  Minus,
  Move,
  Pencil,
  PaintBucket,
  Pipette,
  Square,
  SquareDashed,
  type LucideIcon,
} from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import type { MessageKey } from '../../i18n';
import { useT } from '../../i18n/useT';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './Toolbar.module.css';

interface ToolEntry {
  readonly id: ToolId;
  readonly label: MessageKey;
  readonly key: string;
  readonly icon: LucideIcon;
}

const TOOLS: readonly ToolEntry[] = [
  { id: 'pencil', label: 'tool.pencil', key: 'B', icon: Pencil },
  { id: 'eraser', label: 'tool.eraser', key: 'E', icon: Eraser },
  { id: 'fill', label: 'tool.fill', key: 'G', icon: PaintBucket },
  { id: 'eyedropper', label: 'tool.eyedropper', key: 'I', icon: Pipette },
  { id: 'line', label: 'tool.line', key: 'L', icon: Minus },
  { id: 'rectangle', label: 'tool.rectangle', key: 'U', icon: Square },
  { id: 'ellipse', label: 'tool.ellipse', key: 'O', icon: Circle },
  { id: 'select', label: 'tool.select', key: 'M', icon: SquareDashed },
  { id: 'move', label: 'tool.move', key: 'V', icon: Move },
];

export function Toolbar() {
  const { store } = useEditor();
  const t = useT();
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
      aria-label={t('toolbar.tools')}
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
    >
      {TOOLS.map(({ id, label: labelKey, key, icon: Icon }) => {
        const pressed = id === activeTool;
        const label = t(labelKey);
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
          className={styles.swatch}
          style={{ background: toCssColor(primary) }}
          aria-label={t('toolbar.primary')}
          aria-pressed={editingSlot === 'primary'}
          onClick={() => {
            store.getState().setEditingSlot('primary');
          }}
        />
        <button
          type="button"
          className={styles.swatch}
          style={{ background: toCssColor(secondary) }}
          aria-label={t('toolbar.secondary')}
          aria-pressed={editingSlot === 'secondary'}
          onClick={() => {
            store.getState().setEditingSlot('secondary');
          }}
        />
      </div>
      <button
        type="button"
        className={styles.swap}
        data-tooltip={t('toolbar.swapTip')}
        aria-label={t('toolbar.swap')}
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
