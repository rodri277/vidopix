import { useEffect, useState } from 'react';
import type { ProjectSummary } from '../../state/persistence';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { useT } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import styles from './RecentProjectsDialog.module.css';

export function RecentProjectsDialog() {
  const { store, services } = useEditor();
  const t = useT();
  const language = useEditorState((state) => state.language);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);

  useEffect(() => {
    let current = true;
    services.projects
      .listRecent()
      .then((list) => {
        if (current) setProjects(list);
      })
      .catch(() => {
        if (current) setProjects([]);
      });
    return () => {
      current = false;
    };
  }, [services]);

  const close = (): void => {
    store.getState().closeDialog();
  };

  const when = (time: number): string =>
    new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(time);

  return (
    <Dialog
      title={t('recent.title')}
      onClose={close}
      onSubmit={close}
      footer={<Button type="submit">{t('recent.close')}</Button>}
    >
      {projects === null ? null : projects.length === 0 ? (
        <p className={styles.empty}>{t('recent.empty')}</p>
      ) : (
        // The list scrolls when there are many projects, so it must be reachable by keyboard.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <ul className={styles.list} aria-label={t('recent.title')} tabIndex={0}>
          {projects.map((project) => (
            <li key={project.id} className={styles.item}>
              <img className={styles.thumb} src={project.thumbnail} alt="" />
              <div className={styles.info}>
                <p className={styles.name}>{project.name}</p>
                <p className={styles.details}>
                  {t('recent.details', {
                    width: project.width,
                    height: project.height,
                    layers: project.layers,
                  })}{' '}
                  · {when(project.updatedAt)}
                </p>
              </div>
              <div className={styles.actions}>
                <Button
                  aria-label={`${t('recent.open')}: ${project.name}`}
                  onClick={() => {
                    void services.projects.openRecent(project.id).then((opened) => {
                      if (opened) close();
                    });
                  }}
                >
                  {t('recent.open')}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={`${t('recent.delete')}: ${project.name}`}
                  onClick={() => {
                    void services.projects.deleteRecent(project.id).then(() => {
                      setProjects((list) => list?.filter((item) => item.id !== project.id) ?? null);
                    });
                  }}
                >
                  {t('recent.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
