import { describe, expect, it } from 'vitest';
import { createSequentialIdGenerator } from './id-generator.js';

describe('createSequentialIdGenerator', () => {
  it('produces unique, predictable ids', () => {
    const ids = createSequentialIdGenerator('layer');
    expect([ids.next(), ids.next(), ids.next()]).toEqual(['layer-1', 'layer-2', 'layer-3']);
  });

  it('keeps independent counters per generator', () => {
    const a = createSequentialIdGenerator();
    const b = createSequentialIdGenerator();
    a.next();
    expect(b.next()).toBe('id-1');
  });
});
