import type { DocumentState } from '../document/document-state.js';
import { setActiveFrame } from '../document/frame-ops.js';
import { unionRects, type Rect } from '../domain/rect.js';
import type { Command } from './command.js';

/** The document state the commands below write to when they run. */
export interface DocumentHolder {
  state: DocumentState;
}

const BASE_COMMAND_BYTES = 128;

/**
 * A change to layers or selection, undone by swapping the whole state back. Layer pixel buffers
 * are shared between states, so the only real memory cost is buffers that exist in one state but
 * not the other (a deleted or newly created layer); `retainedBytes` accounts for those.
 */
export class StateCommand implements Command {
  readonly sizeBytes: number;

  constructor(
    readonly label: string,
    private readonly holder: DocumentHolder,
    private readonly before: DocumentState,
    private readonly after: DocumentState,
    private readonly affectsPixels: boolean,
    retainedBytes = 0,
  ) {
    this.sizeBytes = BASE_COMMAND_BYTES + retainedBytes;
  }

  apply(): Rect | null {
    this.holder.state = this.after;
    return this.dirty(this.after);
  }

  revert(): Rect | null {
    this.holder.state = this.before;
    return this.dirty(this.before);
  }

  private dirty(state: DocumentState): Rect | null {
    return this.affectsPixels
      ? { x: 0, y: 0, width: state.sprite.width, height: state.sprite.height }
      : null;
  }
}

/** Several commands that undo and redo together as one step. */
export class CompoundCommand implements Command {
  readonly sizeBytes: number;

  constructor(
    readonly label: string,
    private readonly commands: readonly Command[],
  ) {
    this.sizeBytes = commands.reduce((total, command) => total + command.sizeBytes, 0);
  }

  apply(): Rect | null {
    let dirty: Rect | null = null;
    for (const command of this.commands) dirty = unionRects(dirty, command.apply());
    return dirty;
  }

  revert(): Rect | null {
    let dirty: Rect | null = null;
    for (const command of [...this.commands].reverse()) dirty = unionRects(dirty, command.revert());
    return dirty;
  }
}

/**
 * Runs a command on the frame it was made in: undoing a stroke drawn on frame 3 first goes back to
 * frame 3, so the change is visible. Frames are found by id because they can be reordered.
 */
export class FrameScopedCommand implements Command {
  readonly label: string;
  readonly sizeBytes: number;

  constructor(
    private readonly inner: Command,
    private readonly holder: DocumentHolder,
    private readonly frameId: string | undefined,
  ) {
    this.label = inner.label;
    this.sizeBytes = inner.sizeBytes;
  }

  apply(): Rect | null {
    const switched = this.enter();
    const dirty = this.inner.apply();
    return switched ? this.whole() : dirty;
  }

  revert(): Rect | null {
    const switched = this.enter();
    const dirty = this.inner.revert();
    return switched ? this.whole() : dirty;
  }

  private enter(): boolean {
    const { frames } = this.holder.state.sprite;
    const index = frames.findIndex((frame) => frame.id === this.frameId);
    if (index < 0 || index === this.holder.state.activeFrame) return false;
    this.holder.state = setActiveFrame(this.holder.state, index);
    return true;
  }

  private whole(): Rect {
    const { width, height } = this.holder.state.sprite;
    return { x: 0, y: 0, width, height };
  }
}
