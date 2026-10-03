import {
  HARMONY_KINDS,
  contrastRatio,
  harmony,
  shadeRamp,
  toHex,
  wcagLevels,
  type Color,
  type HarmonyKind,
} from '@vidopix/core';
import { useMemo, useState } from 'react';
import { Slider } from '../../design-system/Field';
import { Swatch } from '../../design-system/Swatch';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './GeneratePanel.module.css';

const HARMONY_LABELS: Readonly<Record<HarmonyKind, string>> = {
  analogous: 'Analogous',
  complementary: 'Complementary',
  triadic: 'Triadic',
  tetradic: 'Tetradic',
  monochromatic: 'Monochromatic',
};

interface StripProps {
  readonly label: string;
  readonly colors: readonly Color[];
}

/** A row of generated colors. Clicking one makes it the primary color. */
function Strip({ label, colors }: StripProps) {
  const { store } = useEditor();
  return (
    <div className={styles.strip} role="group" aria-label={label}>
      {colors.map((color, index) => (
        <Swatch
          key={`${String(index)}-${String(color)}`}
          background={toCssColor(color)}
          aria-label={`${toHex(color).toUpperCase()}, ${String(index + 1)} of ${String(colors.length)}`}
          title={toHex(color).toUpperCase()}
          onClick={() => {
            store.getState().setColor('primary', color);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            store.getState().setColor('secondary', color);
          }}
        />
      ))}
    </div>
  );
}

const LEVEL_LABELS = [
  ['aaNormal', 'AA, normal text (4.5:1)'],
  ['aaLarge', 'AA, large text (3:1)'],
  ['aaaNormal', 'AAA, normal text (7:1)'],
  ['aaaLarge', 'AAA, large text (4.5:1)'],
] as const;

export function GeneratePanel() {
  const { store } = useEditor();
  const primary = useEditorState((state) => state.primary);
  const secondary = useEditorState((state) => state.secondary);
  const [kind, setKind] = useState<HarmonyKind>('complementary');
  const [steps, setSteps] = useState(7);
  const [hueShift, setHueShift] = useState(25);

  const harmonyColors = useMemo(() => harmony(primary, kind), [primary, kind]);
  const ramp = useMemo(() => shadeRamp(primary, steps, { hueShift }), [primary, steps, hueShift]);
  const ratio = contrastRatio(primary, secondary);
  const levels = wcagLevels(ratio);
  const add = (colors: readonly Color[]): void => {
    store.getState().addColorsToPalette(colors);
  };

  return (
    <div className={styles.panel}>
      <section className={styles.section} aria-labelledby="harmony-heading">
        <h2 id="harmony-heading" className={styles.heading}>
          Harmonies of the primary color
        </h2>
        <div className={styles.row}>
          <select
            className={styles.select}
            aria-label="Harmony"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as HarmonyKind);
            }}
          >
            {HARMONY_KINDS.map((value) => (
              <option key={value} value={value}>
                {HARMONY_LABELS[value]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              add(harmonyColors);
            }}
          >
            Add to palette
          </button>
        </div>
        <Strip label="Harmony colors" colors={harmonyColors} />
      </section>

      <section className={styles.section} aria-labelledby="ramp-heading">
        <h2 id="ramp-heading" className={styles.heading}>
          Shade ramp with hue shifting
        </h2>
        <Slider label="Steps" value={steps} min={3} max={15} onChange={setSteps} />
        <Slider
          label="Hue shift"
          value={hueShift}
          min={0}
          max={60}
          display={`${String(hueShift)}°`}
          onChange={setHueShift}
        />
        <Strip label="Shade ramp" colors={ramp} />
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              add(ramp);
            }}
          >
            Add ramp to palette
          </button>
        </div>
        <p className={styles.hint}>
          Shadows drift toward blue-purple and highlights toward yellow. Click a color to use it.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="contrast-heading">
        <h2 id="contrast-heading" className={styles.heading}>
          Contrast: primary on secondary
        </h2>
        <div
          className={styles.sample}
          style={{ background: toCssColor(secondary), color: toCssColor(primary) }}
          aria-hidden="true"
        >
          Aa 123
        </div>
        <p className={styles.ratio} aria-label={`Contrast ratio ${ratio.toFixed(2)} to 1`}>
          {ratio.toFixed(2)}:1
        </p>
        <dl className={styles.levels}>
          {LEVEL_LABELS.map(([key, label]) => (
            <div key={key} style={{ display: 'contents' }}>
              <dt>{label}</dt>
              <dd className={levels[key] ? styles.pass : styles.fail}>
                {levels[key] ? 'Pass' : 'Fail'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
