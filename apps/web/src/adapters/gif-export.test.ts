import { EditorSession } from '@vidopix/core';
import { describe, expect, it } from 'vitest';
import { randomIdGenerator } from './id-generator';
import { toGifData } from './gif-export';

describe('toGifData', () => {
  it('copies durations, layer settings and every cel so the document can keep changing', () => {
    const created = EditorSession.create({ width: 2, height: 2 }, { ids: randomIdGenerator });
    if (!created.ok) throw new Error('session');
    const { document } = created.value;
    document.activeLayer.buffer.set(1, 0, 0xff0000ff);
    document.addFrame();
    document.setFrameDuration(1, 250);
    document.setLayerVisible(document.activeLayer.id, false);

    const data = toGifData(created.value.sprite);
    expect(data).toMatchObject({ width: 2, height: 2, durations: [100, 250] });
    expect(data.layers).toHaveLength(1);
    expect(data.layers[0]).toMatchObject({ visible: false, opacity: 1 });
    expect(data.layers[0]?.cels).toHaveLength(2);
    expect(data.layers[0]?.cels[0]?.[1]).toBe(0xff0000ff);

    // Changing the document afterwards does not change the copy.
    created.value.sprite.layers[0]?.cels[0]?.set(1, 0, 0);
    expect(data.layers[0]?.cels[0]?.[1]).toBe(0xff0000ff);
  });
});
