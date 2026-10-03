import { packRgba } from '@vidopix/core';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { Dialogs } from './Dialogs';

const RED = packRgba(255, 0, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

describe('ReplaceColorDialog', () => {
  it('replaces one color with another in the drawing', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    session.setColor('primary', BLUE);
    session.setColor('secondary', RED);
    session.activeLayer.buffer.set(2, 2, RED);
    store.getState().openDialog('replace-color');
    const dialog = await screen.findByRole('dialog', { name: 'Replace color', hidden: true });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));

    expect(session.activeLayer.buffer.get(2, 2)).toBe(BLUE);
    expect(store.getState().notice).toBe('Replaced 1 pixel');
    expect(store.getState().dialog).toBeNull();
  });

  it('lists palette colors and disables the button when both choices are the same', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    session.document.addPaletteColor(RED, 'Red');
    store.getState().openDialog('replace-color');
    const dialog = await screen.findByRole('dialog', { name: 'Replace color', hidden: true });

    const [from, to] = within(dialog).getAllByRole('combobox');
    if (!from || !to) throw new Error('selects');
    expect(within(from).getByRole('option', { name: 'Red #FF0000' })).toBeInTheDocument();
    await userEvent.selectOptions(from, 'primary');
    expect(within(dialog).getByRole('button', { name: 'Replace' })).toBeDisabled();
  });

  it('says when the color is not in the drawing', async () => {
    const { store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('replace-color');
    const dialog = await screen.findByRole('dialog', { name: 'Replace color', hidden: true });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace' }));
    expect(store.getState().notice).toBe('That color is not in the drawing');
  });

  it('mentions the selection when there is one', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    session.document.selectAll();
    store.getState().openDialog('replace-color');
    const dialog = await screen.findByRole('dialog', { name: 'Replace color', hidden: true });
    expect(within(dialog).getByText(/Only the selected area changes/)).toBeInTheDocument();
  });
});

describe('ExtractPaletteDialog', () => {
  it('needs an image before it can extract, and offers a 4 to 64 color range', async () => {
    const { store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('extract-palette');
    const dialog = await screen.findByRole('dialog', {
      name: 'Extract palette from an image',
      hidden: true,
    });
    expect(within(dialog).getByRole('button', { name: 'Extract' })).toBeDisabled();
    const slider = within(dialog).getByLabelText('Colors');
    expect(slider).toHaveAttribute('min', '4');
    expect(slider).toHaveAttribute('max', '64');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(store.getState().dialog).toBeNull();
  });
});
