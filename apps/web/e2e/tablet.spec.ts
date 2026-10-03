import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 768, height: 1024 } });

test('the editor fits a 768 px wide tablet without sideways scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('application', { name: /Drawing canvas/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const canvasBox = await page.getByRole('application', { name: /Drawing canvas/ }).boundingBox();
  expect(canvasBox?.width ?? 0).toBeGreaterThan(300);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
