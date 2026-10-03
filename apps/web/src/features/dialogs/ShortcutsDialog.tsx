import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { useT } from '../../i18n/useT';
import { useEditor } from '../../state/editor-context';
import { SHORTCUT_GROUPS } from '../../state/shortcut-table';
import { shortcutKeys } from '../../state/shortcut-labels';
import styles from './ShortcutsDialog.module.css';

export function ShortcutsDialog() {
  const { store } = useEditor();
  const t = useT();
  const close = (): void => {
    store.getState().closeDialog();
  };

  return (
    <Dialog
      title={t('shortcuts.title')}
      onClose={close}
      onSubmit={close}
      footer={<Button type="submit">{t('shortcuts.close')}</Button>}
    >
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('shortcuts.intro')}</p>
      {/* A scrolling area must be reachable with the keyboard so it can be scrolled without a mouse. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className={styles.groups} role="region" aria-label={t('shortcuts.title')} tabIndex={0}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className={styles.group}>
            <h3>{t(group.title)}</h3>
            <dl className={styles.list}>
              {group.entries.map((entry) => (
                <div key={entry.label} style={{ display: 'contents' }}>
                  <dt>{t(entry.label)}</dt>
                  <dd>{shortcutKeys(entry.keys)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
