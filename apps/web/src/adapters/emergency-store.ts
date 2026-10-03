import type { EmergencyEntry, EmergencyStore } from '../state/persistence';

const KEY = 'vidopix.emergency';

/** The last-chance copy lives in localStorage, the only storage that can be written synchronously. */
export const localEmergencyStore: EmergencyStore = {
  write(entry) {
    window.localStorage.setItem(KEY, JSON.stringify(entry));
  },
  read() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === null) return null;
      const data = JSON.parse(raw) as Partial<EmergencyEntry>;
      return typeof data.id === 'string' &&
        typeof data.text === 'string' &&
        typeof data.savedAt === 'number'
        ? { id: data.id, savedAt: data.savedAt, text: data.text }
        : null;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing to clear if storage is blocked.
    }
  },
};
