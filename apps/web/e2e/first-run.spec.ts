import { expect, test } from '@playwright/test';
import { readCanvas } from './helpers';

// Start as a brand-new visitor: nothing saved, never greeted.
test.use({ storageState: { cookies: [], origins: [] } });

test('a first visit asks what size of canvas to start with, once', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Welcome to Vidopix/)).toBeVisible();

  await dialog.getByRole('button', { name: '64×64' }).click();
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('contentinfo')).toContainText('64×64 px');

  // The next visit picks up the sprite and does not ask again.
  await page.reload();
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('64×64 px');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('canceling the greeting starts with a small canvas and it does not come back', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'New sprite' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('contentinfo')).toContainText('32×32 px');
  await readCanvas(page);

  await page.reload();
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('new frames can be added from a labeled button and from the end of the strip', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  const frames = page.getByRole('list', { name: 'Frames' }).getByRole('listitem');
  await expect(page.getByRole('button', { name: 'New frame' })).toContainText('New frame');
  await page.getByRole('button', { name: 'New frame' }).click();
  await expect(frames).toHaveCount(2);
  await page.getByRole('button', { name: 'Add frame' }).click();
  await expect(frames).toHaveCount(3);
});
