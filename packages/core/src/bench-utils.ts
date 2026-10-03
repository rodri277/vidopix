import { Bench } from 'tinybench';

export interface BenchCase {
  readonly name: string;
  readonly run: () => void;
}

/** Runs the cases and prints a table (median and mean per run, in milliseconds). */
export async function runBenchmarks(title: string, cases: readonly BenchCase[]): Promise<void> {
  const bench = new Bench({ time: 500, warmupTime: 100 });
  for (const { name, run } of cases) bench.add(name, run);
  await bench.run();
  const lines = bench.tasks.map((task) => {
    const result = task.result;
    const latency = 'latency' in result ? result.latency : undefined;
    const median = (latency?.p50 ?? Number.NaN).toFixed(3);
    const mean = (latency?.mean ?? Number.NaN).toFixed(3);
    return `  ${task.name.padEnd(48)} median ${median.padStart(9)} ms   mean ${mean.padStart(9)} ms   (${String(latency?.samplesCount ?? 0)} runs)`;
  });
  // Written straight to stdout: the test reporter would otherwise hide console output.
  process.stdout.write(`\n${title}\n${lines.join('\n')}\n`);
}
