import {
  PixelBuffer,
  compositeRegion,
  screenToDocument,
  unionRects,
  type EditorSession,
  type Preview,
  type Rect,
  type Viewport,
} from '@vidopix/core';

export interface RendererCanvases {
  /** Checkerboard and composited sprite. */
  readonly document: HTMLCanvasElement;
  /** Tool preview and the pixel cursor. */
  readonly overlay: HTMLCanvasElement;
  /** Pixel grid. */
  readonly grid: HTMLCanvasElement;
}

export interface CursorShape {
  readonly x: number;
  readonly y: number;
  /** Side of the footprint in document pixels. */
  readonly size: number;
  readonly keyboard: boolean;
}

const GRID_MIN_SCALE = 8;
const CHECKER_CELL_CSS_PX = 8;

function context2d(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context || !(context instanceof CanvasRenderingContext2D)) {
    throw new Error('Canvas 2D is not available in this browser');
  }
  return context;
}

/**
 * Draws the document with Canvas 2D. All drawing happens in device pixels with a whole-number
 * scale so art pixels stay sharp at any `devicePixelRatio`. Changes arrive as dirty rectangles and
 * are coalesced into one `requestAnimationFrame`.
 */
export class CanvasRenderer {
  private readonly documentContext: CanvasRenderingContext2D;
  private readonly overlayContext: CanvasRenderingContext2D;
  private readonly gridContext: CanvasRenderingContext2D;

  private readonly source = document.createElement('canvas');
  private sourceContext = context2d(this.source);
  private composite = PixelBuffer.create(1, 1);
  private sourceImage = new ImageData(1, 1);

  private readonly previewCanvas = document.createElement('canvas');
  private previewContext = context2d(this.previewCanvas);
  private previewImage = new ImageData(1, 1);
  private previewPixels: Uint32Array<ArrayBuffer> = new Uint32Array(1);
  private previewIndices: readonly number[] = [];
  private previewActive = false;

  private checker: CanvasPattern | null = null;
  private checkerDpr = 0;

  private viewport: Viewport = { zoom: 1, panX: 0, panY: 0 };
  private dpr = 1;
  private gridVisible = true;
  private cursor: CursorShape | null = null;

