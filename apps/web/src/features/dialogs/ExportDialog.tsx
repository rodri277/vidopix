import { MAX_EXPORT_SCALE, MIN_EXPORT_SCALE, packRgba } from '@vidopix/core';
import { useState } from 'react';
import { downloadBlob, encodePng, safeFileName } from '../../adapters/png-export';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { Checkbox, Slider } from '../../design-system/Field';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './NewSpriteDialog.module.css';

const OPAQUE_WHITE = packRgba(255, 255, 255, 255);

export function ExportDialog() {
  const { session, store } = useEditor();
  const width = useEditorState((state) => state.spriteWidth);
  const height = useEditorState((state) => state.spriteHeight);
  const name = useEditorState((state) => state.spriteName);
  const [scale, setScale] = useState(1);
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (): void => {
    store.getState().closeDialog();
  };

  const exportPng = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const image = session.exportImage({
        scale,
        ...(transparent ? {} : { background: OPAQUE_WHITE }),
      });
      if (!image.ok) {
        setError(
          image.error.kind === 'too-large'
            ? `That would be ${String(image.error.width)}×${String(image.error.height)} px. Browsers cannot go above ${String(image.error.max)} px per side. Choose a smaller scale.`
            : 'Choose a whole-number scale.',
        );
        return;
      }
      const blob = await encodePng(image.value);
      downloadBlob(blob, safeFileName(name, 'png'));
      close();
    } catch {
      setError('The browser could not create the PNG. Try a smaller scale.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Export PNG"
      onClose={close}
      onSubmit={() => {
        void exportPng();
      }}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Export
          </Button>
        </>
      }
    >
      <Slider
        label="Scale"
        value={scale}
        min={MIN_EXPORT_SCALE}
        max={MAX_EXPORT_SCALE}
        display={`×${String(scale)}`}
        onChange={setScale}
      />
      <Checkbox label="Transparent background" checked={transparent} onChange={setTransparent} />
      <p className={styles.hint}>
        Output size: {String(width * scale)}×{String(height * scale)} px
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
