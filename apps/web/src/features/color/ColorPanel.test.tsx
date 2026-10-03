import { packRgba, toHex } from '@vidopix/core';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { ColorPanel } from './ColorPanel';

describe('ColorPanel', () => {
  it('shows the primary color as hex and sets a new one from the hex field', async () => {
    const { session } = renderWithEditor(<ColorPanel />);
    const hex = screen.getByLabelText('Hex');
    expect(hex).toHaveValue('#000000');

    await userEvent.clear(hex);
    await userEvent.type(hex, '#ff0080{Enter}');

    expect(toHex(session.primaryColor)).toBe('#ff0080');
  });

  it('accepts shorthand and uppercase hex', async () => {
    const { session } = renderWithEditor(<ColorPanel />);
    const hex = screen.getByLabelText('Hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, 'F80{Enter}');
    expect(toHex(session.primaryColor)).toBe('#ff8800');
  });

  it('reports invalid hex and keeps the current color', async () => {
    const { session } = renderWithEditor(<ColorPanel />);
    const hex = screen.getByLabelText('Hex');
    await userEvent.clear(hex);
    await userEvent.type(hex, 'zzz{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('3, 6 or 8 hex digits');
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(session.primaryColor).toBe(packRgba(0, 0, 0, 255));
  });

  it('follows color changes made elsewhere, such as the eyedropper', () => {
    const { session } = renderWithEditor(<ColorPanel />);
    session.setColor('primary', packRgba(0, 255, 0, 255));
    return screen.findByDisplayValue('#00FF00');
  });

  it('edits the secondary color after its swatch slot is selected', async () => {
    const { session, store } = renderWithEditor(<ColorPanel />);
    store.getState().setEditingSlot('secondary');
    const hex = await screen.findByDisplayValue('#FFFFFF');
    await userEvent.clear(hex);
    await userEvent.type(hex, '#112233{Enter}');
    expect(toHex(session.secondaryColor)).toBe('#112233');
    expect(toHex(session.primaryColor)).toBe('#000000');
  });

  it('changes lightness with the L slider without losing the hue of a saturated color', async () => {
    const { session } = renderWithEditor(<ColorPanel />);
    session.setColor('primary', packRgba(255, 0, 0, 255));
    const hue = await screen.findByLabelText<HTMLInputElement>('H');
    const before = hue.value;

    // jsdom does not turn arrow keys into slider changes, so change the value directly.
    fireEvent.change(screen.getByLabelText('L'), { target: { value: '0.4' } });

    expect(screen.getByLabelText<HTMLInputElement>('H').value).toBe(before);
    expect(session.primaryColor).not.toBe(packRgba(255, 0, 0, 255));
  });

  it('changes opacity with the A slider', () => {
    const { session } = renderWithEditor(<ColorPanel />);
    fireEvent.change(screen.getByLabelText('A'), { target: { value: '128' } });
    expect(session.primaryColor >>> 24).toBe(128);
  });
});