  private frame = 0;
  private pendingDocument: Rect | null = null;
  private fullDocument = true;
  private overlayDirty = true;
  private gridDirty = true;

  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly canvases: RendererCanvases,
    private readonly session: EditorSession,
  ) {
    this.documentContext = context2d(canvases.document);
    this.overlayContext = context2d(canvases.overlay);
    this.gridContext = context2d(canvases.grid);
    this.resetSource();

    this.unsubscribe.push(
      session.on('documentChanged', ({ dirty }) => {
        this.invalidateDocument(dirty);
      }),
      session.on('spriteReplaced', () => {
        this.resetSource();
        this.fullDocument = true;
        this.gridDirty = true;
        this.overlayDirty = true;
        this.schedule();
      }),
      session.on('previewChanged', ({ preview }) => {
        this.setPreview(preview);
      }),
    );
  }

  /** Scale in device pixels per document pixel (always a whole number). */
  get scale(): number {
    return Math.max(1, Math.round(this.viewport.zoom * this.dpr));
  }

  private get panX(): number {
    return Math.round(this.viewport.panX * this.dpr);
  }

  private get panY(): number {
    return Math.round(this.viewport.panY * this.dpr);
  }

  /** Converts a position in CSS pixels relative to the canvas into a document pixel. */
  toDocument(cssX: number, cssY: number): { x: number; y: number } {
    return screenToDocument(
      { zoom: this.scale, panX: this.panX, panY: this.panY },
      cssX * this.dpr,
      cssY * this.dpr,
    );
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.fullDocument = true;
    this.gridDirty = true;
    this.overlayDirty = true;
    this.schedule();
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = dpr;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    for (const canvas of [this.canvases.document, this.canvases.overlay, this.canvases.grid]) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${String(cssWidth)}px`;
      canvas.style.height = `${String(cssHeight)}px`;
    }
    this.fullDocument = true;
    this.gridDirty = true;
    this.overlayDirty = true;
    this.schedule();
  }

  setGridVisible(visible: boolean): void {
    if (this.gridVisible === visible) return;
    this.gridVisible = visible;
    this.gridDirty = true;
    this.schedule();
  }

  setCursor(cursor: CursorShape | null): void {
    this.cursor = cursor;
    this.overlayDirty = true;
    this.schedule();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }

  // ---- Internals ----

  private resetSource(): void {
    const { width, height } = this.session.sprite;
    this.composite = PixelBuffer.create(width, height);
    this.source.width = width;
    this.source.height = height;
    this.sourceContext = context2d(this.source);
    this.sourceImage = new ImageData(
      new Uint8ClampedArray(this.composite.data.buffer),
      width,
      height,
    );

    this.previewCanvas.width = width;
    this.previewCanvas.height = height;
    this.previewContext = context2d(this.previewCanvas);
    this.previewPixels = new Uint32Array(width * height);
    this.previewImage = new ImageData(
      new Uint8ClampedArray(this.previewPixels.buffer),
      width,
      height,
    );
    this.previewIndices = [];
    this.previewActive = false;

    const whole = { x: 0, y: 0, width, height };
    compositeRegion(this.session.sprite, this.composite, whole);
    this.sourceContext.putImageData(this.sourceImage, 0, 0);
  }

  private invalidateDocument(dirty: Rect): void {
    compositeRegion(this.session.sprite, this.composite, dirty);
    const x = Math.max(0, dirty.x);
    const y = Math.max(0, dirty.y);
    const width = Math.min(this.composite.width, dirty.x + dirty.width) - x;
    const height = Math.min(this.composite.height, dirty.y + dirty.height) - y;
    if (width <= 0 || height <= 0) return;
    this.sourceContext.putImageData(this.sourceImage, 0, 0, x, y, width, height);
    this.pendingDocument = unionRects(this.pendingDocument, { x, y, width, height });
    this.schedule();
  }

  private setPreview(preview: Preview | null): void {
    if (this.previewActive) {
      for (const index of this.previewIndices) this.previewPixels[index] = 0;
    }
    if (preview) {
      for (const index of preview.pixels) this.previewPixels[index] = preview.color;
      this.previewIndices = preview.pixels;
      this.previewActive = true;
    } else {
      this.previewIndices = [];
      this.previewActive = false;
    }
    this.previewContext.putImageData(this.previewImage, 0, 0);
    this.overlayDirty = true;
    this.schedule();
  }

  private schedule(): void {
    if (this.frame !== 0) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw(): void {
    if (this.canvases.document.width === 0) return;
    if (this.fullDocument) {
      this.drawDocument(null);
    } else if (this.pendingDocument) {
      this.drawDocument(this.pendingDocument);
    }
    this.fullDocument = false;
    this.pendingDocument = null;
    if (this.gridDirty) this.drawGrid();
    if (this.overlayDirty) this.drawOverlay();
    this.gridDirty = false;
    this.overlayDirty = false;
  }

  /** Document-space rectangle currently visible, clipped to the sprite. */
  private visibleRect(): Rect {
    const scale = this.scale;
    const x0 = Math.max(0, Math.floor(-this.panX / scale));
    const y0 = Math.max(0, Math.floor(-this.panY / scale));
    const x1 = Math.min(
      this.composite.width,
      Math.ceil((this.canvases.document.width - this.panX) / scale),
    );
    const y1 = Math.min(
      this.composite.height,
      Math.ceil((this.canvases.document.height - this.panY) / scale),
    );
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
  }

  private drawDocument(dirty: Rect | null): void {
    const context = this.documentContext;
    const scale = this.scale;
    const visible = this.visibleRect();

    if (dirty === null) {
      context.clearRect(0, 0, this.canvases.document.width, this.canvases.document.height);
    }
    let region = visible;
    if (dirty) {
      const x = Math.max(visible.x, dirty.x);
      const y = Math.max(visible.y, dirty.y);
      const right = Math.min(visible.x + visible.width, dirty.x + dirty.width);
      const bottom = Math.min(visible.y + visible.height, dirty.y + dirty.height);
      region = { x, y, width: right - x, height: bottom - y };
    }
    if (region.width <= 0 || region.height <= 0) return;

    const destX = this.panX + region.x * scale;
    const destY = this.panY + region.y * scale;
    const destWidth = region.width * scale;
    const destHeight = region.height * scale;

    context.save();
    context.beginPath();
    context.rect(destX, destY, destWidth, destHeight);
    context.clip();
    context.clearRect(destX, destY, destWidth, destHeight);
    context.fillStyle = this.checkerPattern(context);
    context.save();
    context.translate(this.panX, this.panY);
    context.fillRect(region.x * scale, region.y * scale, destWidth, destHeight);
    context.restore();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      this.source,
      region.x,
      region.y,
      region.width,
      region.height,
      destX,
      destY,
      destWidth,
      destHeight,
    );
    context.restore();
  }

  private checkerPattern(context: CanvasRenderingContext2D): CanvasPattern {
    if (this.checker && this.checkerDpr === this.dpr) return this.checker;
    const cell = Math.max(1, Math.round(CHECKER_CELL_CSS_PX * this.dpr));
    const tile = document.createElement('canvas');
    tile.width = cell * 2;
    tile.height = cell * 2;
    const tileContext = context2d(tile);
    tileContext.fillStyle = '#2d3139';
    tileContext.fillRect(0, 0, cell * 2, cell * 2);
    tileContext.fillStyle = '#383d47';
    tileContext.fillRect(0, 0, cell, cell);
    tileContext.fillRect(cell, cell, cell, cell);
    const pattern = context.createPattern(tile, 'repeat');
    if (!pattern) throw new Error('Could not create the transparency pattern');
    this.checker = pattern;
    this.checkerDpr = this.dpr;
    return pattern;
  }

  private drawGrid(): void {
    const context = this.gridContext;
    const { width, height } = this.canvases.grid;
    context.clearRect(0, 0, width, height);
    const scale = this.scale;
    const sprite = this.session.sprite;

    // Sprite border, always visible.
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 1;
    context.strokeRect(
      this.panX - 0.5,
      this.panY - 0.5,
      sprite.width * scale + 1,
      sprite.height * scale + 1,
    );

    if (!this.gridVisible || scale < GRID_MIN_SCALE) return;
    const visible = this.visibleRect();
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.beginPath();
    for (let x = visible.x; x <= visible.x + visible.width; x++) {
      const screenX = this.panX + x * scale + 0.5;
      context.moveTo(screenX, this.panY + visible.y * scale);
      context.lineTo(screenX, this.panY + (visible.y + visible.height) * scale);
    }
    for (let y = visible.y; y <= visible.y + visible.height; y++) {
      const screenY = this.panY + y * scale + 0.5;
      context.moveTo(this.panX + visible.x * scale, screenY);
      context.lineTo(this.panX + (visible.x + visible.width) * scale, screenY);
    }
    context.stroke();
  }

  private drawOverlay(): void {
    const context = this.overlayContext;
    const { width, height } = this.canvases.overlay;
    context.clearRect(0, 0, width, height);
    const scale = this.scale;

    if (this.previewActive) {
      context.imageSmoothingEnabled = false;
      const visible = this.visibleRect();
      if (visible.width > 0 && visible.height > 0) {
        context.drawImage(
          this.previewCanvas,
          visible.x,
          visible.y,
          visible.width,
          visible.height,
          this.panX + visible.x * scale,
          this.panY + visible.y * scale,
          visible.width * scale,
          visible.height * scale,
        );
      }
    }

    const cursor = this.cursor;
    if (cursor) {
      const offset = Math.floor((cursor.size - 1) / 2);
      const x = this.panX + (cursor.x - offset) * scale;
      const y = this.panY + (cursor.y - offset) * scale;
      const side = cursor.size * scale;
      context.lineWidth = cursor.keyboard ? 2 : 1;
      context.strokeStyle = cursor.keyboard ? '#7c5cff' : 'rgba(255, 255, 255, 0.9)';
      context.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1);
      if (!cursor.keyboard) {
        context.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        context.strokeRect(x - 0.5, y - 0.5, side + 1, side + 1);
      }
    }
  }
}
