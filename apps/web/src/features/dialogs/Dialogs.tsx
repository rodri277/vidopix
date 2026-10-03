import { useEditorState } from '../../state/editor-context';
import { ExportDialog } from './ExportDialog';
import { ExtractPaletteDialog } from './ExtractPaletteDialog';
import { NewSpriteDialog } from './NewSpriteDialog';
import { RecentProjectsDialog } from './RecentProjectsDialog';
import { ReplaceColorDialog } from './ReplaceColorDialog';
import { ShareDialog } from './ShareDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

/** Renders whichever dialog is open. Mounting fresh each time resets the form state. */
export function Dialogs() {
  const dialog = useEditorState((state) => state.dialog);
  if (dialog === 'new-sprite') return <NewSpriteDialog />;
  if (dialog === 'export') return <ExportDialog />;
  if (dialog === 'extract-palette') return <ExtractPaletteDialog />;
  if (dialog === 'replace-color') return <ReplaceColorDialog />;
  if (dialog === 'recent-projects') return <RecentProjectsDialog />;
  if (dialog === 'share') return <ShareDialog />;
  if (dialog === 'shortcuts') return <ShortcutsDialog />;
  return null;
}
