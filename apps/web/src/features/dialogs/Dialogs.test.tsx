import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { Dialogs } from './Dialogs';

describe('NewSpriteDialog', () => {
  it('creates a sprite from a preset', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('new-sprite');
    const dialog = await screen.findByRole('dialog', { name: 'New sprite', hidden: true });

    await userEvent.click(within(dialog).getByRole('button', { name: '64×64' }));
    await userEvent.type(within(dialog).getByLabelText('Name (optional)'), 'Hero');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(session.sprite.width).toBe(64);
    expect(session.sprite.name).toBe('Hero');
    expect(store.getState().dialog).toBeNull();
  });

  it('shows an error and keeps the dialog open for an invalid size', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('new-sprite');
    const dialog = await screen.findByRole('dialog', { name: 'New sprite', hidden: true });

    const width = within(dialog).getByLabelText('Width (px)');
    await userEvent.clear(width);
    await userEvent.type(width, '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent('from 1 to 1024');
    expect(session.sprite.width).toBe(32);
    expect(store.getState().dialog).toBe('new-sprite');
  });

  it('closes without changing anything when canceled', async () => {
    const { session, store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('new-sprite');
    const dialog = await screen.findByRole('dialog', { name: 'New sprite', hidden: true });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(store.getState().dialog).toBeNull();
    expect(session.sprite.width).toBe(32);
  });
});

describe('ExportDialog', () => {
  it('previews the output size from the scale', async () => {
    const { store } = renderWithEditor(<Dialogs />);
    store.getState().openDialog('export');
    const dialog = await screen.findByRole('dialog', { name: 'Export', hidden: true });
    expect(within(dialog).getByText('Output size: 32×32 px')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Scale'), { target: { value: '3' } });
    expect(within(dialog).getByText('Output size: 96×96 px')).toBeInTheDocument();
  });

  it('offers the animated formats and sizes them from the frames', async () => {
    const { store, session } = renderWithEditor(<Dialogs />);
    session.document.addFrame();
    session.document.addFrame();
    session.document.setAllFrameDurations(250);
    store.getState().openDialog('export');
    const dialog = await screen.findByRole('dialog', { name: 'Export', hidden: true });

    await userEvent.selectOptions(within(dialog).getByLabelText('Format'), 'Animated GIF');
    expect(
      within(dialog).getByText('GIF: 32×32 px, 3 frames, 0.75 s per loop'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/more than half transparent/)).toBeInTheDocument();

    await userEvent.selectOptions(
      within(dialog).getByLabelText('Format'),
      'Spritesheet (PNG + JSON)',
    );
    fireEvent.change(within(dialog).getByLabelText('Columns'), { target: { value: '2' } });
    expect(within(dialog).getByText('Sheet: 64×64 px, 3 frames')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Scale'), { target: { value: '2' } });
    expect(within(dialog).getByText('Sheet: 128×128 px, 3 frames')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Columns'), { target: { value: '9' } });
    expect(within(dialog).getByText('Sheet: 192×64 px, 3 frames')).toBeInTheDocument();
  });
});
