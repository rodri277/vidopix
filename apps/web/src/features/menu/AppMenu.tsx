import { useMemo } from 'react';
import { MenuBar, type MenuDefinition } from '../../design-system/MenuBar';
import { useEditor, useEditorState } from '../../state/editor-context';
import { shortcutLabel } from '../../state/shortcut-labels';
import styles from './AppMenu.module.css';

export function AppMenu() {
  const { store } = useEditor();
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const showGrid = useEditorState((state) => state.showGrid);
  const panelsHidden = useEditorState((state) => state.panelsHidden);

  const menus = useMemo<readonly MenuDefinition[]>(() => {
    const actions = store.getState();
    return [
      {
        label: 'File',
        items: [
          {
            label: 'New sprite…',
            shortcut: shortcutLabel('N'),
            onSelect: () => {
              actions.openDialog('new-sprite');
            },
          },
          {
            label: 'Export PNG…',
            shortcut: shortcutLabel('E'),
            onSelect: () => {
              actions.openDialog('export');
            },
          },
        ],
      },
      {
        label: 'Edit',
        items: [
          {
            label: 'Undo',
            shortcut: shortcutLabel('Z'),
            disabled: !canUndo,
            onSelect: () => {
              actions.undo();
            },
          },
          {
            label: 'Redo',
            shortcut: shortcutLabel('Shift+Z'),
            disabled: !canRedo,
            onSelect: () => {
              actions.redo();
            },
          },
          {
            label: 'Swap colors',
            shortcut: 'X',
            separatorBefore: true,
            onSelect: () => {
              actions.swapColors();
            },
          },
        ],
      },
      {
        label: 'View',
        items: [
          {
            label: 'Zoom in',
            shortcut: '+',
            onSelect: () => {
              actions.zoomStep(1);
            },
          },
          {
            label: 'Zoom out',
            shortcut: '-',
            onSelect: () => {
              actions.zoomStep(-1);
            },
          },
          {
            label: 'Fit to screen',
            shortcut: '0',
            onSelect: () => {
              actions.fitToView();
            },
          },
          {
            label: 'Actual size (100%)',
            shortcut: '1',
            onSelect: () => {
              actions.zoomTo(1);
            },
          },
          {
            label: showGrid ? 'Hide grid' : 'Show grid',
            shortcut: shortcutLabel("'"),
            separatorBefore: true,
            onSelect: () => {
              actions.toggleGrid();
            },
          },
          {
            label: panelsHidden ? 'Show panels' : 'Hide panels',
            shortcut: shortcutLabel('\\'),
            onSelect: () => {
              actions.togglePanels();
            },
          },
        ],
      },
    ];
  }, [store, canUndo, canRedo, showGrid, panelsHidden]);

  return (
    <>
      <span className={styles.logo} aria-hidden="true" />
      <h1 className={styles.title}>Vidopix</h1>
      <MenuBar label="Main menu" menus={menus} />
    </>
  );
}
