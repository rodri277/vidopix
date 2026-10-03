export { packRgba, parseHex, toHex, unpackRgba } from './domain/color.js';
export type { Color, ColorParseError, Rgba } from './domain/color.js';
export { err, ok } from './result.js';
export type { Result } from './result.js';
export { MAX_CANVAS_SIZE, PixelBuffer } from './domain/pixel-buffer.js';
export { createSprite } from './domain/sprite.js';
export type { BlendMode, InvalidSizeError, Layer, Sprite, SpriteOptions } from './domain/sprite.js';
export { createSequentialIdGenerator } from './ports/id-generator.js';
export type { IdGenerator } from './ports/id-generator.js';
export { traceLine } from './algorithms/line.js';
export type { PlotFn } from './algorithms/line.js';
export { traceEllipse, traceRect } from './algorithms/shapes.js';
export { colorsWithinTolerance, floodFillSpans } from './algorithms/flood-fill.js';
export type { FillMode, FillOptions, SpanFn } from './algorithms/flood-fill.js';
export { unionRects } from './domain/rect.js';
export type { Rect } from './domain/rect.js';
export { PixelPatchCommand } from './history/command.js';
export type { Command } from './history/command.js';
export { DEFAULT_HISTORY_BUDGET_BYTES, HistoryManager } from './history/history-manager.js';
export type { HistoryStep } from './history/history-manager.js';
export { PatchRecorder } from './history/patch-recorder.js';
export { applyPatch, createPatch, patchSizeBytes, revertPatch } from './history/pixel-patch.js';
export type { PixelPatch, RectPatch, SparsePatch } from './history/pixel-patch.js';
export { EditorSession } from './session/editor-session.js';
export type { HistoryCause, SessionConfig, SessionEvents } from './session/editor-session.js';
export { DEFAULT_TOOL_OPTIONS, MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, TOOL_IDS } from './tools/tool.js';
export type { ColorSlot, PointerInput, Preview, ToolId, ToolOptions } from './tools/tool.js';
export { colorToOklch, linearToSrgb, oklchToColor, srgbToLinear } from './domain/oklch.js';
export type { Oklch } from './domain/oklch.js';
export {
  MAX_EXPORT_DIMENSION,
  MAX_EXPORT_SCALE,
  MIN_EXPORT_SCALE,
  exportSprite,
} from './io/export.js';
export type { ExportError, ExportImage, ExportOptions } from './io/export.js';
export {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_LEVELS,
  centerViewport,
  clampZoom,
  fitViewport,
  nextZoom,
  screenToDocument,
  zoomAt,
} from './viewport/viewport.js';
export type { Viewport } from './viewport/viewport.js';
export {
  blendPixel,
  compositePixel,
  compositeRegion,
  compositeSprite,
} from './domain/compositing.js';
export { intersectRects, rectContains, rectFromCorners, rectsEqual } from './domain/rect.js';
export { DocumentEditor } from './document/document-editor.js';
export type { BlockReason, DocumentEvents, Floating } from './document/document-editor.js';
export { MAX_LAYERS } from './document/layer-ops.js';
export { scaleAlpha } from './domain/compositing.js';
export {
  MAX_PALETTE_COLORS,
  MAX_PALETTE_NAME_LENGTH,
  createPalette,
  indexOfColor,
  opaque,
  paletteColor,
} from './domain/palette.js';
export type { Palette, PaletteColor } from './domain/palette.js';
export {
  HARMONY_KINDS,
  contrastRatio,
  harmony,
  relativeLuminance,
  shadeRamp,
  wcagLevels,
} from './domain/color-theory.js';
export type { HarmonyKind, RampOptions, WcagLevels } from './domain/color-theory.js';
export {
  MAX_EXTRACT_COLORS,
  MIN_EXTRACT_COLORS,
  fitWithin,
  medianCut,
} from './algorithms/median-cut.js';
export type { ProgressFn } from './algorithms/median-cut.js';
// Palette file formats live in '@vidopix/core/palette-formats' so the app can load them (and the
// JSON validator they bring along) on demand instead of in the first download.
export { PALETTE_PRESETS, presetToColors } from './data/palette-presets.js';
export type { PalettePreset } from './data/palette-presets.js';
