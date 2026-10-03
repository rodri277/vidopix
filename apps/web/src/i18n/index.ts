import { en, type MessageKey } from './en';
import { es } from './es';

export type Language = 'en' | 'es';
export type { MessageKey };

export const LANGUAGES: readonly { readonly id: Language; readonly label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export const DEFAULT_LANGUAGE: Language = 'en';

const CATALOGS: Readonly<Record<Language, Readonly<Record<MessageKey, string>>>> = { en, es };

export type MessageParams = Readonly<Record<string, string | number>>;

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es';
}

/**
 * The language to start in: the one the user chose before, else the first browser language we
 * support (Spanish for any "es" variant), else English.
 */
export function detectLanguage(preferred: readonly string[], stored: string | null): Language {
  if (isLanguage(stored)) return stored;
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return DEFAULT_LANGUAGE;
}

/** Looks a message up and fills in `{name}` placeholders. */
export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  const template = CATALOGS[language][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** The `{placeholders}` a message expects, used to check that translations agree. */
export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

export { CATALOGS };
