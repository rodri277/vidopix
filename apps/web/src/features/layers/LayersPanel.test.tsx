import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { LayersPanel } from './LayersPanel';

const names = (): string[] =>
  within(screen.getByRole('list', { name: 'Layer list' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('LayersPanel', () => {
  it('lists layers top first and adds, duplicates and deletes them', async () => {
    const { session } = renderWithEditor(<LayersPanel />);
    expect(names()).toEqual(['Layer 1']);

    await userEvent.click(screen.getByRole('button', { name: 'New layer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate layer' }));
    expect(names()).toEqual(['Layer 2 copy', 'Layer 2', 'Layer 1']);
    expect(session.sprite.layers).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Delete layer' }));
    expect(names()).toEqual(['Layer 2', 'Layer 1']);
  });

  it('disables actions that do not apply', async () => {
    renderWithEditor(<LayersPanel />);
    expect(screen.getByRole('button', { name: 'Delete layer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Merge down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Flatten image' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move layer up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move layer down' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'New layer' }));
    expect(screen.getByRole('button', { name: 'Merge down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move layer up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move layer down' })).toBeEnabled();
  });

  it('toggles visibility and lock and reflects them in names and state', async () => {
    const { session } = renderWithEditor(<LayersPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide Layer 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lock Layer 1' }));

    expect(session.activeLayer).toMatchObject({ visible: false, locked: true });
    expect(screen.getByRole('button', { name: 'Layer 1, locked, hidden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Layer 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('switches the active layer on click and marks it with aria-current', async () => {
    renderWithEditor(<LayersPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New layer' }));
    const top = screen.getByRole('button', { name: 'Layer 2' });
    const bottom = screen.getByRole('button', { name: 'Layer 1' });
    expect(top).toHaveAttribute('aria-current', 'true');

    await userEvent.click(bottom);
    expect(bottom).toHaveAttribute('aria-current', 'true');
    expect(top).not.toHaveAttribute('aria-current');
    expect(bottom).toHaveAttribute('tabindex', '0');
    expect(top).toHaveAttribute('tabindex', '-1');
  });

  it('moves between layers with the arrow keys and reorders with Alt', async () => {
    const { session } = renderWithEditor(<LayersPanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New layer' }));
    screen.getByRole('button', { name: 'Layer 2' }).focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(session.activeLayer.name).toBe('Layer 1');
    // Focus follows the selection on the next frame.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Layer 1' })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowUp}');
    expect(session.activeLayer.name).toBe('Layer 2');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Layer 2' })).toHaveFocus();
    });

    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(session.sprite.layers.map((layer) => layer.name)).toEqual(['Layer 2', 'Layer 1']);
    expect(names()).toEqual(['Layer 1', 'Layer 2']);
  });

  it('renames with F2 and double click, Enter to accept and Escape to cancel', async () => {
    const { session } = renderWithEditor(<LayersPanel />);
    screen.getByRole('button', { name: 'Layer 1' }).focus();
    await userEvent.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: 'Rename Layer 1' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Sky{Enter}');
    expect(session.activeLayer.name).toBe('Sky');

    await userEvent.dblClick(screen.getByRole('button', { name: 'Sky' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Rename Sky' }), 'xx{Escape}');
    expect(session.activeLayer.name).toBe('Sky');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('previews opacity live and records one step when released', () => {
    const { session } = renderWithEditor(<LayersPanel />);
    const slider = screen.getByLabelText('Opacity');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(session.activeLayer.opacity).toBeCloseTo(0.6);
    expect(session.canUndo).toBe(false);

    fireEvent.pointerUp(slider);
    expect(session.canUndo).toBe(true);
    session.undo();
    expect(session.activeLayer.opacity).toBe(1);
  });

  it('commits opacity changes made with the keyboard', () => {
    const { session } = renderWithEditor(<LayersPanel />);
    const slider = screen.getByLabelText('Opacity');
    fireEvent.change(slider, { target: { value: '40' } });
    fireEvent.keyUp(slider, { key: 'ArrowLeft' });
    expect(session.canUndo).toBe(true);
    fireEvent.keyUp(slider, { key: 'a' });
  });

  it('reorders by dragging a row onto another', () => {
    const { session } = renderWithEditor(<LayersPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'New layer' }));
    const items = screen.getAllByRole('listitem');
    const [top, bottom] = items;
    if (!top || !bottom) throw new Error('rows');

    fireEvent.dragStart(top, { dataTransfer: { setData: () => undefined, effectAllowed: '' } });
    fireEvent.dragOver(bottom);
    fireEvent.drop(bottom);
    fireEvent.dragEnd(top);

    expect(session.sprite.layers.map((layer) => layer.name)).toEqual(['Layer 2', 'Layer 1']);
  });
});
