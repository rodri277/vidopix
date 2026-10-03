import type { EditorSession, Sprite } from '@vidopix/core';
import type * as ProjectFormats from '@vidopix/core/project-formats';

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly layers: number;
  /** Milliseconds since the epoch. */
  readonly updatedAt: number;
  /** A small PNG as a data URL. */
  readonly thumbnail: string;
}

/** Where projects are kept. The browser implementation uses IndexedDB. */
export interface ProjectStorage {
  save(summary: ProjectSummary, data: string): Promise<void>;
  load(id: string): Promise<string | null>;
  /** Newest first. */
  list(): Promise<ProjectSummary[]>;
  remove(id: string): Promise<void>;
  getLastId(): Promise<string | null>;
  setLastId(id: string | null): Promise<void>;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Formats = typeof ProjectFormats;

export interface PersistenceDeps {
  readonly session: EditorSession;
  readonly storage: ProjectStorage;
  readonly loadFormats: () => Promise<Formats>;
  readonly makeThumbnail: (sprite: Sprite) => string;
  readonly newId: () => string;
  readonly now: () => number;
  readonly onStatus: (status: SaveStatus, detail?: string) => void;
  /** How long to wait after the last change before saving. */
  readonly debounceMs?: number;
}

export type OpenResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

const DEFAULT_DEBOUNCE_MS = 1200;

/**
 * Keeps the current sprite in the browser's storage. It saves a moment after every change and
 * whenever the page is hidden, remembers which project was last open, and opens projects from
 * storage, files and links. Each document replaced by the user becomes a project of its own.
 */
export class Persistence {
  private projectId: string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private dirty = false;
  private nextProjectId: string | null = null;
  private readonly unsubscribe: (() => void)[] = [];

  constructor(private readonly deps: PersistenceDeps) {
    this.projectId = deps.newId();
    this.unsubscribe.push(
      deps.session.on('historyChanged', ({ cause }) => {
        if (cause !== 'clear') this.markDirty();
      }),
      deps.session.on('nameChanged', () => {
        this.markDirty();
      }),
      deps.session.on('spriteReplaced', () => {
        this.projectId = this.nextProjectId ?? this.deps.newId();
        this.nextProjectId = null;
        clearTimeout(this.timer);
        this.dirty = false;
        this.deps.onStatus('saved');
      }),
    );
  }

  get currentProjectId(): string {
    return this.projectId;
  }

  dispose(): void {
    clearTimeout(this.timer);
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }

  /** Reopens the project that was open last. Skips if the user already started drawing. */
  async restoreLast(): Promise<'restored' | 'none' | 'skipped' | 'failed'> {
    try {
      const id = await this.deps.storage.getLastId();
      if (id === null) return 'none';
      if (this.deps.session.canUndo) return 'skipped';
      return (await this.openStored(id)) ? 'restored' : 'none';
    } catch {
      return 'failed';
    }
  }

  async openStored(id: string): Promise<boolean> {
    const data = await this.deps.storage.load(id);
    if (data === null) return false;
    const formats = await this.deps.loadFormats();
    const parsed = formats.parseProject(data);
    if (!parsed.ok) return false;
    await this.flush();
    this.nextProjectId = id;
    this.deps.session.openSprite(parsed.value);
    await this.deps.storage.setLastId(id);
    return true;
  }

  /** Opens a sprite from a file or a link as a project of its own. */
  async openSprite(sprite: Sprite): Promise<void> {
    await this.flush();
    this.deps.session.openSprite(sprite);
    this.markDirty();
  }

  async openFileText(text: string): Promise<OpenResult> {
    const formats = await this.deps.loadFormats();
    const parsed = formats.parseProject(text);
    if (!parsed.ok) return { ok: false, message: parsed.error.message };
    await this.openSprite(parsed.value);
    return { ok: true };
  }

  /** Writes any pending change now, for example when the page is about to be hidden. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    while (this.running) await this.running;
    if (!this.dirty) return;
    this.running = this.write();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  private hasPendingChanges(): boolean {
    return this.dirty;
  }

  private markDirty(): void {
    this.dirty = true;
    this.deps.onStatus('unsaved');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.deps.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private async write(): Promise<void> {
    this.dirty = false;
    this.deps.onStatus('saving');
    try {
      const formats = await this.deps.loadFormats();
      const { session } = this.deps;
      const sprite = session.sprite;
      const data = formats.serializeProject(sprite);
      if (data.length > formats.MAX_PROJECT_BYTES) {
        this.deps.onStatus('error', 'too-large');
        return;
      }
      await this.deps.storage.save(
        {
          id: this.projectId,
          name: sprite.name,
          width: sprite.width,
          height: sprite.height,
          layers: sprite.layers.length,
          updatedAt: this.deps.now(),
          thumbnail: this.deps.makeThumbnail(sprite),
        },
        data,
      );
      await this.deps.storage.setLastId(this.projectId);
      // A change made while this write was running has set the flag again.
      this.deps.onStatus(this.hasPendingChanges() ? 'unsaved' : 'saved');
    } catch {
      this.dirty = true;
      this.deps.onStatus('error', 'storage');
    }
  }
}
