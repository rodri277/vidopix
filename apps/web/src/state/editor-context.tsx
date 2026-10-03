import type { EditorSession } from '@vidopix/core';
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { ProjectService } from '../adapters/project-service';
import type { EditorActions, EditorState, EditorStore } from './editor-store';

export interface EditorServices {
  readonly projects: ProjectService;
}

interface EditorContextValue {
  readonly session: EditorSession;
  readonly store: EditorStore;
  readonly services: EditorServices;
}

const EditorContext = createContext<EditorContextValue | null>(null);

interface ProviderProps extends EditorContextValue {
  readonly children: ReactNode;
}

export function EditorProvider({ session, store, services, children }: ProviderProps) {
  return (
    <EditorContext.Provider value={{ session, store, services }}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside <EditorProvider>');
  return value;
}

export function useEditorState<T>(selector: (state: EditorState & EditorActions) => T): T {
  return useStore(useEditor().store, selector);
}
