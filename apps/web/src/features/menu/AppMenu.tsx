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
  const hasSelection = useEditorState((state) => state.selection !== null);
  const layerCount = useEditorState((state) => state.layers.length);
  const activeIndex = useEditorState((state) =>
    state.layers.findIndex((layer) => layer.id === state.activeLayerId),
  );

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
            label: 'Cut',
            shortcut: shortcutLabel('X'),
            separatorBefore: true,
            disabled: !hasSelection,
            onSelect: () => {
              actions.cut();
            },
          },
          {
            label: 'Copy',
            shortcut: shortcutLabel('C'),
            disabled: !hasSelection,
            onSelect: () => {
              actions.copy();
            },
          },
          {
            label: 'Paste',
            shortcut: shortcutLabel('V'),
            onSelect: () => {
              void actions.paste();
            },
          },
          {
            label: 'Delete',
            shortcut: 'Del',
            disabled: !hasSelection,
            onSelect: () => {
              actions.deleteSelection();
            },
          },
          {
            label: 'Select all',
            shortcut: shortcutLabel('A'),
            separatorBefore: true,
            onSelect: () => {
              actions.selectAll();
            },
          },
          {
            label: 'Deselect',
            shortcut: shortcutLabel('D'),
            disabled: !hasSelection,
            onSelect: () => {
              actions.deselect();
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
        label: 'Layer',
        items: [
          {
            label: 'New layer',
            shortcut: shortcutLabel('Shift+N'),
            onSelect: () => {
              actions.addLayer();
            },
          },
          {
            label: 'Duplicate layer',
            shortcut: shortcutLabel('J'),
            onSelect: () => {
              actions.duplicateLayer();
            },
          },
          {
            label: 'Delete layer',
            disabled: layerCount <= 1,
            onSelect: () => {
              actions.deleteLayer();
            },
          },
          {
            label: 'Merge down',
            separatorBefore: true,
            disabled: activeIndex <= 0,
            onSelect: () => {
              actions.mergeDown();
            },
          },
          {
            label: 'Flatten image',
            disabled: layerCount <= 1,
            onSelect: () => {
              actions.flatten();
            },
          },
          {
            label: 'Move layer up',
            shortcut: shortcutLabel(']'),
            separatorBefore: true,
            disabled: activeIndex >= layerCount - 1,
            onSelect: () => {
              actions.shiftActiveLayer(1);
            },
          },
          {
            label: 'Move layer down',
            shortcut: shortcutLabel('['),
            disabled: activeIndex <= 0,
            onSelect: () => {
              actions.shiftActiveLayer(-1);
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
  }, [store, canUndo, canRedo, showGrid, panelsHidden, hasSelection, layerCount, activeIndex]);

  return (
    <>
      <span className={styles.logo} aria-hidden="true" />
      <h1 className={styles.title}>Vidopix</h1>
      <MenuBar label="Main menu" menus={menus} />
    </>
  );
}
