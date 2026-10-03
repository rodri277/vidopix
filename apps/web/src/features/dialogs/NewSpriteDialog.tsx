import { MAX_CANVAS_SIZE } from '@vidopix/core';
import { useState } from 'react';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import { useEditor } from '../../state/editor-context';
import styles from './NewSpriteDialog.module.css';

const PRESETS = [16, 32, 64, 128, 256] as const;

export const DEFAULT_SPRITE_SIZE = 32;

export function NewSpriteDialog() {
  const { session, store } = useEditor();
  const [width, setWidth] = useState(String(DEFAULT_SPRITE_SIZE));
  const [height, setHeight] = useState(String(DEFAULT_SPRITE_SIZE));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    store.getState().closeDialog();
  };

  const create = (): void => {
    const result = session.newSprite({
      width: Number(width),
      height: Number(height),
      ...(name.trim() === '' ? {} : { name: name.trim() }),
    });
    if (result.ok) {
      close();
    } else {
      setError(`Width and height must be whole numbers from 1 to ${String(MAX_CANVAS_SIZE)}.`);
    }
  };

  return (
    <Dialog
      title="New sprite"
      onClose={close}
      onSubmit={create}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create
          </Button>
        </>
      }
    >
      <div className={styles.presets} role="group" aria-label="Size presets">
        {PRESETS.map((size) => (
          <Button
            key={size}
            aria-pressed={width === String(size) && height === String(size)}
            onClick={() => {
              setWidth(String(size));
              setHeight(String(size));
              setError(null);
            }}
          >
            {size}×{size}
          </Button>
        ))}
      </div>
      <div className={styles.row}>
        <TextField
          label="Width (px)"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_CANVAS_SIZE}
          value={width}
          onChange={(event) => {
            setWidth(event.target.value);
            setError(null);
          }}
        />
        <TextField
          label="Height (px)"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_CANVAS_SIZE}
          value={height}
          onChange={(event) => {
            setHeight(event.target.value);
            setError(null);
          }}
        />
      </div>
      <TextField
        label="Name (optional)"
        value={name}
        maxLength={60}
        placeholder="Untitled"
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.hint}>
          Creating a sprite replaces the current one. Unsaved work is lost.
        </p>
      )}
    </Dialog>
  );
}
