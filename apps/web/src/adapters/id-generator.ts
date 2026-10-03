import type { IdGenerator } from '@vidopix/core';

export const randomIdGenerator: IdGenerator = {
  next: () => crypto.randomUUID(),
};
