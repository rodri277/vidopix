import type { EditorSession } from '@vidopix/core';
import type * as ProjectFormats from '@vidopix/core/project-formats';
import type { MessageKey, MessageParams } from '../i18n';
import type { EditorStore } from '../state/editor-store';
import type { Persistence, ProjectStorage, ProjectSummary } from '../state/persistence';
import { deflate, inflate, supportsCompression } from './compression';
import { downloadBlob, safeFileName } from './png-export';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type ShareLink =
  | { readonly kind: 'ready'; readonly url: string; readonly characters: number }
  | { readonly kind: 'too-long'; readonly characters: number; readonly limit: number }
  | { readonly kind: 'unsupported' };

/** What the interface can ask of the saved projects. */
export interface ProjectService {
  openFile(file: File): Promise<void>;
  listRecent(): Promise<ProjectSummary[]>;
  openRecent(id: string): Promise<boolean>;
  deleteRecent(id: string): Promise<void>;
  saveFile(): Promise<void>;
  createShareLink(): Promise<ShareLink>;
  /** Opens a sprite from `#s=...` in the address, if there is one. */
  openFromLocation(hash: string): Promise<'opened' | 'none' | 'failed'>;
}

interface Deps {
  readonly session: EditorSession;
  readonly store: EditorStore;
  readonly persistence: Persistence;
  readonly storage: ProjectStorage;
  readonly newId: () => string;
}

// Loaded on demand: the project formats bring a validator with them.
const formats = (): Promise<typeof ProjectFormats> => import('@vidopix/core/project-formats');

export function createProjectService({
  session,
  store,
  persistence,
  storage,
  newId,
}: Deps): ProjectService {
  const say = (key: MessageKey, params?: MessageParams): void => {
    store.getState().notify(store.getState().t(key, params));
  };

  return {
    async openFile(file) {
      if (file.size > MAX_FILE_BYTES) {
        say('open.tooLarge');
        return;
      }
      const result = await persistence.openFileText(await file.text());
      if (!result.ok) say('open.failed', { reason: result.message });
    },

    listRecent: () => storage.list(),

    async openRecent(id) {
      const opened = await persistence.openStored(id);
      if (!opened) say('recent.openFailed');
      return opened;
    },

    async deleteRecent(id) {
      await storage.remove(id);
      say('recent.deleted');
    },

    async saveFile() {
      session.document.commitFloating();
      const { serializeProject } = await formats();
      const text = serializeProject(session.sprite);
      downloadBlob(
        new Blob([text], { type: 'application/json' }),
        safeFileName(session.sprite.name, 'vidopix'),
      );
    },

    async createShareLink() {
      if (!supportsCompression()) return { kind: 'unsupported' };
      session.document.commitFloating();
      const { encodeShare, shareFragment, SHARE_MAX_FRAGMENT_CHARS } = await formats();
      const fragment = shareFragment(await deflate(encodeShare(session.sprite)));
      if (fragment.length > SHARE_MAX_FRAGMENT_CHARS) {
        return { kind: 'too-long', characters: fragment.length, limit: SHARE_MAX_FRAGMENT_CHARS };
      }
      const base = `${window.location.origin}${window.location.pathname}`;
      return { kind: 'ready', url: `${base}#${fragment}`, characters: fragment.length };
    },

    async openFromLocation(hash) {
      // Most visits have no link: do not even load the file formats for them.
      if (!hash.startsWith('#s=')) return 'none';
      const { readShareFragment, decodeShare, MAX_SHARE_DECODED_BYTES } = await formats();
      const compressed = readShareFragment(hash);
      if (compressed === null) return 'none';
      const fail = (reason: string): 'failed' => {
        say('share.openFailed', { reason });
        return 'failed';
      };
      if (!supportsCompression()) return fail(store.getState().t('share.unsupported'));
      const bytes = await inflate(compressed, MAX_SHARE_DECODED_BYTES + 4096);
      if (!bytes) return fail('data');
      const decoded = decodeShare(bytes, { next: newId });
      if (!decoded.ok) return fail(decoded.error.message);
      await persistence.openSprite(decoded.value);
      return 'opened';
    },
  };
}
