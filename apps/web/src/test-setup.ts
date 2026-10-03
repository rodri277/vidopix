import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement the modal parts of <dialog>.
if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// jsdom has no canvas: say so quietly (it returns null either way) instead of logging a warning
// every time a thumbnail tries to draw.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return null;
} as HTMLCanvasElement['getContext'];

afterEach(() => {
  cleanup();
});
