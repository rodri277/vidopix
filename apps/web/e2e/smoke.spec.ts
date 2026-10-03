import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('app shell loads with its main regions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');

  await expect(page).toHaveTitle('Vidopix');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeAttached();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('by vidotho');
  expect(errors).toEqual([]);
});

test('has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
