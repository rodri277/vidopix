import { it } from 'vitest';
import { runBenchmarks } from '../bench-utils.js';
import { packRgba } from '../domain/color.js';
import { PixelBuffer } from '../domain/pixel-buffer.js';
import { floodFillSpans } from './flood-fill.js';

it('flood fill', async () => {
  const empty = PixelBuffer.create(1024, 1024);
  const maze = PixelBuffer.create(1024, 1024);
  const wall = packRgba(255, 0, 0, 255);
  for (let y = 0; y < 1024; y += 2) maze.data.fill(wall, y * 1024, y * 1024 + 1023);
  const noop = (): void => undefined;

  await runBenchmarks('Flood fill, 1024x1024 (target: under 50 ms)', [
    {
      name: 'empty canvas, contiguous',
      run: () => {
        floodFillSpans(empty, 512, 512, { mode: 'contiguous', tolerance: 0 }, noop);
      },
    },
    {
      name: 'empty canvas, global',
      run: () => {
        floodFillSpans(empty, 512, 512, { mode: 'global', tolerance: 0 }, noop);
      },
    },
    {
      name: 'serpentine maze, contiguous',
      run: () => {
        floodFillSpans(maze, 1023, 1, { mode: 'contiguous', tolerance: 0 }, noop);
      },
    },
  ]);
});
