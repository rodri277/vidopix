import { describe, expect, it } from 'vitest';
import {
  CATALOGS,
  LANGUAGES,
  detectLanguage,
  isLanguage,
  placeholdersOf,
  translate,
} from './index';
import { en } from './en';
import { es } from './es';

describe('catalogs', () => {
  it('have the same keys in every language', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in every language', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholdersOf(es[key]), key).toEqual(placeholdersOf(en[key]));
    }
  });

  it('never leave a text empty or untranslated by accident', () => {
    for (const [language, catalog] of Object.entries(CATALOGS)) {
      for (const [key, text] of Object.entries(catalog)) {
        expect(text.trim().length, `${language}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('list the languages the interface can show', () => {
    expect(LANGUAGES.map((language) => language.id)).toEqual(['en', 'es']);
  });
});

describe('translate', () => {
  it('returns the text in the chosen language', () => {
    expect(translate('en', 'menu.file')).toBe('File');
    expect(translate('es', 'menu.file')).toBe('Archivo');
  });

  it('fills placeholders and keeps unknown ones visible', () => {
    expect(translate('en', 'recent.details', { width: 32, height: 16, layers: 3 })).toBe(
      '32×16 px, 3 layers',
    );
    expect(translate('es', 'recent.details', { width: 32, height: 16, layers: 3 })).toBe(
      '32×16 px, 3 capas',
    );
    expect(translate('en', 'recent.details', { width: 1 })).toBe('1×{height} px, {layers} layers');
  });
});

describe('detectLanguage', () => {
  it('prefers what the user chose before', () => {
    expect(detectLanguage(['en-US'], 'es')).toBe('es');
    expect(detectLanguage(['es-ES'], 'en')).toBe('en');
  });

  it('ignores a stored value that is not a language', () => {
    expect(detectLanguage(['es'], 'fr')).toBe('es');
    expect(detectLanguage([], 'xx')).toBe('en');
  });

  it('follows the browser: Spanish for any variant, English otherwise', () => {
    expect(detectLanguage(['es-MX', 'en'], null)).toBe('es');
    expect(detectLanguage(['ES'], null)).toBe('es');
    expect(detectLanguage(['fr-FR', 'es'], null)).toBe('es');
    expect(detectLanguage(['en-GB'], null)).toBe('en');
    expect(detectLanguage(['de', 'fr'], null)).toBe('en');
    expect(detectLanguage([], null)).toBe('en');
  });

  it('knows which values are languages', () => {
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
