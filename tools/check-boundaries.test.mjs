import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = join(root, '.dependency-cruiser.cjs');
const depcruise = join(root, 'node_modules', '.bin', 'depcruise');

function cruise(fixture) {
  return spawnSync(depcruise, ['.', '--config', config], {
    cwd: join(root, 'tools', 'fixtures', fixture),
    encoding: 'utf8',
  });
}

test('accepts imports that respect the boundaries', () => {
  const result = cruise('valid');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('fails when core imports web', () => {
  const result = cruise('core-imports-web');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /core-must-not-import-web/);
});

test('fails when one feature imports another', () => {
  const result = cruise('feature-imports-feature');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /features-must-not-import-each-other/);
});
