import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pause,
  Play,
  Plus,
  StepBack,
  StepForward,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { compositeFrame, type EditorSession } from '@vidopix/core';
import { startPlayback } from '../../adapters/playback';
import { cx } from '../../design-system/cx';
import { Slider } from '../../design-system/Field';
import { useT } from '../../i18n/useT';
import { useEditor, useEditorState } from '../../state/editor-context';
import {
  MAX_FPS,
  MIN_FPS,
  ONION_OPACITY_RANGE,
  type EditorActions,
  type EditorStore,
} from '../../state/editor-store';
import styles from './TimelinePanel.module.css';

interface ActionProps {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly className?: string | undefined;
  readonly onClick: () => void;
}

function Action({ label, icon: Icon, disabled = false, pressed, className, onClick }: ActionProps) {
  return (
    <button
      type="button"
      className={cx(styles.action, className)}
      aria-label={label}
      title={label}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
      onClick={onClick}
    >
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

/** Runs the animation while the store says it is playing. Nothing in the document changes. */
function usePlayback(store: EditorStore): void {
  const playing = useEditorState((state) => state.playing);
  useEffect(() => {
    if (!playing) return undefined;
    return startPlayback(
      () => store.getState().frames,
      store.getState().activeFrame,
      (index) => {
        store.getState().setPlayFrame(index);
      },
    );
  }, [playing, store]);
}

interface ThumbProps {
  readonly session: EditorSession;
  readonly index: number;
  /** Changes whenever the picture may have changed. */
  readonly revision: number;
}

/** A small picture of one frame, with every visible layer flattened. */
function FrameThumb({ session, index, revision }: ThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width, height } = session.sprite;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const pixels = compositeFrame(session.sprite, index);
    context.putImageData(
      new ImageData(new Uint8ClampedArray(pixels.data.buffer), width, height),
      0,
      0,
    );
  }, [session, index, revision]);
  return <canvas ref={ref} className={styles.thumb} aria-hidden="true" />;
}

/** Writes the number typed in a field when Enter is pressed or focus leaves it. */
function commitNumber(
  input: HTMLInputElement,
  apply: (value: number) => void,
  fallback: number,
): void {
  const value = input.valueAsNumber;
  if (Number.isFinite(value)) apply(value);
  else input.value = String(fallback);
}

