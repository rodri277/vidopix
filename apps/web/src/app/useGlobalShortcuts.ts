import { useEffect } from 'react';
import { isMacPlatform, isTextEntry, resolveShortcut } from '../state/shortcuts';
import type { EditorStore } from '../state/editor-store';
import type { EditorSession } from '@vidopix/core';

/** True when the key press belongs to a control that already uses it (buttons, menus, dialogs). */
function isInsideDialogOrMenu(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('dialog, [role="menu"], [role="menubar"]') !== null
  );
}

/**
 * Editor-wide keyboard shortcuts, plus the two "hold" behaviors: Space pans while pressed and Alt
 * temporarily switches to the eyedropper.
 */
export function useGlobalShortcuts(session: EditorSession, store: EditorStore): void {
  useEffect(() => {
    const isMac = isMacPlatform(navigator.platform);
    let toolBeforeAlt: ReturnType<typeof store.getState>['tool'] | null = null;

    const endAlt = (): void => {
      if (toolBeforeAlt === null) return;
      store.getState().selectTool(toolBeforeAlt);
      toolBeforeAlt = null;
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTextEntry(event.target) || event.isComposing) return;
      const state = store.getState();

      if (event.key === ' ' && !isInsideDialogOrMenu(event.target)) {
        const target = event.target;
        const onControl =
          target instanceof HTMLElement &&
          target.closest('button, a, summary, [role="menuitem"]') !== null;
        if (!onControl && state.dialog === null) {
          event.preventDefault();
          state.setPanMode(true);
        }
        return;
      }

      if (state.dialog !== null || isInsideDialogOrMenu(event.target)) return;

      if (
        event.key === 'Alt' &&
        !event.repeat &&
        toolBeforeAlt === null &&
        state.tool !== 'eyedropper'
      ) {
        toolBeforeAlt = state.tool;
        state.selectTool('eyedropper');
        return;
      }

      const action = resolveShortcut(event, isMac);
      if (!action) return;
      event.preventDefault();
      switch (action.type) {
        case 'tool':
          state.selectTool(action.tool);
          break;
        case 'swap-colors':
          state.swapColors();
          break;
        case 'brush-size':
          state.adjustBrushSize(action.delta);
          break;
        case 'undo':
          state.undo();
          break;
        case 'redo':
          state.redo();
          break;
        case 'zoom-in':
          state.zoomStep(1);
          break;
        case 'zoom-out':
          state.zoomStep(-1);
          break;
        case 'zoom-fit':
          state.fitToView();
          break;
        case 'zoom-100':
          state.zoomTo(1);
          break;
        case 'toggle-grid':
          state.toggleGrid();
          break;
        case 'toggle-panels':
          state.togglePanels();
          break;
        case 'new-sprite':
          state.openDialog('new-sprite');
          break;
        case 'export':
          state.openDialog('export');
          break;
        case 'cancel':
          session.cancelStroke();
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === ' ') store.getState().setPanMode(false);
      if (event.key === 'Alt') endAlt();
    };

    const onBlur = (): void => {
      store.getState().setPanMode(false);
      endAlt();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [session, store]);
}
