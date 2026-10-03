import { useEffect, useId, useRef, type SyntheticEvent, type ReactNode } from 'react';
import styles from './Dialog.module.css';

interface Props {
  readonly title: string;
  readonly onClose: () => void;
  /** Called when the form is submitted (Enter or the primary button). */
  readonly onSubmit: () => void;
  readonly footer: ReactNode;
  readonly children: ReactNode;
}

/** Modal dialog built on the native `<dialog>`: focus trapping and Escape come from the browser. */
export function Dialog({ title, onClose, onSubmit, footer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>{footer}</div>
      </form>
    </dialog>
  );
}
