import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, type ToolOptions } from '@vidopix/core';
import { Slider } from '../../design-system/Field';
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

/** Settings of the active tool. */
export function ToolOptionsBar() {
  const { store } = useEditor();
  const tool = useEditorState((state) => state.tool);
  const options = useEditorState((state) => state.options);
  const set = (changes: Partial<ToolOptions>): void => {
    store.getState().setToolOptions(changes);
  };

  const brush = (
    <div className={styles.slider}>
      <Slider
        label="Size"
        value={options.brushSize}
        min={MIN_BRUSH_SIZE}
        max={MAX_BRUSH_SIZE}
        display={`${String(options.brushSize)} px`}
        onChange={(brushSize) => {
          set({ brushSize });
        }}
      />
    </div>
  );

  if (tool === 'pencil' || tool === 'eraser' || tool === 'line') {
    return <div className={styles.group}>{brush}</div>;
  }

  if (tool === 'fill') {
    return (
      <div className={styles.group}>
        <Segmented
          label="Fill mode"
          value={options.fillMode}
          options={[
            { value: 'contiguous', label: 'Contiguous' },
            { value: 'global', label: 'Global' },
          ]}
          onChange={(value) => {
            set({ fillMode: value === 'global' ? 'global' : 'contiguous' });
          }}
        />
        <div className={styles.slider}>
          <Slider
            label="Tolerance"
            value={options.tolerance}
            min={0}
            max={255}
            onChange={(tolerance) => {
              set({ tolerance });
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
          label="Shape style"
          value={options.shapeFilled ? 'filled' : 'outline'}
          options={[
            { value: 'outline', label: 'Outline' },
            { value: 'filled', label: 'Filled' },
          ]}
          onChange={(value) => {
            set({ shapeFilled: value === 'filled' });
          }}
        />
        <p className={styles.hint}>
          Hold Shift for a perfect {tool === 'ellipse' ? 'circle' : 'square'}
        </p>
      </div>
    );
  }

  return (
    <p className={styles.hint}>
      Click a pixel to pick its color. Right click picks the secondary color.
    </p>
  );
}
