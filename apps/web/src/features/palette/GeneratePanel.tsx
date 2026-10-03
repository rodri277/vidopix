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
import type { MessageKey } from '../../i18n';
import { useT, type TFunction } from '../../i18n/useT';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './GeneratePanel.module.css';

const HARMONY_KEYS: Readonly<Record<HarmonyKind, MessageKey>> = {
  analogous: 'generate.analogous',
  complementary: 'generate.complementary',
  triadic: 'generate.triadic',
  tetradic: 'generate.tetradic',
  monochromatic: 'generate.monochromatic',
};

interface StripProps {
  readonly label: string;
  readonly colors: readonly Color[];
}

/** A row of generated colors. Clicking one makes it the primary color. */
function Strip({ label, colors }: StripProps) {
  const { store } = useEditor();
  const t: TFunction = useT();
  return (
    <div className={styles.strip} role="group" aria-label={label}>
      {colors.map((color, index) => (
        <Swatch
          key={`${String(index)}-${String(color)}`}
          background={toCssColor(color)}
          aria-label={t('generate.swatchLabel', {
            hex: toHex(color).toUpperCase(),
            index: index + 1,
            total: colors.length,
          })}
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
  ['aaNormal', 'generate.levelAaNormal'],
  ['aaLarge', 'generate.levelAaLarge'],
  ['aaaNormal', 'generate.levelAaaNormal'],
  ['aaaLarge', 'generate.levelAaaLarge'],
] as const;

export function GeneratePanel() {
  const { store } = useEditor();
  const t = useT();
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
          {t('generate.harmonyTitle')}
        </h2>
        <div className={styles.row}>
          <select
            className={styles.select}
            aria-label={t('generate.harmony')}
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as HarmonyKind);
            }}
          >
            {HARMONY_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(HARMONY_KEYS[value])}
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
            {t('generate.addToPalette')}
          </button>
        </div>
        <Strip label={t('generate.harmonyColors')} colors={harmonyColors} />
      </section>

      <section className={styles.section} aria-labelledby="ramp-heading">
        <h2 id="ramp-heading" className={styles.heading}>
          {t('generate.rampTitle')}
        </h2>
        <Slider label={t('generate.steps')} value={steps} min={3} max={15} onChange={setSteps} />
        <Slider
          label={t('generate.hueShift')}
          value={hueShift}
          min={0}
          max={60}
          display={`${String(hueShift)}°`}
          onChange={setHueShift}
        />
        <Strip label={t('generate.rampColors')} colors={ramp} />
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              add(ramp);
            }}
          >
            {t('generate.addRamp')}
          </button>
        </div>
        <p className={styles.hint}>{t('generate.rampHint')}</p>
      </section>

      <section className={styles.section} aria-labelledby="contrast-heading">
        <h2 id="contrast-heading" className={styles.heading}>
          {t('generate.contrastTitle')}
        </h2>
        <div
          className={styles.sample}
          style={{ background: toCssColor(secondary), color: toCssColor(primary) }}
          aria-hidden="true"
        >
          Aa 123
        </div>
        <p
          className={styles.ratio}
          aria-label={t('generate.contrastLabel', { ratio: ratio.toFixed(2) })}
        >
          {ratio.toFixed(2)}:1
        </p>
        <dl className={styles.levels}>
          {LEVEL_LABELS.map(([key, labelKey]) => (
            <div key={key} style={{ display: 'contents' }}>
              <dt>{t(labelKey)}</dt>
              <dd className={levels[key] ? styles.pass : styles.fail}>
                {levels[key] ? t('generate.pass') : t('generate.fail')}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
