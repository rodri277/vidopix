import { defineConfig } from 'vitest/config';

// Benchmarks run as one-shot tests that print a table. They report numbers; they do not assert on
// them because timings vary between machines. Compare against the targets in SPEC.md section 7.
export default defineConfig({
  test: { include: ['src/**/*.bench.ts'], testTimeout: 60_000 },
});
