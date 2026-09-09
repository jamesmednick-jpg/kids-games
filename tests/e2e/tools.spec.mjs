import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag } from './helpers.mjs';

const hasPaint = (page, i) => page.evaluate(i => window.__salon.layerHasPaint(i), i);
const leak = (page, i) => page.evaluate(i => window.__salon.layerLeak(i), i);

test('glitter paints inside the nail only', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-glitter');
  await expect(page.locator('#tool-glitter')).toHaveClass(/selected/);
  const c = await nailCenter(page, 3);
  await drag(page, { x: c.x, y: c.y - 10 }, { x: c.x, y: c.y + 10 });
  expect(await hasPaint(page, 3)).toBe(true);
  expect(await leak(page, 3)).toBe(0);
});

test('sticker tray opens, picks a sticker, and a tap near the edge does not leak', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-sticker');
  await expect(page.locator('#tray')).toBeVisible();
  await expect(page.locator('#tray button[data-sticker]')).toHaveCount(8);
  await page.click('#tray button[data-sticker="1"]'); // star
  await expect(page.locator('#tray')).toBeHidden();
  await expect(page.locator('#tool-sticker')).toHaveText('⭐');
  const edge = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.toScreen(n.x + n.w * 0.12, n.y + n.h * 0.5);
  });
  await page.mouse.click(edge.x, edge.y);
  expect(await hasPaint(page, 2)).toBe(true);
  expect(await leak(page, 2)).toBe(0);
});

test('dragging with the sticker tool places only one sticker', async ({ page }) => {
  await openSalon(page, 'square');
  await page.click('#tool-sticker');
  await page.click('#tray button[data-sticker="7"]'); // solid dot in the selected color
  const c = await nailCenter(page, 2);
  await drag(page, { x: c.x - 8, y: c.y }, { x: c.x + 8, y: c.y }, 8);
  // the dot is placed at the start point; the end point must still be empty
  const endAlpha = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.layerAlphaAt(2, n.x + n.w * 0.9, n.y + n.h * 0.5);
  });
  expect(endAlpha).toBe(0);
});

test('clear nail wipes only the tapped nail', async ({ page }) => {
  await openSalon(page);
  for (const i of [0, 1]) {
    const c = await nailCenter(page, i);
    await drag(page, { x: c.x, y: c.y - 8 }, { x: c.x, y: c.y + 8 });
  }
  await page.click('#tool-clear');
  await expect(page.locator('#tool-clear')).toHaveClass(/armed/);
  const c0 = await nailCenter(page, 0);
  await page.mouse.click(c0.x, c0.y);
  await expect(page.locator('#tool-clear')).not.toHaveClass(/armed/);
  expect(await hasPaint(page, 0)).toBe(false);
  expect(await hasPaint(page, 1)).toBe(true);
  // the previous tool is back in use
  await expect(page.locator('#tool-brush')).toHaveClass(/selected/);
});

test('tapping the palm while clear is armed cancels it', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-clear');
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  await page.mouse.click(palm.x, palm.y);
  await expect(page.locator('#tool-clear')).not.toHaveClass(/armed/);
});
