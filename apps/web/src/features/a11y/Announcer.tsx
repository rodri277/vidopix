import { useEditorState } from '../../state/editor-context';
import styles from './Announcer.module.css';

/** Screen-reader announcements, for example "Undid: Pencil". */
export function Announcer() {
  const announcement = useEditorState((state) => state.announcement);
  return (
    <div className={styles.hidden} role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
