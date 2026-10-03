import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { cx } from '../../design-system/cx';
import { Slider } from '../../design-system/Field';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './LayersPanel.module.css';

interface ActionProps {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

function Action({ label, icon: Icon, disabled = false, onClick }: ActionProps) {
  return (
    <button
      type="button"
      className={styles.action}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

export function LayersPanel() {
  const { store } = useEditor();
  const layers = useEditorState((state) => state.layers);
  const activeId = useEditorState((state) => state.activeLayerId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const draggedId = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const actions = store.getState();
  const activeIndex = layers.findIndex((layer) => layer.id === activeId);
  const active = layers[activeIndex];
  // The list shows the top layer first; the model counts from the bottom.
  const rows = [...layers].reverse();

  const focusRow = (id: string): void => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-name="${id}"]`)?.focus();
    });
  };

  const onNameKeyDown = (event: KeyboardEvent, id: string, displayIndex: number): void => {
    if (event.key === 'F2') {
      event.preventDefault();
      setRenamingId(id);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const up = event.key === 'ArrowUp';
    if (event.altKey) {
      actions.moveLayer(id, layers.length - 1 - displayIndex + (up ? 1 : -1));
      focusRow(id);
      return;
    }
    const neighbor = rows[displayIndex + (up ? -1 : 1)];
    if (neighbor) {
      actions.setActiveLayer(neighbor.id);
      focusRow(neighbor.id);
    }
  };

  const onDrop = (event: DragEvent, targetDisplayIndex: number): void => {
    event.preventDefault();
    const id = draggedId.current;
    draggedId.current = null;
    setDropId(null);
    if (id) actions.moveLayer(id, layers.length - 1 - targetDisplayIndex);
  };

  return (
    <section className={styles.panel} aria-labelledby="layers-heading">
      <h2 id="layers-heading" className={styles.heading}>
        Layers
      </h2>
      <div className={styles.actions} role="group" aria-label="Layer actions">
        <Action
          label="New layer"
          icon={Plus}
          onClick={() => {
            actions.addLayer();
          }}
        />
        <Action
          label="Duplicate layer"
          icon={Copy}
          onClick={() => {
            actions.duplicateLayer();
          }}
        />
        <Action
          label="Delete layer"
          icon={Trash2}
          disabled={layers.length <= 1}
          onClick={() => {
            actions.deleteLayer();
          }}
        />
        <Action
          label="Merge down"
          icon={ArrowDownToLine}
          disabled={activeIndex <= 0}
          onClick={() => {
            actions.mergeDown();
          }}
        />
        <Action
          label="Flatten image"
          icon={Layers}
          disabled={layers.length <= 1}
          onClick={() => {
            actions.flatten();
          }}
        />
        <Action
          label="Move layer up"
          icon={ArrowUp}
          disabled={activeIndex < 0 || activeIndex >= layers.length - 1}
          onClick={() => {
            actions.shiftActiveLayer(1);
          }}
        />
        <Action
          label="Move layer down"
          icon={ArrowDown}
          disabled={activeIndex <= 0}
          onClick={() => {
            actions.shiftActiveLayer(-1);
          }}
        />
      </div>

      <ul ref={listRef} className={styles.list} aria-label="Layer list">
        {rows.map((layer, displayIndex) => {
          const isActive = layer.id === activeId;
          const description = [
            layer.name,
            layer.locked ? 'locked' : '',
            layer.visible ? '' : 'hidden',
          ]
            .filter(Boolean)
            .join(', ');
          return (
            // Dragging is a mouse shortcut; the same reordering is available from the keyboard (Alt+arrows)
            // and from the move up/down buttons, so the row itself is not a control.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={layer.id}
              className={styles.row}
              data-active={isActive}
              data-drop={dropId === layer.id}
              draggable={renamingId === null}
              onDragStart={(event) => {
                draggedId.current = layer.id;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', layer.id);
              }}
              onDragOver={(event) => {
                if (draggedId.current === null) return;
                event.preventDefault();
                setDropId(layer.id);
              }}
              onDragLeave={() => {
                setDropId((current) => (current === layer.id ? null : current));
              }}
              onDrop={(event) => {
                onDrop(event, displayIndex);
              }}
              onDragEnd={() => {
                draggedId.current = null;
                setDropId(null);
              }}
            >
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={layer.visible}
                aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
                onClick={() => {
                  actions.setLayerVisible(layer.id, !layer.visible);
                }}
              >
                {layer.visible ? (
                  <Eye size={14} aria-hidden="true" />
                ) : (
                  <EyeOff size={14} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                className={styles.toggle}
                aria-pressed={layer.locked}
                aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                onClick={() => {
                  actions.setLayerLocked(layer.id, !layer.locked);
                }}
              >
                {layer.locked ? (
                  <Lock size={14} aria-hidden="true" />
                ) : (
                  <LockOpen size={14} aria-hidden="true" />
                )}
              </button>
              {renamingId === layer.id ? (
                <input
                  className={styles.rename}
                  aria-label={`Rename ${layer.name}`}
                  defaultValue={layer.name}
                  maxLength={60}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the field replaces the name the user just chose to edit
                  autoFocus
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      actions.renameLayer(layer.id, event.currentTarget.value);
                      setRenamingId(null);
                      focusRow(layer.id);
                    } else if (event.key === 'Escape') {
                      event.stopPropagation();
                      setRenamingId(null);
                      focusRow(layer.id);
                    }
                  }}
                  onBlur={(event) => {
                    if (renamingId === layer.id)
                      actions.renameLayer(layer.id, event.currentTarget.value);
                    setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={cx(styles.name, !layer.visible && styles.dim)}
                  data-name={layer.id}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={description}
                  aria-keyshortcuts="F2 Alt+ArrowUp Alt+ArrowDown"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    actions.setActiveLayer(layer.id);
                  }}
                  onDoubleClick={() => {
                    setRenamingId(layer.id);
                  }}
                  onKeyDown={(event) => {
                    onNameKeyDown(event, layer.id, displayIndex);
                  }}
                >
                  {layer.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {active ? (
        <Slider
          label="Opacity"
          value={Math.round(active.opacity * 100)}
          min={0}
          max={100}
          display={`${String(Math.round(active.opacity * 100))}%`}
          onChange={(percent) => {
            actions.previewLayerOpacity(active.id, percent / 100);
          }}
          onCommit={(percent) => {
            actions.commitLayerOpacity(active.id, percent / 100);
          }}
        />
      ) : null}
    </section>
  );
}
