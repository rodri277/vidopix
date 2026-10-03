import { packRgba, toHex } from '@vidopix/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { PalettePanel } from './PalettePanel';

const RED = packRgba(255, 0, 0, 255);
const GREEN = packRgba(0, 255, 0, 255);
const BLUE = packRgba(0, 0, 255, 255);

/** Edits made outside a user event need act() so React renders them before the next query. */
function addColors(
  session: { document: { addPaletteColor(color: number): boolean } },
  ...colors: number[]
): void {
  act(() => {
    for (const color of colors) session.document.addPaletteColor(color);
  });
}

const colorsOf = (session: {
  document: { palette: { colors: readonly { color: number }[] } };
}): string[] => session.document.palette.colors.map((c) => toHex(c.color));

describe('PalettePanel', () => {
  it('starts empty with guidance, and adds the current color', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    expect(screen.getByText(/palette is empty/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export palette' })).toBeDisabled();

    act(() => {
      session.setColor('primary', RED);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add current color to the palette' }));
    expect(colorsOf(session)).toEqual(['#ff0000']);
    expect(
      screen.getByRole('button', { name: /FF0000, 1 of 1, primary color/ }),
    ).toBeInTheDocument();
  });

  it('tells the user when a color is already there', async () => {
    const { session, store } = renderWithEditor(<PalettePanel />);
    addColors(session, RED);
    act(() => {
      session.setColor('primary', RED);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add current color to the palette' }));
    expect(session.document.palette.colors).toHaveLength(1);
    expect(store.getState().notice).toContain('already in the palette');
    act(() => {
      store.getState().addColorToPalette(RED);
    });
    expect(store.getState().notice).toContain('already in the palette');
  });

  it('picks the primary color with a click and the secondary with shift or right click', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    addColors(session, RED, GREEN, BLUE);

    await userEvent.click(screen.getByRole('button', { name: /00FF00, 2 of 3/ }));
    expect(session.primaryColor).toBe(GREEN);

    fireEvent.click(screen.getByRole('button', { name: /0000FF, 3 of 3/ }), { shiftKey: true });
    expect(session.secondaryColor).toBe(BLUE);

    fireEvent.contextMenu(screen.getByRole('button', { name: /FF0000, 1 of 3/ }));
    expect(session.secondaryColor).toBe(RED);
  });

  it('moves with the arrow keys, picks with Enter, reorders with Alt and removes with Delete', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    addColors(session, RED, GREEN, BLUE);
    screen.getByRole('button', { name: /FF0000, 1 of 3/ }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /00FF00, 2 of 3/ })).toHaveFocus();
    });
    await userEvent.keyboard('{Enter}');
    expect(session.primaryColor).toBe(GREEN);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(session.secondaryColor).toBe(GREEN);

    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(colorsOf(session)).toEqual(['#ff0000', '#0000ff', '#00ff00']);

    await userEvent.keyboard('{Delete}');
    expect(colorsOf(session)).toEqual(['#ff0000', '#0000ff']);
  });

  it('jumps with Home and End and by rows with Up and Down', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    addColors(session, ...Array.from({ length: 12 }, (_, i) => packRgba(i * 20, 5, 5, 255)));
    screen.getByRole('button', { name: /, 1 of 12/ }).focus();
    await userEvent.keyboard('{End}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /12 of 12/ })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /4 of 12/ })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /12 of 12/ })).toHaveFocus();
    });
    await userEvent.keyboard('{Home}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /, 1 of 12/ })).toHaveFocus();
    });
  });

  it('names a color with F2', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    addColors(session, RED);
    screen.getByRole('button', { name: /FF0000, 1 of 1/ }).focus();
    await userEvent.keyboard('{F2}');
    await userEvent.type(
      screen.getByRole('textbox', { name: /Name for #FF0000/ }),
      'Cherry{Enter}',
    );
    expect(session.document.palette.colors[0]?.name).toBe('Cherry');
    expect(await screen.findByRole('button', { name: /Cherry, #?FF0000/ })).toBeInTheDocument();
  });

  it('loads a preset, replacing or adding depending on the mode', async () => {
    const { session, store } = renderWithEditor(<PalettePanel />);
    addColors(session, RED);

    await userEvent.selectOptions(screen.getByLabelText('Load a preset palette'), 'pico-8');
    expect(session.document.palette.name).toBe('PICO-8');
    expect(session.document.palette.colors).toHaveLength(16);
    expect(colorsOf(session)).not.toContain('#ff0000');

    await userEvent.click(screen.getByRole('button', { name: 'Add to current' }));
    expect(store.getState().paletteMode).toBe('append');
    await userEvent.selectOptions(screen.getByLabelText('Load a preset palette'), 'sweetie-16');
    expect(session.document.palette.name).toBe('PICO-8');
    expect(session.document.palette.colors.length).toBeGreaterThan(16);

    session.undo();
    expect(session.document.palette.colors).toHaveLength(16);
  });

  it('renames the palette', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    await userEvent.click(screen.getByRole('button', { name: /Palette: Palette/ }));
    const input = screen.getByRole('textbox', { name: 'Palette name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Forest{Enter}');
    expect(session.document.palette.name).toBe('Forest');
  });

  it('imports a palette file and reports errors with the line', async () => {
    const { session } = renderWithEditor(<PalettePanel />);
    const input = screen.getByLabelText('Palette file');

    await userEvent.upload(
      input,
      new File(['GIMP Palette\nName: Imported\n255 0 0 Red\n0 0 255\n'], 'imported.gpl'),
    );
    await waitFor(() => {
      expect(session.document.palette.name).toBe('Imported');
    });
    expect(colorsOf(session)).toEqual(['#ff0000', '#0000ff']);

    await userEvent.upload(input, new File(['GIMP Palette\n1 2\n'], 'bad.gpl'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Line 2');

    await userEvent.upload(input, new File(['ff8800\n00ff88\n'], 'warm.hex'));
    await waitFor(() => {
      expect(session.document.palette.name).toBe('warm');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects files that are far too large', async () => {
    renderWithEditor(<PalettePanel />);
    const huge = new File([new Uint8Array(1024 * 1024 + 1)], 'huge.hex');
    await userEvent.upload(screen.getByLabelText('Palette file'), huge);
    expect(await screen.findByRole('alert')).toHaveTextContent('too large');
  });

  it('opens the extract and replace dialogs', async () => {
    const { store } = renderWithEditor(<PalettePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'Extract a palette from an image' }));
    expect(store.getState().dialog).toBe('extract-palette');
    await userEvent.click(screen.getByRole('button', { name: 'Replace a color in the drawing' }));
    expect(store.getState().dialog).toBe('replace-color');
  });
});
