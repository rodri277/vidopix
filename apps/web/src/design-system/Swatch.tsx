import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import styles from './Swatch.module.css';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  /** Any CSS color. */
  readonly background: string;
  /** Which drawing color this swatch currently is, if any. */
  readonly slot?: 'primary' | 'secondary' | undefined;
  readonly dropTarget?: boolean;
}

export function Swatch({ background, slot, dropTarget = false, className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cx(styles.swatch, className)}
      style={{ background }}
      data-slot={slot}
      data-drop={dropTarget}
      {...rest}
    />
  );
}
