import { z } from 'zod';

// Zod can compile validators with `new Function` for speed. The app forbids that through its
// Content Security Policy, and trying anyway shows up as a violation in the browser console, so
// ask Zod not to. Files are small; the difference is not measurable.
z.config({ jitless: true });

export { z };
