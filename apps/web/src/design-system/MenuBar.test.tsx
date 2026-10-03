import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar, type MenuDefinition } from './MenuBar';

function setup() {
  const onNew = vi.fn();
  const onUndo = vi.fn();
  const menus: MenuDefinition[] = [
    {
      label: 'File',
      items: [
        { label: 'New', shortcut: 'Ctrl+N', onSelect: onNew },
        { label: 'Export', onSelect: vi.fn() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', onSelect: onUndo },
        { label: 'Redo', disabled: true, onSelect: vi.fn() },
      ],
    },
  ];
  render(<MenuBar label="Main" menus={menus} />);
  return { onNew, onUndo };
}

describe('MenuBar', () => {
  it('opens a menu with the keyboard and selects an item with Enter', async () => {
    const { onNew } = setup();
    screen.getByRole('menuitem', { name: 'File' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /New/ })).toHaveFocus();
    });
    await userEvent.keyboard('{Enter}');
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves through items with arrows, wrapping around', async () => {
    setup();
    await userEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    screen.getByRole('menuitem', { name: /New/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /New/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: /New/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus();
  });

  it('closes with Escape and returns focus to the menu button', async () => {
    setup();
    const file = screen.getByRole('menuitem', { name: 'File' });
    await userEvent.click(file);
    screen.getByRole('menuitem', { name: /New/ }).focus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(file).toHaveFocus();
  });

  it('skips disabled items and switches menus with the horizontal arrows', async () => {
    const { onUndo } = setup();
    await userEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    screen.getByRole('menuitem', { name: /New/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Undo' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onUndo).toHaveBeenCalled();
  });

  it('shows the shortcut next to an item and closes when clicking elsewhere', async () => {
    setup();
    await userEvent.click(screen.getByRole('menuitem', { name: 'File' }));
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
