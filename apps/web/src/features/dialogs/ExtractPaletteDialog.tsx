import { toHex, type Color } from '@vidopix/core';
import { useEffect, useRef, useState } from 'react';
import {
  ExtractionCanceled,
  startExtraction,
  type Extraction,
  type ExtractPhase,
} from '../../adapters/palette-extractor';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Slider, TextField } from '../../design-system/Field';
import { toCssColor } from '../../state/css-color';
import { useT } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import hintStyles from './NewSpriteDialog.module.css';
import styles from './ExtractPaletteDialog.module.css';

type Status = 'idle' | 'working' | 'done' | 'canceled' | 'error';

export function ExtractPaletteDialog() {
  const { store } = useEditor();
  const t = useT();
  const mode = useEditorState((state) => state.paletteMode);
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(16);
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState<ExtractPhase>('decoding');
  const [progress, setProgress] = useState(0);
  const [colors, setColors] = useState<readonly Color[]>([]);
  const [message, setMessage] = useState('');
  const running = useRef<Extraction | null>(null);

  useEffect(
    () => () => {
      running.current?.cancel();
    },
    [],
  );

  const close = (): void => {
    running.current?.cancel();
    store.getState().closeDialog();
  };

  const extract = (): void => {
    if (!file || status === 'working') return;
    setStatus('working');
    setColors([]);
    setProgress(0);
    setPhase('decoding');
    const extraction = startExtraction(file, count, (nextPhase, value) => {
      setPhase(nextPhase);
      setProgress(value);
    });
    running.current = extraction;
    extraction.result
      .then((found) => {
        setColors(found);
        setStatus(found.length === 0 ? 'error' : 'done');
        setMessage(found.length === 0 ? t('extract.noPixels') : '');
      })
      .catch((error: unknown) => {
        if (error instanceof ExtractionCanceled) {
          setStatus('canceled');
          setMessage(t('extract.canceled'));
        } else {
          setStatus('error');
          setMessage(t('extract.readFailed'));
        }
      })
      .finally(() => {
        running.current = null;
      });
  };

  const apply = (): void => {
    const name = file ? file.name.replace(/\.[^.]+$/, '') : undefined;
    store.getState().loadPaletteColors(
      name,
      colors.map((color) => ({ color })),
    );
    store.getState().closeDialog();
  };

  const working = status === 'working';

  return (
    <Dialog
      title={t('extract.title')}
      onClose={close}
      onSubmit={status === 'done' ? apply : extract}
      footer={
        <>
          {working ? (
            <Button
              onClick={() => {
                running.current?.cancel();
              }}
            >
              {t('extract.cancel')}
            </Button>
          ) : (
            <Button onClick={close}>{t('common.close')}</Button>
          )}
          {status === 'done' ? (
            <Button type="submit" variant="primary">
              {mode === 'replace' ? t('extract.use') : t('extract.add')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!file || working}>
              {t('extract.extract')}
            </Button>
          )}
        </>
      }
    >
      <TextField
        label={t('extract.image')}
        type="file"
        accept="image/*"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setStatus('idle');
          setColors([]);
          setMessage('');
        }}
      />
      <Slider
        label={t('extract.colors')}
        value={count}
        min={4}
        max={64}
        onChange={(value) => {
          setCount(value);
          if (status === 'done') setStatus('idle');
        }}
      />
      {working ? (
        <>
          <progress
            className={styles.progress}
            value={progress}
            max={1}
            aria-label={phase === 'decoding' ? t('extract.reading') : t('extract.choosing')}
          />
          <p className={styles.status} role="status">
            {phase === 'decoding' ? 'Reading the image…' : 'Choosing colors…'} The editor stays
            usable.
          </p>
        </>
      ) : null}
      {status === 'done' ? (
        <div
          className={styles.strip}
          role="img"
          aria-label={t('extract.found', { count: colors.length })}
        >
          {colors.map((color) => (
            <span
              key={color}
              className={styles.swatch}
              style={{ background: toCssColor(color) }}
              title={toHex(color).toUpperCase()}
            />
          ))}
        </div>
      ) : null}
      {message ? (
        <p className={status === 'error' ? hintStyles.error : hintStyles.hint} role="status">
          {message}
        </p>
      ) : (
        <p className={hintStyles.hint}>{t('extract.hint')}</p>
      )}
    </Dialog>
  );
}
