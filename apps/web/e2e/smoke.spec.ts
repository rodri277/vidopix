import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('editor loads with its main regions and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');

  await expect(page).toHaveTitle('Vidopix');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('menubar', { name: 'Main menu' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('by vidotho');
  await expect(page.getByRole('contentinfo')).toContainText('32×32 px');
  expect(errors).toEqual([]);
});

test('has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('dialogs and menus are accessible too', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('menuitem', { name: 'File' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('menuitem', { name: 'New sprite…' }).click();
  await expect(page.getByRole('dialog', { name: 'New sprite' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.keyboard.press('ControlOrMeta+e');
  await expect(page.getByRole('dialog', { name: 'Export PNG' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
