import { useEffect, useRef, useState } from 'react';
import type { ShareLink } from '../../adapters/project-service';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { TextField } from '../../design-system/Field';
import { useT } from '../../i18n/useT';
import { useEditor } from '../../state/editor-context';
import styles from './NewSpriteDialog.module.css';

export function ShareDialog() {
  const { store, services } = useEditor();
  const t = useT();
  const [link, setLink] = useState<ShareLink | null>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    services.projects
      .createShareLink()
      .then((result) => {
        if (current) setLink(result);
      })
      .catch(() => {
        if (current) setLink({ kind: 'unsupported' });
      });
    return () => {
      current = false;
    };
  }, [services]);

  const close = (): void => {
    store.getState().closeDialog();
  };

  const copy = async (): Promise<void> => {
    if (link?.kind !== 'ready') return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied('done');
    } catch {
      input.current?.select();
      setCopied('failed');
    }
  };

  return (
    <Dialog
      title={t('share.title')}
      onClose={close}
      onSubmit={() => {
        void copy();
      }}
      footer={
        <>
          <Button onClick={close}>{t('share.close')}</Button>
          {link?.kind === 'ready' ? (
            <Button type="submit" variant="primary">
              {t('share.copy')}
            </Button>
          ) : null}
        </>
      }
    >
      <p className={styles.hint}>{t('share.intro')}</p>
      {link === null ? <p className={styles.hint}>{t('share.preparing')}</p> : null}
      {link?.kind === 'ready' ? (
        <>
          <TextField
            ref={input}
            label={t('share.linkLabel')}
            mono
            readOnly
            value={link.url}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
          />
          <p className={styles.hint}>{t('share.size', { characters: link.characters })}</p>
        </>
      ) : null}
      {link?.kind === 'too-long' ? (
        <p className={styles.error} role="alert">
          {t('share.tooLong', { characters: link.characters, limit: link.limit })}
        </p>
      ) : null}
      {link?.kind === 'unsupported' ? (
        <p className={styles.error} role="alert">
          {t('share.unsupported')}
        </p>
      ) : null}
      {copied === 'done' ? (
        <p className={styles.hint} role="status">
          {t('share.copied')}
        </p>
      ) : null}
      {copied === 'failed' ? (
        <p className={styles.hint} role="status">
          {t('share.copyFailed')}
        </p>
      ) : null}
    </Dialog>
  );
}
