import type { EditorSession } from '@vidopix/core';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { EditorActions, EditorState, EditorStore } from './editor-store';

interface EditorContextValue {
  readonly session: EditorSession;
  readonly store: EditorStore;
}

const EditorContext = createContext<EditorContextValue | null>(null);

interface ProviderProps extends EditorContextValue {
  readonly children: ReactNode;
}

export function EditorProvider({ session, store, children }: ProviderProps) {
  return <EditorContext.Provider value={{ session, store }}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside <EditorProvider>');
  return value;
}

export function useEditorState<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditor().store, selector);
}
