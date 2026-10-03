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
import { useEditor, useEditorState } from '../../state/editor-context';
import hintStyles from './NewSpriteDialog.module.css';
import styles from './ExtractPaletteDialog.module.css';

type Status = 'idle' | 'working' | 'done' | 'canceled' | 'error';

export function ExtractPaletteDialog() {
  const { store } = useEditor();
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
        setMessage(
          found.length === 0 ? 'That image has no opaque pixels to take colors from.' : '',
        );
      })
      .catch((error: unknown) => {
        if (error instanceof ExtractionCanceled) {
          setStatus('canceled');
          setMessage('Extraction canceled.');
        } else {
          setStatus('error');
          setMessage(error instanceof Error ? error.message : 'The image could not be read.');
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
      title="Extract palette from an image"
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
              Cancel extraction
            </Button>
          ) : (
            <Button onClick={close}>Close</Button>
          )}
          {status === 'done' ? (
            <Button type="submit" variant="primary">
              {mode === 'replace' ? 'Use as palette' : 'Add to palette'}
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!file || working}>
              Extract
            </Button>
          )}
        </>
      }
    >
      <TextField
        label="Image"
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
        label="Colors"
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
            aria-label={phase === 'decoding' ? 'Reading the image' : 'Choosing colors'}
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
          aria-label={`${String(colors.length)} extracted colors`}
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
        <p className={hintStyles.hint}>
          The image is reduced to at most 256×256 first, so even a large photo is quick.
        </p>
      )}
    </Dialog>
  );
}
