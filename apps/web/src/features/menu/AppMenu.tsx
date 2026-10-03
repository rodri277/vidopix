import { useMemo, useRef, useState } from 'react';
import { MenuBar, type MenuDefinition } from '../../design-system/MenuBar';
import { LANGUAGES } from '../../i18n';
import { useT } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import { shortcutLabel } from '../../state/shortcut-labels';
import styles from './AppMenu.module.css';

function SpriteName() {
  const { store } = useEditor();
  const t = useT();
  const name = useEditorState((state) => state.spriteName);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        className={styles.nameInput}
        aria-label={t('sprite.nameLabel')}
        defaultValue={name}
        maxLength={60}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- replaces the name the user chose to edit
        autoFocus
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            store.getState().renameSprite(event.currentTarget.value);
            setEditing(false);
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            setEditing(false);
          }
        }}
        onBlur={(event) => {
          store.getState().renameSprite(event.currentTarget.value);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={styles.nameButton}
      aria-label={t('sprite.rename', { name })}
      onClick={() => {
        setEditing(true);
      }}
    >
      {name}
    </button>
  );
}

export function AppMenu() {
  const { store, services } = useEditor();
  const t = useT();
  const language = useEditorState((state) => state.language);
  const canUndo = useEditorState((state) => state.canUndo);
  const canRedo = useEditorState((state) => state.canRedo);
  const showGrid = useEditorState((state) => state.showGrid);
  const panelsHidden = useEditorState((state) => state.panelsHidden);
  const hasSelection = useEditorState((state) => state.selection !== null);
  const layerCount = useEditorState((state) => state.layers.length);
  const activeIndex = useEditorState((state) =>
    state.layers.findIndex((layer) => layer.id === state.activeLayerId),
  );
  const fileInput = useRef<HTMLInputElement>(null);

  const menus = useMemo<readonly MenuDefinition[]>(() => {
    const actions = store.getState();
    return [
      {
        label: t('menu.file'),
        items: [
          {
            label: t('file.new'),
            shortcut: shortcutLabel('N'),
            onSelect: () => {
              actions.openDialog('new-sprite');
            },
          },
          {
            label: t('file.open'),
            shortcut: shortcutLabel('O'),
            onSelect: () => {
              fileInput.current?.click();
            },
          },
          {
            label: t('file.recent'),
            onSelect: () => {
              actions.openDialog('recent-projects');
            },
          },
          {
            label: t('file.save'),
            shortcut: shortcutLabel('S'),
            separatorBefore: true,
            onSelect: () => {
              void services.projects.saveFile();
            },
          },
          {
            label: t('file.exportPng'),
            shortcut: shortcutLabel('E'),
            onSelect: () => {
              actions.openDialog('export');
            },
          },
          {
            label: t('file.share'),
            onSelect: () => {
              actions.openDialog('share');
            },
          },
        ],
      },
      {
        label: t('menu.edit'),
        items: [
          {
            label: t('edit.undo'),
            shortcut: shortcutLabel('Z'),
            disabled: !canUndo,
            onSelect: () => {
              actions.undo();
            },
          },
          {
            label: t('edit.redo'),
            shortcut: shortcutLabel('Shift+Z'),
            disabled: !canRedo,
            onSelect: () => {
              actions.redo();
            },
          },
          {
            label: t('edit.cut'),
            shortcut: shortcutLabel('X'),
            separatorBefore: true,
            disabled: !hasSelection,
            onSelect: () => {
              actions.cut();
            },
          },
          {
            label: t('edit.copy'),
            shortcut: shortcutLabel('C'),
            disabled: !hasSelection,
            onSelect: () => {
              actions.copy();
            },
          },
          {
            label: t('edit.paste'),
            shortcut: shortcutLabel('V'),
            onSelect: () => {
              void actions.paste();
            },
          },
          {
            label: t('edit.delete'),
            shortcut: 'Del',
            disabled: !hasSelection,
            onSelect: () => {
              actions.deleteSelection();
            },
          },
          {
            label: t('edit.selectAll'),
            shortcut: shortcutLabel('A'),
            separatorBefore: true,
            onSelect: () => {
              actions.selectAll();
            },
          },
          {
            label: t('edit.deselect'),
            shortcut: shortcutLabel('D'),
            disabled: !hasSelection,
            onSelect: () => {
              actions.deselect();
            },
          },
          {
            label: t('edit.swapColors'),
            shortcut: 'X',
            separatorBefore: true,
            onSelect: () => {
              actions.swapColors();
            },
          },
        ],
      },
      {
        label: t('menu.layer'),
        items: [
          {
            label: t('layer.new'),
            shortcut: shortcutLabel('Shift+N'),
            onSelect: () => {
              actions.addLayer();
            },
          },
          {
            label: t('layer.duplicate'),
            shortcut: shortcutLabel('J'),
            onSelect: () => {
              actions.duplicateLayer();
            },
          },
          {
            label: t('layer.delete'),
            disabled: layerCount <= 1,
            onSelect: () => {
              actions.deleteLayer();
            },
          },
          {
            label: t('layer.mergeDown'),
            separatorBefore: true,
            disabled: activeIndex <= 0,
            onSelect: () => {
              actions.mergeDown();
            },
          },
          {
            label: t('layer.flatten'),
            disabled: layerCount <= 1,
            onSelect: () => {
              actions.flatten();
            },
          },
          {
            label: t('layer.moveUp'),
            shortcut: shortcutLabel(']'),
            separatorBefore: true,
            disabled: activeIndex >= layerCount - 1,
            onSelect: () => {
              actions.shiftActiveLayer(1);
            },
          },
          {
            label: t('layer.moveDown'),
            shortcut: shortcutLabel('['),
            disabled: activeIndex <= 0,
            onSelect: () => {
              actions.shiftActiveLayer(-1);
            },
          },
        ],
      },
      {
        label: t('menu.view'),
        items: [
          {
            label: t('view.zoomIn'),
            shortcut: '+',
            onSelect: () => {
              actions.zoomStep(1);
            },
          },
          {
            label: t('view.zoomOut'),
            shortcut: '-',
            onSelect: () => {
              actions.zoomStep(-1);
            },
          },
          {
            label: t('view.fit'),
            shortcut: '0',
            onSelect: () => {
              actions.fitToView();
            },
          },
          {
            label: t('view.actualSize'),
            shortcut: '1',
            onSelect: () => {
              actions.zoomTo(1);
            },
          },
          {
            label: showGrid ? t('view.hideGrid') : t('view.showGrid'),
            shortcut: shortcutLabel("'"),
            separatorBefore: true,
            onSelect: () => {
              actions.toggleGrid();
            },
          },
          {
            label: panelsHidden ? t('view.showPanels') : t('view.hidePanels'),
            shortcut: shortcutLabel('\\'),
            onSelect: () => {
              actions.togglePanels();
            },
          },
        ],
      },
      {
        label: t('menu.help'),
        items: [
          {
            label: t('help.shortcuts'),
            shortcut: '?',
            onSelect: () => {
              actions.openDialog('shortcuts');
            },
          },
          ...LANGUAGES.map((option, index) => ({
            label: t('help.languageName', { language: option.label }),
            checked: option.id === language,
            separatorBefore: index === 0,
            onSelect: () => {
              actions.setLanguage(option.id);
            },
          })),
        ],
      },
    ];
  }, [
    store,
    services,
    t,
    language,
    canUndo,
    canRedo,
    showGrid,
    panelsHidden,
    hasSelection,
    layerCount,
    activeIndex,
  ]);

  return (
    <>
      <span className={styles.logo} aria-hidden="true" />
      <h1 className={styles.title}>Vidopix</h1>
      <MenuBar label={t('menu.main')} menus={menus} />
      <SpriteName />
      <input
        ref={fileInput}
        className={styles.hiddenInput}
        type="file"
        accept=".vidopix,application/json"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void services.projects.openFile(file);
        }}
      />
    </>
  );
}
