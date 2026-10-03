import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  NOTICES_FILE,
  collectShipped,
  packageFromPath,
  renderNotices,
  withoutHash,
} from './third-party-licenses.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A fake build folder: each entry is a path inside it and its contents. */
function fakeDist(files) {
  const dist = mkdtempSync(join(tmpdir(), 'vidopix-dist-'));
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), contents);
  }
  return dist;
}

function sourceMap(dist, mapPath, absoluteSources) {
  const from = dirname(join(dist, mapPath));
  return JSON.stringify({ version: 3, sources: absoluteSources.map((s) => relative(from, s)) });
}

test('finds the package of a path inside node_modules, scoped or not', () => {
  assert.deepEqual(packageFromPath('/r/node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/x.js'), {
    name: 'zod',
    dir: '/r/node_modules/.pnpm/zod@4.6.5/node_modules/zod',
  });
  assert.deepEqual(packageFromPath('/r/node_modules/@fontsource-variable/inter/index.css'), {
    name: '@fontsource-variable/inter',
    dir: '/r/node_modules/@fontsource-variable/inter',
  });
  assert.equal(packageFromPath('/r/apps/web/src/app/main.tsx'), null);
});

test('removes the content hash Vite adds to file names', () => {
  assert.equal(
    withoutHash('inter-latin-wght-normal-Dx4kXJAl.woff2'),
    'inter-latin-wght-normal.woff2',
  );
  assert.equal(withoutHash('palette.worker-_PKmr0-3.js'), 'palette.worker.js');
});

test('keeps license texts that contain backticks inside their block', () => {
  const text = renderNotices([{ name: 'x', version: '1.0.0', license: 'MIT', text: 'a ``` b' }]);
  assert.match(text, /````text\na ``` b\n````/);
});

test('attributes bundled code to the installed package and version it came from', () => {
  const reactFile = createRequire(join(root, 'apps/web/package.json')).resolve('react');
  const dist = fakeDist({});
  writeFileSync(join(dist, 'index.js.map'), sourceMap(dist, 'index.js.map', [reactFile]));
  try {
    const { problems, packages } = collectShipped(dist);
    assert.deepEqual(problems, []);
    assert.deepEqual(
      packages.map((p) => p.name),
      ['react'],
    );
    assert.match(packages[0].text, /Permission is hereby granted/);
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test('fails on anything in the build it cannot attribute', () => {
  const dist = fakeDist({
    'assets/unknown-font-AAAAAAAA.woff2': '',
    'stray.pdf': '',
  });
  writeFileSync(
    join(dist, 'index.js.map'),
    sourceMap(dist, 'index.js.map', [join(root, 'somewhere', 'else.js')]),
  );
  try {
    const { problems } = collectShipped(dist);
    assert.equal(problems.length, 3, problems.join('\n'));
    assert.match(problems.join('\n'), /cannot tell where/);
    assert.match(problems.join('\n'), /no dependency ships "unknown-font.woff2"/);
    assert.match(problems.join('\n'), /stray\.pdf/);
  } finally {
    rmSync(dist, { recursive: true });
  }
});

test('the non-affiliation notice names every author of a preset palette', () => {
  const presets = readFileSync(join(root, 'packages/core/src/data/palette-presets.ts'), 'utf8');
  const authors = [...presets.matchAll(/author: '([^']+)'/g)].map((match) => match[1]);
  const notice = readFileSync(NOTICES_FILE, 'utf8').split('\n## ')[0];
  assert.ok(authors.length > 0);
  for (const author of authors) assert.ok(notice.includes(author), `${author} is not named`);
});
