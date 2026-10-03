import { it } from 'vitest';
import { runBenchmarks } from '../bench-utils.js';
import { compositeRegion } from '../domain/compositing.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { createSequentialIdGenerator } from '../ports/id-generator.js';
import { EditorSession } from './editor-session.js';

function newSession(size: number): EditorSession {
  const result = EditorSession.create(
    { width: size, height: size },
    { ids: createSequentialIdGenerator() },
  );
  if (!result.ok) throw new Error('could not create session');
  return result.value;
}

it('editing through the session', async () => {
  const small = newSession(256);
  const big = newSession(1024);
  big.setActiveTool('fill');
  let counter = 0;

  await runBenchmarks('Editing through EditorSession, including history', [
    {
      name: '3px pencil stroke, 100 samples, 256x256',
      run: () => {
        small.setColor('primary', (0xff000000 | ++counter) >>> 0);
        small.pointerDown({ x: 10, y: 10, button: 'primary', shift: false });
        for (let i = 1; i <= 100; i++) {
          small.pointerMove({
            x: 10 + (i % 200),
            y: 10 + ((i * 7) % 200),
            button: 'primary',
            shift: false,
          });
        }
        small.pointerUp({ x: 150, y: 150, button: 'primary', shift: false });
      },
    },
    {
      name: 'fill 1024x1024 with history (target: under 50 ms)',
      run: () => {
        big.setColor('primary', (0xff000000 | ++counter) >>> 0);
        big.pointerDown({ x: 512, y: 512, button: 'primary', shift: false });
        big.pointerUp({ x: 512, y: 512, button: 'primary', shift: false });
      },
    },
    {
      name: 'fill 1024x1024 then undo',
      run: () => {
        big.setColor('primary', (0xff000000 | ++counter) >>> 0);
        big.pointerDown({ x: 512, y: 512, button: 'primary', shift: false });
        big.pointerUp({ x: 512, y: 512, button: 'primary', shift: false });
        big.undo();
      },
    },
  ]);
});

it('compositing many layers', async () => {
  const session = newSession(256);
  for (let i = 0; i < 7; i++) session.document.addLayer();
  for (const layer of session.sprite.layers) layer.buffer.fill(0x80402010);
  const target = PixelBuffer.create(256, 256);

  await runBenchmarks('Compositing 8 layers of 256x256', [
    {
      name: 'dirty region 32x32',
      run: () => {
        compositeRegion(session.sprite, target, { x: 100, y: 100, width: 32, height: 32 });
      },
    },
    {
      name: 'whole sprite',
      run: () => {
        compositeRegion(session.sprite, target, { x: 0, y: 0, width: 256, height: 256 });
      },
    },
  ]);
});
