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
} as const;

export type MessageKey = keyof typeof en;
