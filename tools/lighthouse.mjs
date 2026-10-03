// Measures the production build with Lighthouse (desktop preset) and prints the four scores.
// Usage: pnpm build && pnpm lighthouse
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Playwright is a dependency of the web app, so load it from there.
const { chromium } = createRequire(new URL('../apps/web/', import.meta.url))('@playwright/test');

const LIGHTHOUSE_VERSION = '13.5.0';
const PAGE_URL = 'http://localhost:4173/';
const MINIMUM = 95;

const server = spawn('pnpm', ['--filter', '@vidopix/web', 'preview'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(PAGE_URL)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('The preview server did not start. Run `pnpm build` first.');
}

await waitForServer();
const output = join(mkdtempSync(join(tmpdir(), 'vidopix-lighthouse-')), 'report.json');
const run = spawnSync(
  'pnpm',
  [
    'dlx',
    `lighthouse@${LIGHTHOUSE_VERSION}`,
    PAGE_URL,
    '--preset=desktop',
    `--chrome-path=${chromium.executablePath()}`,
    '--chrome-flags=--headless=new --no-sandbox',
    '--output=json',
    `--output-path=${output}`,
    '--quiet',
  ],
  { stdio: 'inherit' },
);
stop();
if (run.status !== 0) process.exit(run.status ?? 1);

const report = JSON.parse(readFileSync(output, 'utf8'));
let failed = false;
for (const name of ['performance', 'accessibility', 'best-practices', 'seo']) {
  const score = Math.round((report.categories[name]?.score ?? 0) * 100);
  console.warn(
    `${name.padEnd(15)} ${String(score).padStart(3)}${score < MINIMUM ? '  (below 95)' : ''}`,
  );
  if (score < MINIMUM) failed = true;
}
process.exit(failed ? 1 : 0);
