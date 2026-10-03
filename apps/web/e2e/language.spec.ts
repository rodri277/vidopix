import { expect, test } from '@playwright/test';
import { clickPixel, exportPng, pixelAt, readCanvas, setPrimaryColor } from './helpers';

test('English is the default for an English browser and Spanish can be chosen', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('menuitem', { name: 'File' })).toBeVisible();

  await page.getByRole('menuitem', { name: 'Help' }).click();
  await page.getByRole('menuitemradio', { name: 'Español' }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('menuitem', { name: 'Archivo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lápiz', exact: true })).toBeVisible();
  await expect(page.getByRole('application', { name: /Lienzo de dibujo/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Lista de capas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Paleta' })).toBeVisible();
});

test('the choice is remembered after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('menuitem', { name: 'Help' }).click();
  await page.getByRole('menuitemradio', { name: 'Español' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('menuitem', { name: 'Archivo' })).toBeVisible();
});

test.describe('a browser set to Spanish', () => {
  test.use({ locale: 'es-ES' });

  test('starts in Spanish and everything still works', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('menuitem', { name: 'Archivo' })).toBeVisible();

    const canvas = await readCanvas(page);
    await setPrimaryColor(page, '#FF0080');
    await clickPixel(page, canvas, 3, 3);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByRole('status')).toHaveText('Deshecho: Lápiz');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(page.getByRole('status')).toHaveText('Rehecho: Lápiz');

    await page.keyboard.press('ControlOrMeta+e');
    const dialog = page.getByRole('dialog', { name: 'Exportar' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    // The export helper speaks English, so switch back to check the pixel.
    await page.getByRole('menuitem', { name: 'Ayuda' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    expect(pixelAt(await exportPng(page), 3, 3)).toEqual([255, 0, 128, 255]);
  });

  test('shows the saved state and messages in Spanish', async ({ page }) => {
    await page.goto('/');
    const canvas = await readCanvas(page);
    await clickPixel(page, canvas, 1, 1);
    await expect(page.getByRole('contentinfo')).toContainText('Cambios sin guardar');
    await expect(page.getByRole('contentinfo')).toContainText('Guardado', { timeout: 10_000 });
  });
});
