import {
  colorToOklch,
  oklchToColor,
  parseHex,
  toHex,
  unpackRgba,
  packRgba,
  type Color,
  type Oklch,
} from '@vidopix/core';
import { useState } from 'react';
import { Slider, TextField } from '../../design-system/Field';
import { toCssColor } from '../../state/css-color';
import type { ColorSlot } from '@vidopix/core';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './ColorPanel.module.css';

/** The hex field shows the color without alpha when opaque, matching what most tools expect. */
const toDisplayHex = (color: Color): string => toHex(color).toUpperCase();

export function ColorPanel() {
  const slot = useEditorState((state) => state.editingSlot);
  // Keyed by slot so switching between primary and secondary reloads every control.
  return <ColorEditor key={slot} slot={slot} />;
}

function ColorEditor({ slot }: { readonly slot: ColorSlot }) {
  const { store } = useEditor();
  const color = useEditorState((state) => (slot === 'primary' ? state.primary : state.secondary));

  // The sliders keep their own OKLCH values: converting back from the packed color would lose the
  // hue whenever chroma reaches zero, making the hue slider jump while dragging lightness.
  const [lch, setLch] = useState<Oklch>(() => colorToOklch(color));
  const [fromSliders, setFromSliders] = useState<Color>(color);
  const [hexText, setHexText] = useState(() => toDisplayHex(color));
  const [hexError, setHexError] = useState(false);
  const [seenColor, setSeenColor] = useState<Color>(color);

  // The color changed from somewhere else (eyedropper, swap, hex field): resync what is shown.
  if (color !== seenColor) {
    setSeenColor(color);
    setHexText(toDisplayHex(color));
    setHexError(false);
    if (color !== fromSliders) {
      setLch(colorToOklch(color));
      setFromSliders(color);
    }
  }

  const applyColor = (packed: Color): void => {
    setFromSliders(packed);
    store.getState().setColor(slot, packed);
  };

  const applyLch = (next: Oklch): void => {
    setLch(next);
    applyColor(oklchToColor(next));
  };

  const commitHex = (): void => {
    const parsed = parseHex(hexText.trim());
    if (!parsed.ok) {
      setHexError(true);
      return;
    }
    setHexError(false);
    store.getState().setColor(slot, parsed.value);
  };

  const { a } = unpackRgba(color);
  const slotLabel = slot === 'primary' ? 'Primary' : 'Secondary';

  return (
    <section className={styles.panel} aria-labelledby="color-heading">
      <h2 id="color-heading" className={styles.heading}>
        {slotLabel} color
      </h2>
      <div className={styles.preview}>
        <div className={styles.previewFill} style={{ background: toCssColor(color) }} />
      </div>
      <TextField
        label="Hex"
        mono
        value={hexText}
        spellCheck={false}
        maxLength={9}
        aria-invalid={hexError}
        aria-describedby={hexError ? 'hex-error' : undefined}
        onChange={(event) => {
          setHexText(event.target.value);
          setHexError(false);
        }}
        onBlur={commitHex}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitHex();
          }
        }}
      />
      {hexError ? (
        <p id="hex-error" className={styles.error} role="alert">
          Use 3, 6 or 8 hex digits, for example #7C5CFF.
        </p>
      ) : null}
      <Slider
        label="L"
        value={lch.l}
        min={0}
        max={1}
        step={0.005}
        display={lch.l.toFixed(2)}
        onChange={(l) => {
          applyLch({ ...lch, l });
        }}
      />
      <Slider
        label="C"
        value={lch.c}
        min={0}
        max={0.4}
        step={0.002}
        display={lch.c.toFixed(2)}
        onChange={(c) => {
          applyLch({ ...lch, c });
        }}
      />
      <Slider
        label="H"
        value={lch.h}
        min={0}
        max={360}
        step={1}
        display={`${String(Math.round(lch.h))}°`}
        onChange={(h) => {
          applyLch({ ...lch, h });
        }}
      />
      <Slider
        label="A"
        value={a}
        min={0}
        max={255}
        display={`${String(Math.round((a / 255) * 100))}%`}
        onChange={(alpha) => {
          const { r, g, b } = unpackRgba(color);
          applyColor(packRgba(r, g, b, alpha));
        }}
      />
    </section>
  );
}
