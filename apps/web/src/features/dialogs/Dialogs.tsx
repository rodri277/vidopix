import { useEditorState } from '../../state/editor-context';
import { ExportDialog } from './ExportDialog';
import { NewSpriteDialog } from './NewSpriteDialog';

/** Renders whichever dialog is open. Mounting fresh each time resets the form state. */
export function Dialogs() {
  const dialog = useEditorState((state) => state.dialog);
  if (dialog === 'new-sprite') return <NewSpriteDialog />;
  if (dialog === 'export') return <ExportDialog />;
  return null;
}
