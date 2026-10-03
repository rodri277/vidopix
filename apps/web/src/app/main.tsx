import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { EditorSession } from '@vidopix/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browserClipboard } from '../adapters/system-clipboard';
import { randomIdGenerator } from '../adapters/id-generator';
import '../design-system/tokens.css';
import '../design-system/global.css';
import { DEFAULT_SPRITE_SIZE } from '../features/dialogs/NewSpriteDialog';
import { createEditorStore } from '../state/editor-store';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element');
}

const created = EditorSession.create(
  { width: DEFAULT_SPRITE_SIZE, height: DEFAULT_SPRITE_SIZE },
  { ids: randomIdGenerator },
);
if (!created.ok) {
  throw new Error('Could not create the initial sprite');
}
const session = created.value;
const store = createEditorStore(session, browserClipboard);

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App session={session} store={store} />
    </ErrorBoundary>
  </StrictMode>,
);
