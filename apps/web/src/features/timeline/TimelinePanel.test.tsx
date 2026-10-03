import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithEditor } from '../../test-utils';
import { TimelinePanel } from './TimelinePanel';

const frameList = () => screen.getByRole('list', { name: 'Frames' });
const frameButtons = () => within(frameList()).getAllByRole('button', { name: /^Frame \d+ of/ });
const frameButton = (index: number): HTMLElement => {
  const button = frameButtons()[index];
  if (!button) throw new Error(`No frame ${String(index + 1)}`);
  return button;
};
const durations = (): string[] =>
  within(frameList())
    .getAllByRole('spinbutton')
    .map((input) => (input as HTMLInputElement).value);

describe('TimelinePanel', () => {
  it('starts with one frame of 100 ms and the first frame selected', () => {
    renderWithEditor(<TimelinePanel />);
    expect(frameButtons()).toHaveLength(1);
    expect(frameButtons()[0]).toHaveAttribute('aria-current', 'true');
    expect(durations()).toEqual(['100']);
    expect(screen.getByLabelText('FPS')).toHaveValue(10);
  });

  it('adds, duplicates and deletes frames', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    expect(screen.getByRole('button', { name: 'Delete frame' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate frame' }));
    expect(frameButtons()).toHaveLength(3);
    expect(session.sprite.frames).toHaveLength(3);
    expect(frameButtons()[2]).toHaveAttribute('aria-current', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Delete frame' }));
    expect(frameButtons()).toHaveLength(2);
  });

  it('describes each frame for screen readers', async () => {
    renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    expect(screen.getByRole('button', { name: 'Frame 2 of 2, 100 ms' })).toBeInTheDocument();
  });

  it('switches frames on click and moves between them with the arrow keys', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    await userEvent.click(frameButton(0));
    expect(session.document.activeFrame).toBe(0);
    expect(frameButtons()[0]).toHaveAttribute('tabindex', '0');
    expect(frameButtons()[1]).toHaveAttribute('tabindex', '-1');

    // Focus follows the selection on the next animation frame.
    const focused = async (index: number): Promise<void> => {
      await waitFor(() => {
        expect(frameButtons()[index]).toHaveFocus();
      });
    };
    frameButtons()[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(session.document.activeFrame).toBe(1);
    await focused(1);
    await userEvent.keyboard('{End}');
    expect(session.document.activeFrame).toBe(2);
    await focused(2);
    await userEvent.keyboard('{ArrowRight}');
    expect(session.document.activeFrame).toBe(2);
    await userEvent.keyboard('{Home}');
    expect(session.document.activeFrame).toBe(0);
    await focused(0);
    await userEvent.keyboard('{ArrowLeft}');
    expect(session.document.activeFrame).toBe(0);
  });

  it('reorders the frame with Alt+arrows and with the move buttons', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    const ids = session.sprite.frames.map((frame) => frame.id);
    expect(screen.getByRole('button', { name: 'Move frame later' })).toBeDisabled();

    frameButtons()[2]?.focus();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(session.sprite.frames.map((f) => f.id)).toEqual([ids[0], ids[2], ids[1]]);

    await userEvent.click(screen.getByRole('button', { name: 'Move frame earlier' }));
    expect(session.sprite.frames.map((f) => f.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(session.document.activeFrame).toBe(0);
    expect(screen.getByRole('button', { name: 'Move frame earlier' })).toBeDisabled();
  });

  it('changes the duration of one frame, rounded and kept in range', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    const field = screen.getByLabelText('Duration of frame 2 (ms)');
    await userEvent.clear(field);
    await userEvent.type(field, '347{Enter}');
    expect(session.sprite.frames.map((f) => f.duration)).toEqual([100, 350]);
    expect(screen.getByLabelText('Duration of frame 2 (ms)')).toHaveValue(350);

    const first = screen.getByLabelText('Duration of frame 1 (ms)');
    await userEvent.clear(first);
    await userEvent.type(first, '1{Enter}');
    expect(session.sprite.frames[0]?.duration).toBe(20);
  });

  it('puts back the old duration when the field is left empty', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    const field = screen.getByLabelText('Duration of frame 1 (ms)');
    await userEvent.clear(field);
    await userEvent.tab();
    expect(session.sprite.frames[0]?.duration).toBe(100);
    expect(screen.getByLabelText('Duration of frame 1 (ms)')).toHaveValue(100);
  });

  it('sets every duration from the frames per second field', async () => {
    const { session } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    const fps = screen.getByLabelText('FPS');
    await userEvent.clear(fps);
    await userEvent.type(fps, '20{Enter}');
    expect(session.sprite.frames.map((f) => f.duration)).toEqual([50, 50]);
    expect(screen.getByLabelText('FPS')).toHaveValue(20);
    expect(durations()).toEqual(['50', '50']);

    fireEvent.change(screen.getByLabelText('FPS'), { target: { value: '1000' } });
    fireEvent.blur(screen.getByLabelText('FPS'));
    expect(session.sprite.frames.map((f) => f.duration)).toEqual([20, 20]);
  });

  it('plays and pauses without changing the document', async () => {
    const { session, store } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    const before = session.sprite;
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(store.getState().playing).toBe(true);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    act(() => {
      store.getState().setPlayFrame(0);
    });
    expect(frameList().querySelector('[data-playing="true"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(store.getState().playing).toBe(false);
    expect(session.sprite).toBe(before);
  });

  it('stops playing when a frame is chosen', async () => {
    const { store } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    await userEvent.click(frameButton(0));
    expect(store.getState().playing).toBe(false);
  });

  it('turns the onion skins on and off and sets their opacity', async () => {
    const { store } = renderWithEditor(<TimelinePanel />);
    const previous = screen.getByRole('button', { name: 'Show the previous frame' });
    const next = screen.getByRole('button', { name: 'Show the next frame' });
    expect(previous).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(previous);
    await userEvent.click(next);
    expect(store.getState()).toMatchObject({ onionPrevious: true, onionNext: true });
    expect(previous).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('Onion skin'), { target: { value: '60' } });
    expect(store.getState().onionOpacity).toBe(0.6);
    fireEvent.change(screen.getByLabelText('Onion skin'), { target: { value: '5' } });
    expect(store.getState().onionOpacity).toBe(0.1);
    await userEvent.click(previous);
    expect(store.getState().onionPrevious).toBe(false);
  });

  it('announces the frame when it changes', async () => {
    const { store } = renderWithEditor(<TimelinePanel />);
    await userEvent.click(screen.getByRole('button', { name: 'New frame' }));
    expect(store.getState().announcement).toBe('Frame 2 of 2, 100 ms');
  });

  it('says why the only frame cannot be deleted', () => {
    const { session, store } = renderWithEditor(<TimelinePanel />);
    session.document.deleteFrame();
    expect(store.getState().notice).toBe('An animation needs at least one frame');
  });
});
