/** Deflate and inflate with the browser's built-in streams, so no library is needed. */

async function collect(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function supportsCompression(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(bytes)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  return (await collect(stream, Number.POSITIVE_INFINITY)) ?? new Uint8Array(0);
}

/** Returns null if the data is not valid deflate or would expand beyond `limit` bytes. */
export async function inflate(bytes: Uint8Array, limit: number): Promise<Uint8Array | null> {
  try {
    const stream = new Blob([new Uint8Array(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return await collect(stream, limit);
  } catch {
    return null;
  }
}
