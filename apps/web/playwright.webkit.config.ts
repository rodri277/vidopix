import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// The same tests on WebKit, the engine of Safari. Install it once with `pnpm exec playwright install webkit`.

export default defineConfig({
  ...base,
  retries: 0,
  projects: [
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
  ],
});
