import { toHex, type Color } from '@vidopix/core';
import { useState } from 'react';
import { Button } from '../../design-system/Button';
import { Dialog } from '../../design-system/Dialog';
import { toCssColor } from '../../state/css-color';
import { useEditor, useEditorState } from '../../state/editor-context';
import fieldStyles from '../../design-system/Field.module.css';
import hintStyles from './NewSpriteDialog.module.css';

const hexOf = (color: Color): string => toHex(color).toUpperCase();

export function ReplaceColorDialog() {
  const { store } = useEditor();
  const primary = useEditorState((state) => state.primary);
  const secondary = useEditorState((state) => state.secondary);
  const palette = useEditorState((state) => state.palette);
  const hasSelection = useEditorState((state) => state.selection !== null);
  const [fromKey, setFromKey] = useState('secondary');
  const [toKey, setToKey] = useState('primary');

  const resolve = (key: string): Color => {
    if (key === 'primary') return primary;
    if (key === 'secondary') return secondary;
    return palette.colors[Number(key.slice(2))]?.color ?? primary;
  };
  const from = resolve(fromKey);
  const to = resolve(toKey);

  const options = (
    <>
      <option value="primary">Primary color ({hexOf(primary)})</option>
      <option value="secondary">Secondary color ({hexOf(secondary)})</option>
      {palette.colors.map((entry, index) => (
        <option key={entry.color} value={`p-${String(index)}`}>
          {entry.name ? `${entry.name} ` : ''}
          {hexOf(entry.color)}
        </option>
      ))}
    </>
  );

  const close = (): void => {
    store.getState().closeDialog();
  };

  return (
    <Dialog
      title="Replace color"
      onClose={close}
      onSubmit={() => {
        store.getState().replaceColor(from, to);
        close();
      }}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={from === to}>
            Replace
          </Button>
        </>
      }
    >
      <label className={fieldStyles.field}>
        Replace
        <select
          className={fieldStyles.input}
          value={fromKey}
          onChange={(event) => {
            setFromKey(event.target.value);
          }}
        >
          {options}
        </select>
      </label>
      <label className={fieldStyles.field}>
        With
        <select
          className={fieldStyles.input}
          value={toKey}
          onChange={(event) => {
            setToKey(event.target.value);
          }}
        >
          {options}
        </select>
      </label>
      <div aria-hidden="true" style={{ display: 'flex', gap: 8 }}>
        <span
          style={{ width: 28, height: 28, background: toCssColor(from), border: '1px solid #fff4' }}
        />
        <span>→</span>
        <span
          style={{ width: 28, height: 28, background: toCssColor(to), border: '1px solid #fff4' }}
        />
      </div>
      <p className={hintStyles.hint}>
        Matches the exact color on every layer, hidden ones included; locked layers are skipped.
        {hasSelection ? ' Only the selected area changes.' : ''} One undo step.
      </p>
    </Dialog>
  );
}
