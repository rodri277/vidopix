import type { MessageKey } from './index';

/**
 * Names the engine gives to undoable steps ("Pencil", "Add layer", ...), in English, mapped to the
 * texts of the interface. A label that is not listed is shown as it comes.
 */
export const HISTORY_LABEL_KEYS: Readonly<Record<string, MessageKey>> = {
  Pencil: 'tool.pencil',
  Eraser: 'tool.eraser',
  Fill: 'tool.fill',
  Line: 'tool.line',
  Rectangle: 'tool.rectangle',
  Ellipse: 'tool.ellipse',
  Move: 'tool.move',
  Paste: 'edit.paste',
  Delete: 'edit.delete',
  Select: 'tool.select',
  Deselect: 'edit.deselect',
  'Add layer': 'layer.new',
  'Duplicate layer': 'layer.duplicate',
  'Delete layer': 'layer.delete',
  'Merge down': 'layer.mergeDown',
  'Flatten image': 'layer.flatten',
  'Rename layer': 'step.renameLayer',
  'Reorder layers': 'step.reorderLayers',
  'Show layer': 'step.showLayer',
  'Hide layer': 'step.hideLayer',
  'Lock layer': 'step.lockLayer',
  'Unlock layer': 'step.unlockLayer',
  'Layer opacity': 'step.layerOpacity',
  'Add color': 'step.addColor',
  'Add colors to palette': 'step.addColors',
  'Remove color': 'step.removeColor',
  'Reorder palette': 'step.reorderPalette',
  'Rename color': 'step.renameColor',
  'Edit palette color': 'step.editColor',
  'Rename palette': 'step.renamePalette',
  'Load palette': 'step.loadPalette',
  'Replace color': 'replace.title',
  'Rename sprite': 'step.renameSprite',
};
