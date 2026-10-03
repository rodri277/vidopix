import type { Rect } from '../domain/rect.js';
import type { Command } from './command.js';

export const DEFAULT_HISTORY_BUDGET_BYTES = 64 * 1024 * 1024;

export interface HistoryStep {
  readonly label: string;
  readonly dirty: Rect | null;
}

/**
 * Undo/redo stacks limited by memory instead of by a fixed number of steps.
 * When the budget is exceeded the oldest undo steps are discarded; the newest one always stays.
 */
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private bytes = 0;

  constructor(private readonly budgetBytes: number = DEFAULT_HISTORY_BUDGET_BYTES) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }

  get redoLabel(): string | null {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }

  get usedBytes(): number {
    return this.bytes;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  /** Adds a command whose effect is already in the document (for example, a finished stroke). */
  record(command: Command): void {
    for (const dropped of this.redoStack) this.bytes -= dropped.sizeBytes;
    this.redoStack = [];
    this.undoStack.push(command);
    this.bytes += command.sizeBytes;

    while (this.bytes > this.budgetBytes && this.undoStack.length > 1) {
      const oldest = this.undoStack.shift();
      if (oldest) this.bytes -= oldest.sizeBytes;
    }
  }

  /** Applies a command and adds it to the history. */
  execute(command: Command): Rect | null {
    const dirty = command.apply();
    this.record(command);
    return dirty;
  }

  undo(): HistoryStep | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    const dirty = command.revert();
    this.redoStack.push(command);
    return { label: command.label, dirty };
  }

  redo(): HistoryStep | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    const dirty = command.apply();
    this.undoStack.push(command);
    return { label: command.label, dirty };
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.bytes = 0;
  }
}
