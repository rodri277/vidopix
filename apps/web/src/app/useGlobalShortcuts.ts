import { useEffect } from 'react';
import { imageFromPasteEvent } from '../adapters/system-clipboard';
import { isMacPlatform, isTextEntry, resolveShortcut } from '../state/shortcuts';
import type { EditorServices } from '../state/editor-context';
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
export function useGlobalShortcuts(
  session: EditorSession,
  store: EditorStore,
  services: EditorServices,
): void {
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
      if (action.type === 'commit' && !state.hasFloating) return;
      const onControl = event.target instanceof HTMLElement ? event.target : null;
      if (
        (action.type === 'commit' || action.type === 'delete-selection') &&
        onControl?.closest('button, a') !== null &&
        onControl !== null
      ) {
        return;
      }
      // The canvas handles Enter itself (it also draws with it).
      if (action.type === 'commit' && onControl?.closest('[role="application"]')) return;
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
          state.stopPlayback();
          session.cancelAction();
          break;
        case 'previous-frame':
          state.stepFrame(-1);
          break;
        case 'next-frame':
          state.stepFrame(1);
          break;
        case 'toggle-playback':
          state.togglePlayback();
          break;
        case 'select-all':
          state.selectAll();
          break;
        case 'deselect':
          state.deselect();
          break;
        case 'delete-selection':
          state.deleteSelection();
          break;
        case 'copy':
          state.copy();
          break;
        case 'cut':
          state.cut();
          break;
        case 'new-layer':
          state.addLayer();
          break;
        case 'duplicate-layer':
          state.duplicateLayer();
          break;
        case 'layer-up':
          state.shiftActiveLayer(1);
          break;
        case 'layer-down':
          state.shiftActiveLayer(-1);
          break;
        case 'open-file': {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.vidopix,application/json';
          input.onchange = () => {
            const file = input.files?.[0];
            if (file) void services.projects.openFile(file);
          };
          input.click();
          break;
        }
        case 'save-file':
          void services.projects.saveFile();
          break;
        case 'shortcuts-help':
          state.openDialog('shortcuts');
          break;
        case 'commit':
          if (state.hasFloating) state.commitFloating();
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

    const onPaste = (event: ClipboardEvent): void => {
      if (isTextEntry(event.target) || store.getState().dialog !== null) return;
      event.preventDefault();
      void imageFromPasteEvent(event)
        .then((image) => {
          if (image) store.getState().pasteImage(image);
          else store.getState().pasteInternal();
        })
        .catch(() => {
          store.getState().pasteInternal();
        });
    };

    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [session, store, services]);
}