export function TimelinePanel() {
  const { session, store } = useEditor();
  const t = useT();
  usePlayback(store);
  const frames = useEditorState((state) => state.frames);
  const activeFrame = useEditorState((state) => state.activeFrame);
  const playing = useEditorState((state) => state.playing);
  const playFrame = useEditorState((state) => state.playFrame);
  const onionPrevious = useEditorState((state) => state.onionPrevious);
  const onionNext = useEditorState((state) => state.onionNext);
  const onionOpacity = useEditorState((state) => state.onionOpacity);
  const revision = useEditorState((state) => state.contentRevision);
  // Layers changing (visibility, opacity, order) also change the pictures.
  const layers = useEditorState((state) => state.layers);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragged = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const actions: EditorActions = store.getState();
  const setFps = (value: number): void => {
    actions.setFps(value);
  };
  const last = frames.length - 1;
  const average =
    frames.reduce((sum, frame) => sum + frame.duration, 0) / Math.max(1, frames.length);
  const fps = Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(1000 / average)));

  const focusFrame = (index: number): void => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>(`[data-frame="${String(index)}"]`)?.focus();
    });
  };

  const onFrameKeyDown = (event: KeyboardEvent, index: number): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const target = index + (event.key === 'ArrowLeft' ? -1 : 1);
      if (event.altKey) {
        actions.moveFrame(index, target);
        focusFrame(Math.min(last, Math.max(0, target)));
      } else if (target >= 0 && target <= last) {
        actions.setActiveFrame(target);
        focusFrame(target);
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const target = event.key === 'Home' ? 0 : last;
      actions.setActiveFrame(target);
      focusFrame(target);
    }
  };

  const onDrop = (event: DragEvent, target: number): void => {
    event.preventDefault();
    const from = dragged.current;
    dragged.current = null;
    setDropIndex(null);
    if (from !== null) actions.moveFrame(from, target);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.controls} role="group" aria-label={t('timeline.actions')}>
        <h2 className={styles.heading}>{t('timeline.title')}</h2>
        <div className={styles.group}>
          <Action
            label={playing ? t('timeline.pause') : t('timeline.play')}
            icon={playing ? Pause : Play}
            className={styles.play}
            onClick={() => {
              actions.togglePlayback();
            }}
          />
          <label className={styles.fps}>
            {t('timeline.fps')}
            <input
              key={fps}
              className={styles.number}
              type="number"
              min={MIN_FPS}
              max={MAX_FPS}
              defaultValue={fps}
              onBlur={(event) => {
                commitNumber(event.currentTarget, setFps, fps);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitNumber(event.currentTarget, setFps, fps);
              }}
            />
          </label>
        </div>
        <div className={styles.group}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              actions.addFrame();
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {t('timeline.new')}
          </button>
          <Action
            label={t('timeline.duplicate')}
            icon={Copy}
            onClick={() => {
              actions.duplicateFrame();
            }}
          />
          <Action
            label={t('timeline.delete')}
            icon={Trash2}
            disabled={frames.length <= 1}
            onClick={() => {
              actions.deleteFrame();
            }}
          />
          <Action
            label={t('timeline.moveLeft')}
            icon={ChevronLeft}
            disabled={activeFrame <= 0}
            onClick={() => {
              actions.moveFrame(activeFrame, activeFrame - 1);
            }}
          />
          <Action
            label={t('timeline.moveRight')}
            icon={ChevronRight}
            disabled={activeFrame >= last}
            onClick={() => {
              actions.moveFrame(activeFrame, activeFrame + 1);
            }}
          />
        </div>
        <div className={styles.onion}>
          <Action
            label={t('timeline.onionPrevious')}
            icon={StepBack}
            pressed={onionPrevious}
            onClick={() => {
              actions.toggleOnionPrevious();
            }}
          />
          <Action
            label={t('timeline.onionNext')}
            icon={StepForward}
            pressed={onionNext}
            onClick={() => {
              actions.toggleOnionNext();
            }}
          />
          <Slider
            label={t('timeline.onionOpacity')}
            value={Math.round(onionOpacity * 100)}
            min={Math.round(ONION_OPACITY_RANGE.min * 100)}
            max={Math.round(ONION_OPACITY_RANGE.max * 100)}
            step={5}
            display={`${String(Math.round(onionOpacity * 100))}%`}
            onChange={(percent) => {
              actions.setOnionOpacity(percent / 100);
            }}
          />
        </div>
      </div>

      <div className={styles.stripRow}>
        <ul ref={listRef} className={styles.strip} aria-label={t('timeline.frames')}>
          {frames.map((frame, index) => {
            const isActive = index === activeFrame;
            const number = index + 1;
            return (
              // Dragging is a mouse shortcut; the same reordering is available from the keyboard
              // (Alt+arrows) and from the move buttons, so the cell itself is not a control.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <li
                key={frame.id}
                className={styles.cell}
                data-active={isActive}
                data-playing={playing && index === playFrame}
                data-drop={dropIndex === index}
                draggable
                onDragStart={(event) => {
                  dragged.current = index;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', frame.id);
                }}
                onDragOver={(event) => {
                  if (dragged.current === null) return;
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDragLeave={() => {
                  setDropIndex((current) => (current === index ? null : current));
                }}
                onDrop={(event) => {
                  onDrop(event, index);
                }}
                onDragEnd={() => {
                  dragged.current = null;
                  setDropIndex(null);
                }}
              >
                <button
                  type="button"
                  className={styles.frame}
                  data-frame={index}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={t('timeline.frameInfo', {
                    number,
                    total: frames.length,
                    duration: frame.duration,
                  })}
                  aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    actions.setActiveFrame(index);
                  }}
                  onKeyDown={(event) => {
                    onFrameKeyDown(event, index);
                  }}
                >
                  <FrameThumb session={session} index={index} revision={revision + layers.length} />
                  <span aria-hidden="true">{number}</span>
                </button>
                <input
                  key={frame.duration}
                  className={styles.duration}
                  type="number"
                  min={20}
                  max={10000}
                  step={10}
                  defaultValue={frame.duration}
                  aria-label={t('timeline.duration', { number })}
                  onBlur={(event) => {
                    commitNumber(
                      event.currentTarget,
                      (value) => {
                        actions.setFrameDuration(index, value);
                      },
                      frame.duration,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    commitNumber(
                      event.currentTarget,
                      (value) => {
                        actions.setFrameDuration(index, value);
                      },
                      frame.duration,
                    );
                  }}
                />
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className={styles.addTile}
          onClick={() => {
            actions.addFrame();
          }}
        >
          <Plus size={20} aria-hidden="true" />
          <span>{t('timeline.addTile')}</span>
        </button>
      </div>
    </div>
  );
}
