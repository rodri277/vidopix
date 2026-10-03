import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProjectStorage, ProjectSummary } from '../state/persistence';

interface VidopixDb extends DBSchema {
  /** Light records for listing, kept apart from the data so the list never loads the pixels. */
  projects: { key: string; value: ProjectSummary; indexes: { 'by-updated': number } };
  data: { key: string; value: string };
  meta: { key: string; value: string };
}

const DATABASE = 'vidopix';
const VERSION = 1;
const LAST_ID = 'lastProjectId';

/** Stores projects in the browser's IndexedDB. Nothing leaves the device. */
export function createIdbStorage(): ProjectStorage {
  let opened: Promise<IDBPDatabase<VidopixDb>> | null = null;
  const database = (): Promise<IDBPDatabase<VidopixDb>> => {
    opened ??= openDB<VidopixDb>(DATABASE, VERSION, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        db.createObjectStore('data');
        db.createObjectStore('meta');
      },
    });
    return opened;
  };

  return {
    async save(summary, data) {
      const db = await database();
      const tx = db.transaction(['projects', 'data'], 'readwrite');
      await Promise.all([
        tx.objectStore('projects').put(summary),
        tx.objectStore('data').put(data, summary.id),
        tx.done,
      ]);
    },
    async load(id) {
      return (await (await database()).get('data', id)) ?? null;
    },
    async list() {
      const all = await (await database()).getAllFromIndex('projects', 'by-updated');
      return all.reverse();
    },
    async remove(id) {
      const db = await database();
      const tx = db.transaction(['projects', 'data', 'meta'], 'readwrite');
      await Promise.all([
        tx.objectStore('projects').delete(id),
        tx.objectStore('data').delete(id),
        (async () => {
          if ((await tx.objectStore('meta').get(LAST_ID)) === id) {
            await tx.objectStore('meta').delete(LAST_ID);
          }
        })(),
        tx.done,
      ]);
    },
    async getLastId() {
      return (await (await database()).get('meta', LAST_ID)) ?? null;
    },
    async setLastId(id) {
      const db = await database();
      if (id === null) await db.delete('meta', LAST_ID);
      else await db.put('meta', id, LAST_ID);
    },
  };
}
