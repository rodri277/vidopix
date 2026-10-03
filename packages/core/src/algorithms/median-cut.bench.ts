import { it } from 'vitest';
import { runBenchmarks } from '../bench-utils.js';
import { packRgba } from '../domain/color.js';
import { medianCut } from './median-cut.js';

it('median cut', async () => {
  // A noisy 256x256 gradient behaves like a photo reduced to the worker's working size.
  const photo = new Uint32Array(256 * 256);
  for (let i = 0; i < photo.length; i++) {
    const x = i % 256;
    const y = Math.floor(i / 256);
    const noise = (i * 2654435761) % 24;
    photo[i] = packRgba(
      Math.min(255, x + noise),
      Math.min(255, y + noise),
      Math.min(255, (x + y) / 2 + noise),
      255,
    );
  }

  await runBenchmarks('Palette extraction from 256x256 (the size used by the worker)', [
    { name: '8 colors', run: () => void medianCut(photo, 8) },
    { name: '16 colors', run: () => void medianCut(photo, 16) },
    { name: '64 colors', run: () => void medianCut(photo, 64) },
  ]);
});
