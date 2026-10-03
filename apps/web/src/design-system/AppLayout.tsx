import type { ReactNode } from 'react';
import { useT } from '../i18n/useT';
import styles from './AppLayout.module.css';

interface Props {
  readonly menu: ReactNode;
  readonly options: ReactNode;
  readonly tools: ReactNode;
  readonly canvas: ReactNode;
  readonly side: ReactNode;
  readonly timeline: ReactNode;
  readonly status: ReactNode;
  readonly panelsHidden: boolean;
}

/** Page skeleton: fixed-size bars around the canvas. It only arranges what it is given. */
export function AppLayout({
  menu,
  options,
  tools,
  canvas,
  side,
  timeline,
  status,
  panelsHidden,
}: Props) {
  const t = useT();
  return (
    <div className={styles.layout} data-panels-hidden={panelsHidden}>
      <header className={styles.top}>{menu}</header>
      <section className={styles.options} aria-label={t('layout.options')}>
        {options}
      </section>
      <nav className={styles.tools} aria-label={t('toolbar.toolbox')}>
        {tools}
      </nav>
      <main className={styles.canvas}>{canvas}</main>
      <aside className={styles.side} aria-label={t('layout.side')}>
        {side}
      </aside>
      <section className={styles.timeline} aria-label={t('timeline.title')}>
        {timeline}
      </section>
      <footer className={styles.status}>{status}</footer>
    </div>
  );
}
