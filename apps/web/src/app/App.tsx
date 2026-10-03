import type { EditorSession } from '@vidopix/core';
import { AppLayout } from '../design-system/AppLayout';
import { Tabs } from '../design-system/Tabs';
import { Announcer } from '../features/a11y/Announcer';
import { CanvasView } from '../features/canvas/CanvasView';
import { ColorPanel } from '../features/color/ColorPanel';
import { LayersPanel } from '../features/layers/LayersPanel';
import { GeneratePanel } from '../features/palette/GeneratePanel';
import { PalettePanel } from '../features/palette/PalettePanel';
import { Dialogs } from '../features/dialogs/Dialogs';
import { AppMenu } from '../features/menu/AppMenu';
import { StatusBar } from '../features/statusbar/StatusBar';
import { ToolOptionsBar } from '../features/tool-options/ToolOptionsBar';
import { Toolbar } from '../features/toolbar/Toolbar';
import { EditorProvider, useEditorState } from '../state/editor-context';
import type { EditorStore } from '../state/editor-store';
import { useGlobalShortcuts } from './useGlobalShortcuts';

interface Props {
  readonly session: EditorSession;
  readonly store: EditorStore;
}

function Editor({ session, store }: Props) {
  const panelsHidden = useEditorState((state) => state.panelsHidden);
  useGlobalShortcuts(session, store);
  return (
    <>
      <AppLayout
        panelsHidden={panelsHidden}
        menu={<AppMenu />}
        options={<ToolOptionsBar />}
        tools={<Toolbar />}
        canvas={<CanvasView />}
        side={
          <>
            <LayersPanel />
            <Tabs
              label="Color tools"
              tabs={[
                { id: 'color', label: 'Color', content: <ColorPanel /> },
                { id: 'palette', label: 'Palette', content: <PalettePanel /> },
                { id: 'generate', label: 'Generate', content: <GeneratePanel /> },
              ]}
            />
          </>
        }
        status={<StatusBar />}
      />
      <Dialogs />
      <Announcer />
    </>
  );
}

/** Wires the editing session to the interface. The only place features are put together. */
export function App({ session, store }: Props) {
  return (
    <EditorProvider session={session} store={store}>
      <Editor session={session} store={store} />
    </EditorProvider>
  );
}
