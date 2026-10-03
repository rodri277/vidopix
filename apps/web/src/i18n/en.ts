/**
 * English texts, the reference catalog. Every key must also exist in `es.ts`; the type of that
 * file makes a missing translation a compile error. `{name}` marks a value filled in at run time.
 */
export const en = {
  // File menu and projects
  'menu.file': 'File',
  'file.new': 'New sprite…',
  'file.open': 'Open file…',
  'file.recent': 'Open recent…',
  'file.save': 'Save as .vidopix…',
  'file.exportPng': 'Export PNG…',
  'file.share': 'Share link…',

  // Save state
  'save.saved': 'Saved',
  'save.saving': 'Saving…',
  'save.unsaved': 'Unsaved changes',
  'save.error': 'Could not save',
  'save.tooLarge': 'Too large to save (20 MB limit)',

  // Sprite name
  'sprite.rename': 'Sprite name: {name}. Activate to rename',
  'sprite.nameLabel': 'Sprite name',

  // Recent projects
  'recent.title': 'Recent projects',
  'recent.empty': 'Projects you work on are saved in this browser and listed here.',
  'recent.open': 'Open',
  'recent.delete': 'Delete',
  'recent.close': 'Close',
  'recent.details': '{width}×{height} px, {layers} layers',
  'recent.deleted': 'Project deleted',
  'recent.openFailed': 'That project could not be opened',

  // Opening files
  'open.failed': 'Could not open the file: {reason}',
  'open.tooLarge': 'That file is too large (limit 20 MB)',

  // Sharing
  'share.title': 'Share link',
  'share.intro':
    'Anyone with this link sees a copy of your sprite. Nothing is uploaded: the sprite is inside the link.',
  'share.linkLabel': 'Link',
  'share.copy': 'Copy link',
  'share.copied': 'Link copied',
  'share.copyFailed': 'Select the link and copy it by hand',
  'share.size': '{characters} characters',
  'share.tooLong':
    'This sprite is too big for a link ({characters} characters, limit {limit}). Save it as a .vidopix file instead.',
  'share.preparing': 'Preparing the link…',
  'share.close': 'Close',
  'share.openFailed': 'The link could not be opened: {reason}',
  'share.unsupported': 'This browser cannot create links',

  // Menus
  'menu.main': 'Main menu',
  'menu.edit': 'Edit',
  'menu.layer': 'Layer',
  'menu.view': 'View',
  'menu.help': 'Help',

  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.cut': 'Cut',
  'edit.copy': 'Copy',
  'edit.paste': 'Paste',
  'edit.delete': 'Delete',
  'edit.selectAll': 'Select all',
  'edit.deselect': 'Deselect',
  'edit.swapColors': 'Swap colors',

  'layer.new': 'New layer',
  'layer.duplicate': 'Duplicate layer',
  'layer.delete': 'Delete layer',
  'layer.mergeDown': 'Merge down',
  'layer.flatten': 'Flatten image',
  'layer.moveUp': 'Move layer up',
  'layer.moveDown': 'Move layer down',

  'view.zoomIn': 'Zoom in',
  'view.zoomOut': 'Zoom out',
  'view.fit': 'Fit to screen',
  'view.actualSize': 'Actual size (100%)',
  'view.showGrid': 'Show grid',
  'view.hideGrid': 'Hide grid',
  'view.showPanels': 'Show panels',
  'view.hidePanels': 'Hide panels',

  'help.shortcuts': 'Keyboard shortcuts',
  'help.language': 'Language',
  'help.languageName': '{language}',

  // Tools
  'tool.pencil': 'Pencil',
  'tool.eraser': 'Eraser',
  'tool.fill': 'Fill',
  'tool.eyedropper': 'Eyedropper',
  'tool.line': 'Line',
  'tool.rectangle': 'Rectangle',
  'tool.ellipse': 'Ellipse',
  'tool.select': 'Select',
  'tool.move': 'Move',

  // Status bar
  'status.selection': 'Selection {width}×{height}',
  'status.size': '{width}×{height} px',
  'status.byline': 'by vidotho',
  'status.updateReady': 'Update available',
  'status.reloadToUpdate': 'Reload to update',

  // Shortcuts help
  'shortcuts.title': 'Keyboard shortcuts',
  'shortcuts.intro': 'Ctrl is Cmd on a Mac.',
  'shortcuts.close': 'Close',
  'shortcuts.group.tools': 'Tools',
  'shortcuts.group.editing': 'Editing',
  'shortcuts.group.view': 'View',
  'shortcuts.group.layers': 'Layers',
  'shortcuts.group.file': 'File',
  'shortcuts.group.canvas': 'On the canvas',
  'shortcuts.brushSmaller': 'Smaller brush',
  'shortcuts.brushBigger': 'Bigger brush',
  'shortcuts.altEyedropper': 'Eyedropper while held',
  'shortcuts.pan': 'Pan the canvas',
  'shortcuts.zoomWheel': 'Zoom around the pointer',
  'shortcuts.moveCursor': 'Move the pixel cursor',
  'shortcuts.moveCursorFar': 'Move the pixel cursor 8 pixels',
  'shortcuts.drawKeyboard': 'Draw with the keyboard (hold)',
  'shortcuts.drop': 'Drop moved or pasted pixels',
  'shortcuts.cancel': 'Cancel the stroke or the move',
  'shortcuts.secondary': 'Secondary color: right click or Shift+click on a swatch',
  'shortcuts.help': 'Show this list',
  'shortcuts.nudge': 'Nudge the selection (Move tool)',

  // Tool options
  'options.size': 'Size',
  'options.sizeValue': '{size} px',
  'options.fillMode': 'Fill mode',
  'options.contiguous': 'Contiguous',
  'options.global': 'Global',
  'options.tolerance': 'Tolerance',
  'options.shapeStyle': 'Shape style',
  'options.outline': 'Outline',
  'options.filled': 'Filled',
  'options.shiftSquare': 'Hold Shift for a perfect square',
  'options.shiftCircle': 'Hold Shift for a perfect circle',
  'options.shiftLine': 'Hold Shift for 0, 45 or 90 degrees',
  'options.hintEyedropper':
    'Click a pixel to pick its color. Right click picks the secondary color.',
  'options.hintSelect':
    'Drag to select a rectangle, Shift for a square. Click to deselect. Drawing stays inside the selection.',
  'options.hintMove':
    'Drag the selection to move its pixels (the whole layer if nothing is selected). Enter drops them, Esc cancels.',
  'options.aids': 'Drawing aids',
  'options.mirrorX': 'Mirror left-right',
  'options.mirrorY': 'Mirror top-bottom',
  'options.dither': 'Dither',
  'options.ditherValue': '{percent}%',
  'options.pixelPerfect': 'Pixel-perfect',
  'options.pressure': 'Pen pressure',

  // Toolbar
  'toolbar.tools': 'Tools',
  'toolbar.toolbox': 'Toolbox',
  'toolbar.primary': 'Primary color',
  'toolbar.secondary': 'Secondary color',
  'toolbar.swap': 'Swap colors',
  'toolbar.swapTip': 'Swap colors (X)',

  'layout.options': 'Tool options',
  'layout.side': 'Layers and color',

  // Layers panel
  'layers.title': 'Layers',
  'layers.actions': 'Layer actions',
  'layers.list': 'Layer list',
  'layers.hide': 'Hide {name}',
  'layers.show': 'Show {name}',
  'layers.lock': 'Lock {name}',
  'layers.unlock': 'Unlock {name}',
  'layers.locked': 'locked',
  'layers.hidden': 'hidden',
  'layers.rename': 'Rename {name}',
  'layers.opacity': 'Opacity',

  // Color panel
  'color.hex': 'Hex',
  'color.hexError': 'Use 3, 6 or 8 hex digits, for example #7C5CFF.',

  // Palette panel
  'palette.rename': 'Palette: {name}. Activate to rename',
  'palette.nameLabel': 'Palette name',
  'palette.loadPreset': 'Load a preset palette',
  'palette.presetPlaceholder': 'Load preset…',
  'palette.import': 'Import palette file',
  'palette.importTip': 'Import palette file (.gpl, .hex, .json)',
  'palette.fileLabel': 'Palette file',
  'palette.loadingGroup': 'Loading a palette',
  'palette.whenLoading': 'When loading:',
  'palette.replace': 'Replace',
  'palette.append': 'Add to current',
  'palette.tooLarge': 'That file is too large to be a palette (limit 1 MB)',
  'palette.lineError': 'Line {line}: {message}',
  'palette.addCurrent': 'Add current color to the palette',
  'palette.addCurrentTip': 'Add current color',
  'palette.extract': 'Extract a palette from an image',
  'palette.extractTip': 'Extract palette from an image…',
  'palette.replaceColor': 'Replace a color in the drawing',
  'palette.replaceColorTip': 'Replace a color in the drawing…',
  'palette.exportFormat': 'Export format',
  'palette.export': 'Export palette',
  'palette.format.gpl': 'GIMP (.gpl)',
  'palette.format.hex': 'Hex list (.hex)',
  'palette.format.json': 'JSON (.json)',
  'palette.empty':
    'The palette is empty. Add the current color, load a preset or extract colors from an image.',
  'palette.colors': 'Palette colors',
  'palette.swatch': '{name}{hex}, {index} of {total}{status}',
  'palette.statusPrimary': 'primary color',
  'palette.statusSecondary': 'secondary color',
  'palette.nameFor': 'Name for {hex}',
  'palette.colorNamePlaceholder': 'Color name',
  'palette.hint':
    'Click: primary. Shift+click or right click: secondary. Arrows move, Alt+arrows reorder, F2 renames, Delete removes.',
  'palette.count': '{count} / 256',

  // Tabs
  'tabs.label': 'Color tools',
  'tabs.color': 'Color',
  'tabs.palette': 'Palette',
  'tabs.generate': 'Generate',

  // Generate panel
  'generate.harmonyTitle': 'Harmonies of the primary color',
  'generate.harmony': 'Harmony',
  'generate.harmonyColors': 'Harmony colors',
  'generate.addToPalette': 'Add to palette',
  'generate.analogous': 'Analogous',
  'generate.complementary': 'Complementary',
  'generate.triadic': 'Triadic',
  'generate.tetradic': 'Tetradic',
  'generate.monochromatic': 'Monochromatic',
  'generate.rampTitle': 'Shade ramp with hue shifting',
  'generate.steps': 'Steps',
  'generate.hueShift': 'Hue shift',
  'generate.rampColors': 'Shade ramp',
  'generate.addRamp': 'Add ramp to palette',
  'generate.rampHint':
    'Shadows drift toward blue-purple and highlights toward yellow. Click a color to use it.',
  'generate.contrastTitle': 'Contrast: primary on secondary',
  'generate.contrastLabel': 'Contrast ratio {ratio} to 1',
  'generate.levelAaNormal': 'AA, normal text (4.5:1)',
  'generate.levelAaLarge': 'AA, large text (3:1)',
  'generate.levelAaaNormal': 'AAA, normal text (7:1)',
  'generate.levelAaaLarge': 'AAA, large text (4.5:1)',
  'generate.pass': 'Pass',
  'generate.fail': 'Fail',
  'generate.swatchLabel': '{hex}, {index} of {total}',

  // Common
  'common.cancel': 'Cancel',
  'common.close': 'Close',

  // New sprite dialog
  'newSprite.title': 'New sprite',
  'newSprite.presets': 'Size presets',
  'newSprite.width': 'Width (px)',
  'newSprite.height': 'Height (px)',
  'newSprite.name': 'Name (optional)',
  'newSprite.namePlaceholder': 'Untitled',
  'newSprite.create': 'Create',
  'newSprite.error': 'Width and height must be whole numbers from 1 to {max}.',
  'newSprite.hint': 'The sprite you are working on stays in Open recent.',

  // Export dialog
  'export.title': 'Export PNG',
  'export.scale': 'Scale',
  'export.transparent': 'Transparent background',
  'export.size': 'Output size: {width}×{height} px',
  'export.export': 'Export',
  'export.tooLarge':
    'That would be {width}×{height} px. Browsers cannot go above {max} px per side. Choose a smaller scale.',
  'export.invalidScale': 'Choose a whole-number scale.',
  'export.failed': 'The browser could not create the PNG. Try a smaller scale.',

  // Extract palette dialog
  'extract.title': 'Extract palette from an image',
  'extract.image': 'Image',
  'extract.colors': 'Colors',
  'extract.reading': 'Reading the image…',
  'extract.choosing': 'Choosing colors…',
  'extract.stays': 'The editor stays usable.',
  'extract.found': '{count} extracted colors',
  'extract.noPixels': 'That image has no opaque pixels to take colors from.',
  'extract.canceled': 'Extraction canceled.',
  'extract.cancel': 'Cancel extraction',
  'extract.extract': 'Extract',
  'extract.use': 'Use as palette',
  'extract.add': 'Add to palette',
  'extract.hint': 'The image is reduced to at most 256×256 first, so even a large photo is quick.',
  'extract.readFailed': 'The image could not be read.',

  // Replace color dialog
  'replace.title': 'Replace color',
  'replace.from': 'Replace',
  'replace.with': 'With',
  'replace.primaryOption': 'Primary color ({hex})',
  'replace.secondaryOption': 'Secondary color ({hex})',
  'replace.hint':
    'Matches the exact color on every layer, hidden ones included; locked layers are skipped.',
  'replace.selectionOnly': 'Only the selected area changes.',
  'replace.oneUndo': 'One undo step.',
  'replace.button': 'Replace',

  // Messages
  'blocked.layer-locked': 'The active layer is locked',
  'blocked.layer-hidden': 'The active layer is hidden',
  'blocked.nothing-selected': 'Nothing is selected',
  'blocked.single-layer': 'A sprite needs at least one layer',
  'blocked.color-in-palette': 'That color is already in the palette',
  'blocked.palette-full': 'The palette is full (256 colors)',
  'notice.replacedOne': 'Replaced 1 pixel',
  'notice.replacedMany': 'Replaced {count} pixels',
  'notice.colorMissing': 'That color is not in the drawing',
  'notice.nothingToPaste': 'Nothing to paste',
  'notice.copyBlocked': 'Copied inside Vidopix only; the browser blocked the system clipboard',
  'history.undid': 'Undid: {label}',
  'history.redid': 'Redid: {label}',

  // Canvas and errors
  'canvas.label':
    'Drawing canvas. Arrow keys move the pixel cursor, Alt with arrows moves 8 pixels, hold Enter to draw. With the Move tool, arrow keys move the selected pixels.',
  'error.title': 'Something went wrong',
  'error.body': 'Reload the page to continue.',

  // Names of undoable steps (announced on undo and redo)
  'step.renameLayer': 'Rename layer',
  'step.reorderLayers': 'Reorder layers',
  'step.showLayer': 'Show layer',
  'step.hideLayer': 'Hide layer',
  'step.lockLayer': 'Lock layer',
  'step.unlockLayer': 'Unlock layer',
  'step.layerOpacity': 'Layer opacity',
  'step.addColor': 'Add color',
  'step.addColors': 'Add colors to palette',
  'step.removeColor': 'Remove color',
  'step.reorderPalette': 'Reorder palette',
  'step.renameColor': 'Rename color',
  'step.editColor': 'Edit palette color',
  'step.renamePalette': 'Rename palette',
  'step.loadPalette': 'Load palette',
  'step.renameSprite': 'Rename sprite',
  'shortcuts.spaceDrag': 'Space + drag',
  'shortcuts.mouseWheel': 'Mouse wheel',
} as const;

export type MessageKey = keyof typeof en;
