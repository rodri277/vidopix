import type { DocumentState } from '../document/document-state.js';
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
