import { expect, test } from '@playwright/test';
import { clickPixel, exportPng, pixelAt, readCanvas, setPrimaryColor } from './helpers';

test('after the first visit the editor works without a connection', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright cannot reload a WebKit page that is offline (internal error)',
  );
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();

  // Wait until the service worker has installed and cached everything.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const names = await caches.keys();
        const lists = await Promise.all(
          names.map(async (name) => (await (await caches.open(name)).keys()).length),
        );
        return lists.reduce((total, count) => total + count, 0);
      }),
    )
    .toBeGreaterThan(10);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();

  // Drawing, the palette tab and exporting all work with the network cut.
  const canvas = await readCanvas(page);
  await setPrimaryColor(page, '#FF0080');
  await clickPixel(page, canvas, 4, 4);
  await page.getByRole('tab', { name: 'Palette' }).click();
  await page.getByLabel('Load a preset palette').selectOption('pico-8');
  await expect(page.getByRole('group', { name: 'Palette colors' }).getByRole('button')).toHaveCount(
    16,
  );
  expect(pixelAt(await exportPng(page), 4, 4)).toEqual([255, 0, 128, 255]);
});

test('the app can be installed: manifest, icons and a service worker', async ({ page }) => {
  await page.goto('/');
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toBeTruthy();
  const manifest = (await (await page.request.get(manifestUrl ?? '')).json()) as {
    name: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBe('Vidopix');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
    expect((await page.request.get(`/${icon}`)).ok()).toBe(true);
  }
  const registered = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? '';
  });
  expect(registered).toContain('/sw.js');
});
