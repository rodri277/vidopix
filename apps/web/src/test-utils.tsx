import { EditorSession } from '@vidopix/core';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { randomIdGenerator } from './adapters/id-generator';
import { EditorProvider } from './state/editor-context';
import { createEditorStore, type SystemClipboard } from './state/editor-store';

export const noClipboard: SystemClipboard = {
  writeImage: () => Promise.resolve(),
  readImage: () => Promise.resolve(null),
};

export function renderWithEditor(
  ui: ReactElement,
  size = 32,
  clipboard: SystemClipboard = noClipboard,
) {
  const created = EditorSession.create({ width: size, height: size }, { ids: randomIdGenerator });
  if (!created.ok) throw new Error('could not create session');
  const session = created.value;
  const store = createEditorStore(session, clipboard);
  const result = render(
    <EditorProvider session={session} store={store}>
      {ui}
    </EditorProvider>,
  );
  return { ...result, session, store };
}
