import { PALETTE_PRESETS, toHex } from '@vidopix/core';
import type { PaletteFormat } from '@vidopix/core/palette-formats';
import { Download, ImagePlus, Plus, Repeat, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { downloadBlob, safeFileName } from '../../adapters/png-export';
import { Swatch } from '../../design-system/Swatch';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './PalettePanel.module.css';

const COLUMNS = 8;
const MAX_FILE_BYTES = 1024 * 1024;

const FORMATS: readonly { id: PaletteFormat; label: string }[] = [
  { id: 'gpl', label: 'GIMP (.gpl)' },
  { id: 'hex', label: 'Hex list (.hex)' },
  { id: 'json', label: 'JSON (.json)' },
];

export function PalettePanel() {
  const { store } = useEditor();
  const palette = useEditorState((state) => state.palette);
  const primary = useEditorState((state) => state.primary);
  const secondary = useEditorState((state) => state.secondary);
  const mode = useEditorState((state) => state.paletteMode);
  const [format, setFormat] = useState<PaletteFormat>('gpl');
  const [importError, setImportError] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragged = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const actions = store.getState();
  const total = palette.colors.length;
  const activeIndex = Math.max(
    0,
    palette.colors.findIndex((entry) => entry.color === (primary | 0xff000000) >>> 0),
  );

  const focusSwatch = (index: number): void => {
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`[data-index="${String(index)}"]`)?.focus();
    });
  };

  const onSwatchKeyDown = (event: KeyboardEvent, index: number): void => {
    let target: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        target = index + 1;
        break;
      case 'ArrowLeft':
        target = index - 1;
        break;
      case 'ArrowDown':
        target = index + COLUMNS <= total - 1 ? index + COLUMNS : index;
        break;
      case 'ArrowUp':
        target = index - COLUMNS >= 0 ? index - COLUMNS : index;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = total - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        actions.pickPaletteColor(index, event.shiftKey ? 'secondary' : 'primary');
        return;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        actions.removePaletteColor(index);
        focusSwatch(Math.max(0, Math.min(index, total - 2)));
        return;
      case 'F2':
        event.preventDefault();
        setRenamingIndex(index);
        return;
      default:
        return;
    }
    event.preventDefault();
    const clamped = Math.min(total - 1, Math.max(0, target));
    if (event.altKey) actions.movePaletteColor(index, clamped);
    focusSwatch(clamped);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setImportError('That file is too large to be a palette (limit 1 MB)');
      return;
    }
    const { parsePaletteFile } = await import('@vidopix/core/palette-formats');
    const parsed = parsePaletteFile(await file.text(), file.name);
    if (!parsed.ok) {
      const { message, line } = parsed.error;
      setImportError(line === undefined ? message : `Line ${String(line)}: ${message}`);
      return;
    }
    setImportError(null);
    const fallbackName = file.name.replace(/\.[^.]+$/, '');
    actions.loadPaletteColors(parsed.value.name ?? fallbackName, parsed.value.colors);
  };

  const exportPalette = async (): Promise<void> => {
    const formats = await import('@vidopix/core/palette-formats');
    const text =
      format === 'gpl'
        ? formats.exportGpl(palette)
        : format === 'hex'
          ? formats.exportHex(palette)
          : formats.exportJson(palette);
    const type = format === 'json' ? 'application/json' : 'text/plain';
    downloadBlob(new Blob([text], { type }), safeFileName(palette.name, format));
  };

  const onDrop = (event: DragEvent, target: number): void => {
    event.preventDefault();
    const from = dragged.current;
    dragged.current = null;
    setDropIndex(null);
    if (from !== null && from !== target) actions.movePaletteColor(from, target);
  };

  const renamingEntry = renamingIndex === null ? undefined : palette.colors[renamingIndex];

  return (
    <section className={styles.panel} aria-labelledby="palette-heading">
      <div className={styles.row}>
        {renamingName ? (
          <input
            className={styles.select}
            aria-label="Palette name"
            defaultValue={palette.name}
            maxLength={60}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- replaces the name the user chose to edit
            autoFocus
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                actions.renamePalette(event.currentTarget.value);
                setRenamingName(false);
              } else if (event.key === 'Escape') {
                setRenamingName(false);
              }
            }}
            onBlur={(event) => {
              actions.renamePalette(event.currentTarget.value);
              setRenamingName(false);
            }}
          />
        ) : (
          <h2 id="palette-heading" className={styles.title}>
            <button
              type="button"
              className={styles.titleButton}
              aria-label={`Palette: ${palette.name}. Activate to rename`}
              onClick={() => {
                setRenamingName(true);
              }}
            >
              {palette.name}
            </button>
          </h2>
        )}
        <span className={styles.hint}>{total} / 256</span>
      </div>

      <div className={styles.row}>
        <select
          className={styles.select}
          aria-label="Load a preset palette"
          value=""
          onChange={(event) => {
            if (event.target.value !== '') actions.loadPreset(event.target.value);
          }}
        >
          <option value="">Load preset…</option>
          {PALETTE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({String(preset.colors.length)})
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Import palette file"
          title="Import palette file (.gpl, .hex, .json)"
          onClick={() => {
            fileInput.current?.click();
          }}
        >
          <Upload size={15} aria-hidden="true" />
        </button>
        <input
          ref={fileInput}
          className={styles.visuallyHidden}
          type="file"
          accept=".gpl,.hex,.json,.txt,text/plain,application/json"
          aria-label="Palette file"
          tabIndex={-1}
          onChange={(event) => {
            void onFile(event);
          }}
        />
      </div>

      <div className={styles.row} role="group" aria-label="Loading a palette">
        <span className={styles.hint}>When loading:</span>
        <div className={styles.segmented}>
          {(['replace', 'append'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={styles.segment}
              aria-pressed={mode === value}
              onClick={() => {
                actions.setPaletteMode(value);
              }}
            >
              {value === 'replace' ? 'Replace' : 'Add to current'}
            </button>
          ))}
        </div>
      </div>

      {importError ? (
        <p className={styles.error} role="alert">
          {importError}
        </p>
      ) : null}

      <div className={styles.row}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Add current color to the palette"
          title="Add current color"
          onClick={() => {
            actions.addColorToPalette();
          }}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Extract a palette from an image"
          title="Extract palette from an image…"
          onClick={() => {
            actions.openDialog('extract-palette');
          }}
        >
          <ImagePlus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Replace a color in the drawing"
          title="Replace a color in the drawing…"
          onClick={() => {
            actions.openDialog('replace-color');
          }}
        >
          <Repeat size={15} aria-hidden="true" />
        </button>
        <select
          className={styles.select}
          aria-label="Export format"
          value={format}
          onChange={(event) => {
            setFormat(event.target.value as PaletteFormat);
          }}
        >
          {FORMATS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Export palette"
          title="Export palette"
          disabled={total === 0}
          onClick={() => {
            void exportPalette();
          }}
        >
          <Download size={15} aria-hidden="true" />
        </button>
      </div>

      {total === 0 ? (
        <p className={styles.empty}>
          The palette is empty. Add the current color, load a preset or extract colors from an
          image.
        </p>
      ) : (
        <div ref={gridRef} className={styles.grid} role="group" aria-label="Palette colors">
          {palette.colors.map((entry, index) => {
            const hex = toHex(entry.color).toUpperCase();
            const isPrimary = entry.color === (primary | 0xff000000) >>> 0;
            const isSecondary = entry.color === (secondary | 0xff000000) >>> 0;
            const status = [isPrimary ? 'primary color' : '', isSecondary ? 'secondary color' : '']
              .filter(Boolean)
              .join(', ');
            return (
              <Swatch
                key={entry.color}
                data-index={index}
                background={toCssColor(entry.color)}
                slot={isPrimary ? 'primary' : isSecondary ? 'secondary' : undefined}
                dropTarget={dropIndex === index}
                aria-label={`${entry.name ? `${entry.name}, ` : ''}${hex}, ${String(index + 1)} of ${String(total)}${status ? `, ${status}` : ''}`}
                title={entry.name ? `${entry.name} ${hex}` : hex}
                tabIndex={index === activeIndex ? 0 : -1}
                draggable
                onClick={(event) => {
                  actions.pickPaletteColor(index, event.shiftKey ? 'secondary' : 'primary');
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  actions.pickPaletteColor(index, 'secondary');
                }}
                onDoubleClick={() => {
                  setRenamingIndex(index);
                }}
                onKeyDown={(event) => {
                  onSwatchKeyDown(event, index);
                }}
                onDragStart={(event) => {
                  dragged.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(event) => {
                  if (dragged.current === null) return;
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDragLeave={() => {
                  setDropIndex((current) => (current === index ? null : current));
                }}
                onDrop={(event) => {
                  onDrop(event, index);
                }}
                onDragEnd={() => {
                  dragged.current = null;
                  setDropIndex(null);
                }}
              />
            );
          })}
        </div>
      )}

      {renamingIndex !== null && renamingEntry ? (
        <div className={styles.row}>
          <input
            className={styles.select}
            aria-label={`Name for ${toHex(renamingEntry.color).toUpperCase()}`}
            defaultValue={renamingEntry.name ?? ''}
            maxLength={60}
            placeholder="Color name"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- opened on request to name this color
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                actions.renamePaletteColor(renamingIndex, event.currentTarget.value);
                setRenamingIndex(null);
                focusSwatch(renamingIndex);
              } else if (event.key === 'Escape') {
                setRenamingIndex(null);
                focusSwatch(renamingIndex);
              }
            }}
          />
        </div>
      ) : null}

      {total > 0 ? (
        <p className={styles.hint}>
          Click: primary. Shift+click or right click: secondary. Arrows move, Alt+arrows reorder, F2
          renames, Delete removes.
        </p>
      ) : null}
    </section>
  );
}
