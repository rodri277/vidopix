import { packRgba } from '@vidopix/core';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { GeneratePanel } from './GeneratePanel';

describe('GeneratePanel', () => {
  it('shows harmonies of the primary color and uses a clicked color', async () => {
    const { session } = renderWithEditor(<GeneratePanel />);
    act(() => {
      session.setColor('primary', packRgba(59, 130, 246, 255));
    });

    const strip = await screen.findByRole('group', { name: 'Harmony colors' });
    expect(within(strip).getAllByRole('button')).toHaveLength(2);

    await userEvent.selectOptions(screen.getByLabelText('Harmony'), 'tetradic');
    expect(
      within(screen.getByRole('group', { name: 'Harmony colors' })).getAllByRole('button'),
    ).toHaveLength(4);

    const swatches = within(screen.getByRole('group', { name: 'Harmony colors' })).getAllByRole(
      'button',
    );
    const second = swatches[1];
    if (!second) throw new Error('swatch');
    await userEvent.click(second);
    expect(session.primaryColor).not.toBe(packRgba(59, 130, 246, 255));
  });

  it('adds generated colors to the palette', async () => {
    const { session } = renderWithEditor(<GeneratePanel />);
    act(() => {
      session.setColor('primary', packRgba(200, 60, 60, 255));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Add to palette' }));
    expect(session.document.palette.colors).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Add ramp to palette' }));
    expect(session.document.palette.colors.length).toBeGreaterThan(5);
  });

  it('builds a ramp whose length follows the Steps slider', () => {
    renderWithEditor(<GeneratePanel />);
    const ramp = screen.getByRole('group', { name: 'Shade ramp' });
    expect(within(ramp).getAllByRole('button')).toHaveLength(7);
  });

  it('reports contrast between the primary and secondary colors with pass or fail text', () => {
    const { session } = renderWithEditor(<GeneratePanel />);
    // Default: black on white.
    expect(screen.getByText('21.00:1')).toBeInTheDocument();
    expect(screen.getAllByText('Pass')).toHaveLength(4);

    act(() => {
      session.setColor('primary', packRgba(119, 119, 119, 255));
    });
    expect(screen.getByText('4.48:1')).toBeInTheDocument();
    expect(screen.getAllByText('Fail').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pass').length).toBeGreaterThan(0);
  });
});
