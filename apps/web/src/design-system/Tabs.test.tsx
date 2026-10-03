import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'a', label: 'First', content: <p>Alpha panel</p> },
  { id: 'b', label: 'Second', content: <p>Beta panel</p> },
  { id: 'c', label: 'Third', content: <p>Gamma panel</p> },
];

describe('Tabs', () => {
  it('shows the first panel and links tabs to panels', () => {
    render(<Tabs label="Sections" tabs={tabs} />);
    const first = screen.getByRole('tab', { name: 'First' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Alpha panel');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('First');
    expect(screen.queryByText('Beta panel')).not.toBeInTheDocument();
  });

  it('is a single Tab stop and switches with the arrow keys, wrapping around', async () => {
    render(<Tabs label="Sections" tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Second' })).toHaveAttribute('tabindex', '-1');
    screen.getByRole('tab', { name: 'First' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Beta panel');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Second' })).toHaveFocus();
    });

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Gamma panel');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Third' })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Alpha panel');
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'First' })).toHaveFocus();
    });
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Gamma panel');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Alpha panel');
    await userEvent.keyboard('{x}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Alpha panel');
  });

  it('switches on click', async () => {
    render(<Tabs label="Sections" tabs={tabs} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Third' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Gamma panel');
  });
});
