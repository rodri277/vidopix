/** Source of unique identifiers. A port so tests stay deterministic. */
export interface IdGenerator {
  next(): string;
}

export function createSequentialIdGenerator(prefix = 'id'): IdGenerator {
  let counter = 0;
  return {
    next: () => `${prefix}-${String(++counter)}`,
  };
}
