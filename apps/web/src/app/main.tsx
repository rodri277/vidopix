import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { EditorSession } from '@vidopix/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { localEmergencyStore } from '../adapters/emergency-store';
import { createIdbStorage } from '../adapters/idb-storage';
import { randomIdGenerator } from '../adapters/id-generator';
import { createProjectService } from '../adapters/project-service';
import { browserClipboard } from '../adapters/system-clipboard';
import { makeThumbnail } from '../adapters/thumbnail';
import '../design-system/tokens.css';
import '../design-system/global.css';
import { DEFAULT_SPRITE_SIZE } from '../features/dialogs/NewSpriteDialog';
import { detectLanguage, type Language } from '../i18n';
import { createEditorStore } from '../state/editor-store';
import { Persistence } from '../state/persistence';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';

const LANGUAGE_KEY = 'vidopix.language';

function readStoredLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function rememberLanguage(language: Language): void {
  document.documentElement.lang = language;
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Private windows and blocked storage can refuse; the choice just won't be remembered.
  }
}

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

const language = detectLanguage(navigator.languages, readStoredLanguage());
document.documentElement.lang = language;
const store = createEditorStore(session, browserClipboard, language, rememberLanguage);

const storage = createIdbStorage();
const persistence = new Persistence({
  session,
  storage,
  emergency: localEmergencyStore,
  loadFormats: () => import('@vidopix/core/project-formats'),
  makeThumbnail,
  newId: () => randomIdGenerator.next(),
  now: () => Date.now(),
  onStatus: (status, detail) => {
    store.getState().setSaveStatus(status, detail);
  },
});
const projects = createProjectService({
  session,
  store,
  persistence,
  storage,
  newId: () => randomIdGenerator.next(),
});

// The service worker makes the app work offline. A new version waits until the user agrees to it.
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    store.getState().setUpdateReady(true);
  },
});

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App
        session={session}
        store={store}
        services={{ projects }}
        onUpdate={() => {
          // Keep the drawing safe first, then let the new version take over and reload.
          persistence.snapshotNow();
          void persistence.flush().finally(() => {
            void updateServiceWorker(true);
          });
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
);

// Load what saving needs ahead of time. If the first save only started when the page was being
// closed, the browser could cancel the download of that code and the last changes would be lost.
const warmUp = (): void => {
  void persistence.warmUp();
  void storage.getLastId();
};
if ('requestIdleCallback' in window) window.requestIdleCallback(warmUp);
else setTimeout(warmUp, 200);

// Save when the page is about to go away, so a closed tab or a reload loses nothing.
const flush = (): void => {
  // The synchronous copy first: it is the one that is certain to finish before the page goes.
  persistence.snapshotNow();
  void persistence.flush();
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
window.addEventListener('pagehide', flush);

// A shared link wins over the last project; otherwise pick up where the user left off.
void (async () => {
  const fromLink = await projects.openFromLocation(window.location.hash);
  if (fromLink !== 'none') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return;
  }
  await persistence.restoreLast();
})();
