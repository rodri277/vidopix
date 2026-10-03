import { useT } from '../../i18n/useT';
import styles from './StatusBar.module.css';
import { useEditorState } from '../../state/editor-context';

interface Props {
  /** Installs the waiting version of the app and reloads. */
  readonly onUpdate?: () => void;
}

export function StatusBar({ onUpdate }: Props) {
  const t = useT();
  const cursor = useEditorState((state) => state.cursor);
  const keyboardCursor = useEditorState((state) => state.keyboardCursor);
  const width = useEditorState((state) => state.spriteWidth);
  const height = useEditorState((state) => state.spriteHeight);
  const zoom = useEditorState((state) => state.viewport.zoom);
  const tool = useEditorState((state) => state.tool);
  const selection = useEditorState((state) => state.selection);
  const notice = useEditorState((state) => state.notice);
  const saveStatus = useEditorState((state) => state.saveStatus);
  const saveDetail = useEditorState((state) => state.saveDetail);
  const updateReady = useEditorState((state) => state.updateReady);
  const position = keyboardCursor ?? cursor;

  const saveText =
    saveStatus === 'error' && saveDetail === 'too-large'
      ? t('save.tooLarge')
      : t(`save.${saveStatus}`);

  return (
    <>
      <span>
        {position && position.x >= 0 && position.y >= 0 && position.x < width && position.y < height
          ? `${String(position.x)}, ${String(position.y)}`
          : '—'}
      </span>
      <span>{t('status.size', { width, height })}</span>
      <span>{String(zoom * 100)}%</span>
      <span>{t(`tool.${tool}`)}</span>
      <span>
        {selection
          ? t('status.selection', { width: selection.width, height: selection.height })
          : ''}
      </span>
      <span>{notice === '' ? saveText : notice}</span>
      {updateReady && onUpdate ? (
        <button type="button" className={styles.update} onClick={onUpdate}>
          {t('status.reloadToUpdate')}
        </button>
      ) : (
        <span>{t('status.byline')}</span>
      )}
    </>
  );
}
