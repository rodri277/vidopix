import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './Field.module.css';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  readonly label: string;
  readonly mono?: boolean;
}

export function TextField({ label, mono = false, className, ...rest }: FieldProps) {
  const id = useId();
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <input id={id} className={cx(styles.input, mono && styles.mono, className)} {...rest} />
    </label>
  );
}

interface SliderProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  /** Text shown next to the slider, for example "45 deg". */
  readonly display?: string;
  readonly onChange: (value: number) => void;
}

export function Slider({ label, value, min, max, step = 1, display, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className={cx(styles.field, styles.inline)}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
      <output htmlFor={id} className={styles.value}>
        {display ?? String(value)}
      </output>
    </div>
  );
}

interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cx(styles.field, styles.inline)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
