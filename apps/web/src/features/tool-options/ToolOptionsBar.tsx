import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, type ToolOptions } from '@vidopix/core';
import { Slider } from '../../design-system/Field';
import { useT, type TFunction } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './ToolOptionsBar.module.css';

interface SegmentedProps {
  readonly label: string;
  readonly options: readonly { value: string; label: string }[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function Segmented({ label, options, value, onChange }: SegmentedProps) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  readonly label: string;
  readonly pressed: boolean;
  readonly onChange: (pressed: boolean) => void;
}

function Toggle({ label, pressed, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={pressed}
      onClick={() => {
        onChange(!pressed);
      }}
    >
      {label}
    </button>
  );
}

/** Settings of the active tool. */
export function ToolOptionsBar() {
  const { store } = useEditor();
  const t: TFunction = useT();
  const tool = useEditorState((state) => state.tool);
  const options = useEditorState((state) => state.options);
  const set = (changes: Partial<ToolOptions>): void => {
    store.getState().setToolOptions(changes);
  };

  const brush = (
    <div className={styles.slider}>
      <Slider
        label={t('options.size')}
        value={options.brushSize}
        min={MIN_BRUSH_SIZE}
        max={MAX_BRUSH_SIZE}
        display={t('options.sizeValue', { size: options.brushSize })}
        onChange={(brushSize) => {
          set({ brushSize });
        }}
      />
    </div>
  );

  const aids = (
    <div className={styles.group} role="group" aria-label={t('options.aids')}>
      <Toggle
        label={t('options.mirrorX')}
        pressed={options.mirrorX}
        onChange={(mirrorX) => {
          set({ mirrorX });
        }}
      />
      <Toggle
        label={t('options.mirrorY')}
        pressed={options.mirrorY}
        onChange={(mirrorY) => {
          set({ mirrorY });
        }}
      />
      <div className={styles.smallSlider}>
        <Slider
          label={t('options.dither')}
          value={options.dither}
          min={1}
          max={16}
          display={t('options.ditherValue', { percent: Math.round((options.dither / 16) * 100) })}
          onChange={(dither) => {
            set({ dither });
          }}
        />
      </div>
    </div>
  );

  if (tool === 'pencil' || tool === 'eraser' || tool === 'line') {
    return (
      <div className={styles.group}>
        {brush}
        {aids}
        {tool === 'pencil' ? (
          <>
            <Toggle
              label={t('options.pixelPerfect')}
              pressed={options.pixelPerfect}
              onChange={(pixelPerfect) => {
                set({ pixelPerfect });
              }}
            />
            <Toggle
              label={t('options.pressure')}
              pressed={options.pressure}
              onChange={(pressure) => {
                set({ pressure });
              }}
            />
          </>
        ) : null}
        {tool === 'line' ? <p className={styles.hint}>{t('options.shiftLine')}</p> : null}
      </div>
    );
  }

  if (tool === 'select') return <p className={styles.hint}>{t('options.hintSelect')}</p>;
  if (tool === 'move') return <p className={styles.hint}>{t('options.hintMove')}</p>;

  if (tool === 'fill') {
    return (
      <div className={styles.group}>
        <Segmented
          label={t('options.fillMode')}
          value={options.fillMode}
          options={[
            { value: 'contiguous', label: t('options.contiguous') },
            { value: 'global', label: t('options.global') },
          ]}
          onChange={(value) => {
            set({ fillMode: value === 'global' ? 'global' : 'contiguous' });
          }}
        />
        <div className={styles.slider}>
          <Slider
            label={t('options.tolerance')}
            value={options.tolerance}
            min={0}
            max={255}
            onChange={(tolerance) => {
              set({ tolerance });
            }}
          />
        </div>
        <div className={styles.smallSlider}>
          <Slider
            label={t('options.dither')}
            value={options.dither}
            min={1}
            max={16}
            display={t('options.ditherValue', { percent: Math.round((options.dither / 16) * 100) })}
            onChange={(dither) => {
              set({ dither });
            }}
          />
        </div>
      </div>
    );
  }

  if (tool === 'rectangle' || tool === 'ellipse') {
    return (
      <div className={styles.group}>
        <Segmented
          label={t('options.shapeStyle')}
          value={options.shapeFilled ? 'filled' : 'outline'}
          options={[
            { value: 'outline', label: t('options.outline') },
            { value: 'filled', label: t('options.filled') },
          ]}
          onChange={(value) => {
            set({ shapeFilled: value === 'filled' });
          }}
        />
        {aids}
        <p className={styles.hint}>
          {tool === 'ellipse' ? t('options.shiftCircle') : t('options.shiftSquare')}
        </p>
      </div>
    );
  }

  return <p className={styles.hint}>{t('options.hintEyedropper')}</p>;
}
