import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('marks only the active tool as pressed', async () => {
    const { session } = renderWithEditor(<Toolbar />);
    expect(screen.getByRole('button', { name: 'Pencil' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));

    expect(session.activeTool).toBe('eraser');
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Pencil' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('is a single Tab stop and moves between tools with the arrow keys', async () => {
    renderWithEditor(<Toolbar />);
    const pencil = screen.getByRole('button', { name: 'Pencil' });
    expect(pencil).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveAttribute('tabindex', '-1');

    pencil.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(pencil).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Move' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(pencil).toHaveFocus();
  });

  it('exposes shortcuts and an accessible name for every tool', () => {
    renderWithEditor(<Toolbar />);
    expect(screen.getByRole('button', { name: 'Fill' })).toHaveAttribute('aria-keyshortcuts', 'G');
    expect(screen.getByRole('button', { name: 'Eyedropper' })).toHaveAttribute(
      'data-tooltip',
      'Eyedropper (I)',
    );
  });

  it('selects which color is edited and swaps the colors', async () => {
    const { session, store } = renderWithEditor(<Toolbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Secondary color' }));
    expect(store.getState().editingSlot).toBe('secondary');
    expect(screen.getByRole('button', { name: 'Secondary color' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const primary = session.primaryColor;
    await userEvent.click(screen.getByRole('button', { name: 'Swap colors' }));
    expect(session.secondaryColor).toBe(primary);
  });
});
