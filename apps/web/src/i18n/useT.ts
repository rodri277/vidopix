import { useCallback } from 'react';
import { useEditorState } from '../state/editor-context';
import { translate, type MessageKey, type MessageParams } from './index';

export type TFunction = (key: MessageKey, params?: MessageParams) => string;

/** Returns the translate function for the current language; components re-render when it changes. */
export function useT(): TFunction {
  const language = useEditorState((state) => state.language);
  return useCallback<TFunction>((key, params) => translate(language, key, params), [language]);
}
