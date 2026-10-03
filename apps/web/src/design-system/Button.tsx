import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
import { cx } from './cx';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'default' | 'primary' | 'ghost';
}

export function Button({ variant = 'default', className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cx(styles.button, variant !== 'default' && styles[variant], className)}
      {...rest}
    />
  );
}
