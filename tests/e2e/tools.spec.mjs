import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag, zoomNail, zoomOut } from './helpers.mjs';

const hasPaint = (page, i) => page.evaluate(i => window.__salon.layerHasPaint(i), i);
const leak = (page, i) => page.evaluate(i => window.__salon.layerLeak(i), i);

test('glitter paints inside the nail only', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-glitter');
  await expect(page.locator('#tool-glitter')).toHaveClass(/selected/);
  await zoomNail(page, 3);
  const c = await nailCenter(page, 3);
  await drag(page, { x: c.x, y: c.y - 10 }, { x: c.x, y: c.y + 10 });
  expect(await hasPaint(page, 3)).toBe(true);
  expect(await leak(page, 3)).toBe(0);
});

test('sticker tool swaps the colors for stickers at the top; brush swaps them back', async ({ page }) => {
  await openSalon(page);
  await expect(page.locator('#palette')).toBeVisible();
  await expect(page.locator('#tray')).toBeHidden();
  await page.click('#tool-sticker');
  await expect(page.locator('#tray')).toBeVisible();
  await expect(page.locator('#palette')).toBeHidden();
  await expect(page.locator('#tray button[data-sticker]')).toHaveCount(8);
  // the strip keeps the same height so the hand does not jump
  const trayBox = await page.locator('#tray').boundingBox();
  await page.click('#tool-brush');
  const palBox = await page.locator('#palette').boundingBox();
  expect(Math.abs(trayBox.height - palBox.height)).toBeLessThan(2);
  await expect(page.locator('#tray')).toBeHidden();
  await page.click('#tool-glitter');
  await expect(page.locator('#palette')).toBeVisible();
});

test('picking a sticker highlights it and a tap near the edge does not leak', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-sticker');
  await page.click('#tray button[data-sticker="1"]'); // star
  await expect(page.locator('#tray')).toBeVisible();
  await expect(page.locator('#tray button[data-sticker="1"]')).toHaveClass(/selected/);
  await expect(page.locator('#tool-sticker')).toHaveText('⭐');
  await zoomNail(page, 2);
  const edge = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2];
    return window.__salon.toScreen(n.bounds.minX + n.rect.w * 0.12, n.center.y);
  });
  await page.mouse.click(edge.x, edge.y);
  expect(await hasPaint(page, 2)).toBe(true);
  expect(await leak(page, 2)).toBe(0);
});

test('dragging with the sticker tool places only one sticker', async ({ page }) => {
  await openSalon(page, 'square');
  await page.click('#tool-sticker');
  await page.click('#tray button[data-sticker="7"]'); // solid dot in the selected color
  await zoomNail(page, 2);
  const c = await nailCenter(page, 2);
  await drag(page, { x: c.x - 8, y: c.y }, { x: c.x + 8, y: c.y }, 8);
  // the dot is placed at the start point; the end point must still be empty
  const endAlpha = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2];
    return window.__salon.layerAlphaAt(2, n.bounds.maxX - n.rect.w * 0.1, n.center.y);
  });
  expect(endAlpha).toBe(0);
});

test('clear nail wipes only the tapped nail', async ({ page }) => {
  await openSalon(page);
  for (const i of [0, 1]) {
    await zoomNail(page, i);
    const c = await nailCenter(page, i);
    await drag(page, { x: c.x, y: c.y - 8 }, { x: c.x, y: c.y + 8 });
    await zoomOut(page);
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
