import {
  DEFAULT_SHEET_COLUMNS,
  MAX_EXPORT_SCALE,
  MIN_EXPORT_SCALE,
  MAX_FRAMES,
  buildSpritesheet,
  packRgba,
  sheetGrid,
  type SheetError,
} from '@vidopix/core';
import { useRef, useState } from 'react';
import { GifExportCanceled, startGifExport, type GifExport } from '../../adapters/gif-export';
import { downloadBlob, encodePng, safeFileName } from '../../adapters/png-export';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Checkbox, Slider } from '../../design-system/Field';
import fieldStyles from '../../design-system/Field.module.css';
import { useT } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './NewSpriteDialog.module.css';

const OPAQUE_WHITE = packRgba(255, 255, 255, 255);

type Format = 'png' | 'gif' | 'sheet';

export function ExportDialog() {
  const { session, store } = useEditor();
  const t = useT();
  const width = useEditorState((state) => state.spriteWidth);
  const height = useEditorState((state) => state.spriteHeight);
  const name = useEditorState((state) => state.spriteName);
  const frames = useEditorState((state) => state.frames);
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState(1);
  const [columns, setColumns] = useState(DEFAULT_SHEET_COLUMNS);
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const gif = useRef<GifExport | null>(null);

  const close = (): void => {
    gif.current?.cancel();
    store.getState().closeDialog();
  };

  const background = transparent ? {} : { background: OPAQUE_WHITE };

  const sizeError = (reason: SheetError | { kind: string; [key: string]: unknown }): string =>
    reason.kind === 'too-large'
      ? t('export.tooLarge', {
          width: Number(reason.width),
          height: Number(reason.height),
          max: Number(reason.max),
        })
      : t('export.invalidScale');

  const exportPng = async (): Promise<void> => {
    const image = session.exportImage({ scale, ...background });
    if (!image.ok) {
      setError(sizeError(image.error));
      return;
    }
    downloadBlob(await encodePng(image.value), safeFileName(name, 'png'));
    store.getState().closeDialog();
  };

  const exportSheet = async (): Promise<void> => {
    const imageName = safeFileName(name, 'png');
    const sheet = buildSpritesheet(session.sprite, {
      scale,
      columns,
      imageName,
      ...background,
    });
    if (!sheet.ok) {
      setError(
        sheet.error.kind === 'invalid-columns' ? t('export.sheetFailed') : sizeError(sheet.error),
      );
      return;
    }
    downloadBlob(await encodePng(sheet.value.image), imageName);
    downloadBlob(
      new Blob([JSON.stringify(sheet.value.data, null, 2)], { type: 'application/json' }),
      safeFileName(name, 'json'),
    );
    store.getState().closeDialog();
  };

  const exportGif = async (): Promise<void> => {
    const started = startGifExport(session.sprite, { scale, ...background }, setProgress);
    gif.current = started;
    try {
      downloadBlob(await started.result, safeFileName(name, 'gif'));
      store.getState().closeDialog();
    } catch (failure) {
      setError(failure instanceof GifExportCanceled ? null : t('export.gifFailed'));
    } finally {
      gif.current = null;
    }
  };

  const run = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      if (format === 'png') await exportPng();
      else if (format === 'sheet') await exportSheet();
      else await exportGif();
    } catch {
      setError(
        format === 'gif'
          ? t('export.gifFailed')
          : format === 'sheet'
            ? t('export.sheetFailed')
            : t('export.failed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const grid = sheetGrid(frames.length, columns);
  const seconds = frames.reduce((sum, frame) => sum + frame.duration, 0) / 1000;

  return (
    <Dialog
      title={t('export.title')}
      onClose={close}
      onSubmit={() => {
        void run();
      }}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('export.export')}
          </Button>
        </>
      }
    >
      <label className={fieldStyles.field}>
        {t('export.format')}
        <select
          className={fieldStyles.input}
          value={format}
          disabled={busy}
          onChange={(event) => {
            setFormat(event.target.value as Format);
            setError(null);
          }}
        >
          <option value="png">{t('export.formatPng')}</option>
          <option value="gif">{t('export.formatGif')}</option>
          <option value="sheet">{t('export.formatSheet')}</option>
        </select>
      </label>
      <Slider
        label={t('export.scale')}
        value={scale}
        min={MIN_EXPORT_SCALE}
        max={MAX_EXPORT_SCALE}
        display={`×${String(scale)}`}
        onChange={setScale}
      />
      {format === 'sheet' ? (
        <label className={fieldStyles.field}>
          {t('export.columns')}
          <input
            className={fieldStyles.input}
            type="number"
            min={1}
            max={MAX_FRAMES}
            value={columns}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              setColumns(Number.isFinite(value) ? Math.round(value) : DEFAULT_SHEET_COLUMNS);
            }}
          />
        </label>
      ) : null}
      <Checkbox label={t('export.transparent')} checked={transparent} onChange={setTransparent} />
      <p className={styles.hint}>
        {format === 'sheet'
          ? t('export.sheetSize', {
              width: width * scale * grid.columns,
              height: height * scale * grid.rows,
              frames: frames.length,
            })
          : format === 'gif'
            ? t('export.gifSize', {
                width: width * scale,
                height: height * scale,
                frames: frames.length,
                seconds: seconds.toFixed(2),
              })
            : t('export.size', { width: width * scale, height: height * scale })}
      </p>
      {format === 'gif' ? <p className={styles.hint}>{t('export.gifHint')}</p> : null}
      {format === 'sheet' ? <p className={styles.hint}>{t('export.sheetHint')}</p> : null}
      {busy && format === 'gif' ? (
        <p className={styles.hint} role="status">
          {t('export.encoding', { percent: Math.round(progress * 100) })}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
