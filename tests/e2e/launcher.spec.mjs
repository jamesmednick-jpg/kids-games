import { test, expect } from '@playwright/test';

test('launcher lists the nail salon and opens it', async ({ page }) => {
  await page.goto('/');
  const tile = page.locator('a.tile[href="./nail-salon/"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('Nail Salon');
  const box = await tile.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(120);
  await tile.click();
  await expect(page).toHaveURL(/\/nail-salon\//);
  await expect(page.locator('#screen-shape')).toBeVisible();
});

test('launcher has no off-site links', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')));
  for (const h of hrefs) expect(h.startsWith('./')).toBeTruthy();
});
