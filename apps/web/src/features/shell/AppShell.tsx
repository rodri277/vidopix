import styles from './AppShell.module.css';

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.logo} aria-hidden="true" />
        <h1 className={styles.title}>Vidopix</h1>
      </header>
      <section className={styles.options} aria-label="Tool options" />
      <nav className={styles.tools} aria-label="Toolbox">
        <div role="toolbar" aria-label="Tools" aria-orientation="vertical" />
      </nav>
      <main className={styles.canvas}>
        <p className={styles.placeholder}>Canvas coming in Phase 1</p>
      </main>
      <aside className={styles.side} aria-label="Color, palette and layers" />
      <footer className={styles.status}>
        <span>Ready</span>
        <span>by vidotho</span>
      </footer>
    </div>
  );
}
