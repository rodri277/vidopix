import { useEditorState } from '../../state/editor-context';
import { ExportDialog } from './ExportDialog';
import { ExtractPaletteDialog } from './ExtractPaletteDialog';
import { NewSpriteDialog } from './NewSpriteDialog';
import { ReplaceColorDialog } from './ReplaceColorDialog';

/** Renders whichever dialog is open. Mounting fresh each time resets the form state. */
export function Dialogs() {
  const dialog = useEditorState((state) => state.dialog);
  if (dialog === 'new-sprite') return <NewSpriteDialog />;
  if (dialog === 'export') return <ExportDialog />;
  if (dialog === 'extract-palette') return <ExtractPaletteDialog />;
  if (dialog === 'replace-color') return <ReplaceColorDialog />;
  return null;
}
