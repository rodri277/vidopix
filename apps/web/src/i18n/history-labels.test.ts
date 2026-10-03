import { EditorSession, createSequentialIdGenerator, packRgba } from '@vidopix/core';
import { describe, expect, it } from 'vitest';
import { HISTORY_LABEL_KEYS } from './history-labels';
import { en } from './en';

describe('history label translations', () => {
  it('know every name the engine gives to an undoable step', () => {
    const created = EditorSession.create(
      { width: 16, height: 16 },
      { ids: createSequentialIdGenerator() },
    );
    if (!created.ok) throw new Error('session');
    const session = created.value;
    const labels = new Set<string>();
    session.on('historyChanged', ({ cause, label }) => {
      if (cause === 'record' && label) labels.add(label);
    });

    const press = (x: number, y: number, up = true): void => {
      session.pointerDown({ x, y, button: 'primary', shift: false });
      if (up) session.pointerUp({ x, y, button: 'primary', shift: false });
    };
    const red = packRgba(255, 0, 0, 255);
    session.setColor('primary', red);
    for (const tool of ['pencil', 'eraser', 'fill', 'line', 'rectangle', 'ellipse'] as const) {
      session.setActiveTool(tool);
      press(2, 2);
      session.pointerDown({ x: 3, y: 3, button: 'primary', shift: false });
      session.pointerMove({ x: 6, y: 6, button: 'primary', shift: false });
      session.pointerUp({ x: 6, y: 6, button: 'primary', shift: false });
    }

    const document = session.document;
    session.setActiveTool('select');
    session.pointerDown({ x: 1, y: 1, button: 'primary', shift: false });
    session.pointerMove({ x: 8, y: 8, button: 'primary', shift: false });
    session.pointerUp({ x: 8, y: 8, button: 'primary', shift: false });
    document.copySelection();
    document.paste({ x: 10, y: 10 });
    document.commitFloating();
    document.nudge(1, 1);
    document.commitFloating();
    document.deleteSelection();
    document.deselect();

    document.addLayer();
    document.duplicateLayer();
    const id = document.activeLayer.id;
    document.renameLayer(id, 'Renamed');
    document.moveLayer(id, 0);
    document.setLayerVisible(id, false);
    document.setLayerVisible(id, true);
    document.setLayerLocked(id, true);
    document.setLayerLocked(id, false);
    document.setLayerOpacity(id, 0.5);
    document.mergeDown();
    document.addLayer();
    document.flatten();
    document.deleteLayer(document.activeLayer.id);
    document.addLayer();
    document.deleteLayer();

    document.addPaletteColor(red);
    document.addPaletteColor(packRgba(0, 255, 0, 255));
    document.appendPaletteColors([{ color: packRgba(0, 0, 255, 255) }]);
    document.movePaletteColor(0, 1);
    document.renamePaletteColor(0, 'Name');
    document.setPaletteColor(0, packRgba(10, 10, 10, 255));
    document.renamePalette('Mine');
    document.loadPalette('Other', [{ color: red }]);
    document.removePaletteColor(0);
    document.replaceColor(red, packRgba(1, 2, 3, 255));
    document.renameSprite('Hero');

    expect(labels.size).toBeGreaterThan(25);
    for (const label of labels) {
      expect(HISTORY_LABEL_KEYS[label], `no translation for "${label}"`).toBeDefined();
    }
  });

  it('point only at texts that exist', () => {
    for (const key of Object.values(HISTORY_LABEL_KEYS)) expect(en[key]).toBeTruthy();
  });
});
