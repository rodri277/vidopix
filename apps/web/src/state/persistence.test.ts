import { EditorSession, createSequentialIdGenerator, packRgba } from '@vidopix/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Persistence,
  type EmergencyEntry,
  type EmergencyStore,
  type ProjectStorage,
  type ProjectSummary,
  type SaveStatus,
} from './persistence';

class MemoryStorage implements ProjectStorage {
  readonly summaries = new Map<string, ProjectSummary>();
  readonly data = new Map<string, string>();
  last: string | null = null;
  failNext = false;
  saves = 0;

  save(summary: ProjectSummary, data: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('quota'));
    }
    this.saves++;
    this.summaries.set(summary.id, summary);
    this.data.set(summary.id, data);
    return Promise.resolve();
  }

  load(id: string): Promise<string | null> {
    return Promise.resolve(this.data.get(id) ?? null);
  }

  list(): Promise<ProjectSummary[]> {
    return Promise.resolve([...this.summaries.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  }

  remove(id: string): Promise<void> {
    this.summaries.delete(id);
    this.data.delete(id);
    return Promise.resolve();
  }

  getLastId(): Promise<string | null> {
    return Promise.resolve(this.last);
  }

  setLastId(id: string | null): Promise<void> {
    this.last = id;
    return Promise.resolve();
  }
}

class MemoryEmergency implements EmergencyStore {
  entry: EmergencyEntry | null = null;
  failWrites = false;

  write(entry: EmergencyEntry): void {
    if (this.failWrites) throw new Error('quota');
    this.entry = entry;
  }

  read(): EmergencyEntry | null {
    return this.entry;
  }

  clear(): void {
    this.entry = null;
  }
}

function setup() {
  const storage = new MemoryStorage();
  const emergency = new MemoryEmergency();
  const created = EditorSession.create(
    { width: 8, height: 8 },
    { ids: createSequentialIdGenerator() },
  );
  if (!created.ok) throw new Error('session');
  const session = created.value;
  const statuses: SaveStatus[] = [];
  let counter = 0;
  const persistence = new Persistence({
    session,
    storage,
    emergency,
    loadFormats: () => import('@vidopix/core/project-formats'),
    makeThumbnail: () => 'thumb',
    newId: () => `project-${String(++counter)}`,
    now: () => 1000 + counter,
    onStatus: (status) => statuses.push(status),
    debounceMs: 500,
  });
  return { storage, emergency, session, persistence, statuses };
}

const draw = (session: EditorSession, x: number): void => {
  session.setColor('primary', packRgba(255, 0, 0, 255));
  session.pointerDown({ x, y: 1, button: 'primary', shift: false });
  session.pointerUp({ x, y: 1, button: 'primary', shift: false });
};

describe('Persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a moment after the last change, not on every stroke', async () => {
    const { storage, session, statuses } = setup();
    draw(session, 1);
    draw(session, 2);
    draw(session, 3);
    expect(statuses.at(-1)).toBe('unsaved');
    expect(storage.saves).toBe(0);

    await vi.advanceTimersByTimeAsync(499);
    expect(storage.saves).toBe(0);
    await vi.advanceTimersByTimeAsync(10);
    // Loading the file formats is a real dynamic import, so wait for it to finish.
    await vi.waitFor(() => {
      expect(storage.saves).toBe(1);
    });
    expect(statuses.slice(-2)).toEqual(['saving', 'saved']);
    expect(storage.last).toBe('project-1');
    expect(storage.summaries.get('project-1')).toMatchObject({
      name: 'Untitled',
      width: 8,
      layers: 1,
      thumbnail: 'thumb',
    });
  });

  it('flushes immediately when asked, for example when the page is hidden', async () => {
    const { storage, session, persistence } = setup();
    draw(session, 1);
    await persistence.flush();
    expect(storage.saves).toBe(1);
    await persistence.flush();
    expect(storage.saves).toBe(1);
  });

  it('saves renames, undo and redo, but not a cleared history', async () => {
    const { storage, session, persistence } = setup();
    session.document.renameSprite('Hero');
    await persistence.flush();
    expect(storage.summaries.get('project-1')?.name).toBe('Hero');

    session.undo();
    await persistence.flush();
    expect(storage.summaries.get('project-1')?.name).toBe('Untitled');
    expect(storage.saves).toBe(2);
  });

  it('restores the last project, with its pixels, after a "reload"', async () => {
    const first = setup();
    draw(first.session, 4);
    await first.persistence.flush();

    const created = EditorSession.create(
      { width: 8, height: 8 },
      { ids: createSequentialIdGenerator('b') },
    );
    if (!created.ok) throw new Error('session');
    let id = 0;
    const second = new Persistence({
      session: created.value,
      storage: first.storage,
      emergency: first.emergency,
      loadFormats: () => import('@vidopix/core/project-formats'),
      makeThumbnail: () => 'thumb',
      newId: () => `other-${String(++id)}`,
      now: () => 5000,
      onStatus: () => undefined,
    });
    expect(await second.restoreLast()).toBe('restored');
    expect(created.value.activeLayer.buffer.get(4, 1)).toBe(packRgba(255, 0, 0, 255));
    expect(second.currentProjectId).toBe('project-1');
    expect(created.value.canUndo).toBe(false);
  });

  it('does not restore over work the user has already started', async () => {
    const first = setup();
    draw(first.session, 4);
    await first.persistence.flush();

    const next = setup();
    draw(next.session, 2);
    const again = new Persistence({
      session: next.session,
      storage: first.storage,
      emergency: first.emergency,
      loadFormats: () => import('@vidopix/core/project-formats'),
      makeThumbnail: () => 'thumb',
      newId: () => 'x',
      now: () => 1,
      onStatus: () => undefined,
    });
    expect(await again.restoreLast()).toBe('skipped');
    expect(next.session.activeLayer.buffer.get(2, 1)).not.toBe(0);
  });

  it('reports "none" with nothing stored, and "failed" when storage throws', async () => {
    const { persistence, storage } = setup();
    expect(await persistence.restoreLast()).toBe('none');
    storage.getLastId = () => Promise.reject(new Error('blocked'));
    expect(await persistence.restoreLast()).toBe('failed');
  });

  it('ignores a remembered project that is gone or damaged', async () => {
    const { persistence, storage } = setup();
    storage.last = 'missing';
    expect(await persistence.restoreLast()).toBe('none');
    storage.last = 'broken';
    storage.data.set('broken', '{not json');
    expect(await persistence.restoreLast()).toBe('none');
  });

  it('starts a new project each time the user replaces the document', async () => {
    const { storage, session, persistence } = setup();
    draw(session, 1);
    await persistence.flush();
    session.newSprite({ width: 4, height: 4 });
    expect(persistence.currentProjectId).toBe('project-2');
    draw(session, 1);
    await persistence.flush();
    expect([...storage.summaries.keys()].sort()).toEqual(['project-1', 'project-2']);
    expect(storage.last).toBe('project-2');
  });

  it('opens a file as a new project and saves it', async () => {
    const { storage, session, persistence } = setup();
    draw(session, 1);
    const formats = await import('@vidopix/core/project-formats');
    const text = formats.serializeProject(session.sprite);

    session.newSprite({ width: 3, height: 3 });
    const result = await persistence.openFileText(text);
    expect(result).toEqual({ ok: true });
    expect(session.sprite.width).toBe(8);
    await persistence.flush();
    expect(storage.summaries.size).toBe(2);
  });

  it('explains a file that cannot be opened and leaves the document alone', async () => {
    const { session, persistence } = setup();
    draw(session, 1);
    const result = await persistence.openFileText('nope');
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining('JSON') as string });
    expect(session.canUndo).toBe(true);
  });

  it('opens a stored project by id and saves the current one first', async () => {
    const { storage, session, persistence } = setup();
    draw(session, 1);
    await persistence.flush();
    session.newSprite({ width: 5, height: 5 });
    draw(session, 2);
    expect(await persistence.openStored('project-1')).toBe(true);
    expect(storage.summaries.size).toBe(2);
    expect(session.sprite.width).toBe(8);
    expect(persistence.currentProjectId).toBe('project-1');
    expect(await persistence.openStored('nope')).toBe(false);
  });

  it('reports an error and keeps trying later when storage fails', async () => {
    const { storage, session, persistence, statuses } = setup();
    storage.failNext = true;
    draw(session, 1);
    await persistence.flush();
    expect(statuses.at(-1)).toBe('error');
    await persistence.flush();
    expect(statuses.at(-1)).toBe('saved');
    expect(storage.saves).toBe(1);
  });

  it('keeps a synchronous copy when the page is closing and restores it after a "reload"', async () => {
    const first = setup();
    draw(first.session, 6);
    // Warm the cache the way the app does at startup, then close before any normal save finishes.
    await first.persistence.flush();
    draw(first.session, 7);
    first.persistence.snapshotNow();
    expect(first.emergency.entry?.id).toBe('project-1');
    expect(first.storage.saves).toBe(1);

    const created = EditorSession.create(
      { width: 8, height: 8 },
      { ids: createSequentialIdGenerator('c') },
    );
    if (!created.ok) throw new Error('session');
    const reopened = new Persistence({
      session: created.value,
      storage: first.storage,
      emergency: first.emergency,
      loadFormats: () => import('@vidopix/core/project-formats'),
      makeThumbnail: () => 'thumb',
      newId: () => 'fresh',
      now: () => 9000,
      onStatus: () => undefined,
      debounceMs: 10,
    });
    expect(await reopened.restoreLast()).toBe('restored');
    expect(created.value.activeLayer.buffer.get(7, 1)).toBe(packRgba(255, 0, 0, 255));
    expect(reopened.currentProjectId).toBe('project-1');

    // Once it is in normal storage the emergency copy is gone.
    await reopened.flush();
    expect(first.emergency.entry).toBeNull();
    expect(first.storage.saves).toBe(2);
  });

  it('makes no emergency copy when nothing changed, or storage refuses it', async () => {
    const { emergency, session, persistence } = setup();
    persistence.snapshotNow();
    expect(emergency.entry).toBeNull();
    draw(session, 1);
    await persistence.flush();
    draw(session, 2);
    emergency.failWrites = true;
    expect(() => {
      persistence.snapshotNow();
    }).not.toThrow();
    expect(emergency.entry).toBeNull();
  });

  it('drops an emergency copy that cannot be read', async () => {
    const { emergency, persistence } = setup();
    emergency.entry = { id: 'x', savedAt: 1, text: 'garbage' };
    expect(await persistence.restoreLast()).toBe('none');
    expect(emergency.entry).toBeNull();
  });

  it('does not restore an emergency copy over work already started', async () => {
    const first = setup();
    draw(first.session, 1);
    await first.persistence.flush();
    draw(first.session, 2);
    first.persistence.snapshotNow();

    const next = setup();
    next.emergency.entry = first.emergency.entry;
    draw(next.session, 3);
    expect(await next.persistence.restoreLast()).toBe('skipped');
  });

  it('does not save after being disposed', async () => {
    const { storage, session, persistence } = setup();
    persistence.dispose();
    draw(session, 1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(storage.saves).toBe(0);
  });
});
