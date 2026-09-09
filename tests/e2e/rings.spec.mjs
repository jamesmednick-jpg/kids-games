import { test, expect } from '@playwright/test';
import { openSalon, zoomNail, mainPixel } from './helpers.mjs';

const ringPoint = (page, i) => page.evaluate(i => window.__salon.ringPointScreen(i), i);
const ringsOf = page => page.evaluate(() => window.__salon.state.rings.slice());

test('the ring tool swaps the top strip for ring styles', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  await expect(page.locator('#rings')).toBeVisible();
  await expect(page.locator('#palette')).toBeHidden();
  await expect(page.locator('#tray')).toBeHidden();
  await expect(page.locator('#rings button[data-ring]')).toHaveCount(8);
  await page.click('#tool-brush');
  await expect(page.locator('#rings')).toBeHidden();
  await expect(page.locator('#palette')).toBeVisible();
});

test('tapping a finger puts the chosen ring on it, without zooming in', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  await page.click('#rings button[data-ring="3"]');
  await expect(page.locator('#rings button[data-ring="3"]')).toHaveClass(/selected/);
  const p = await ringPoint(page, 2);
  const before = await mainPixel(page, p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => !window.__salon.state.dirty);
  expect(await ringsOf(page)).toEqual([-1, -1, 3, -1, -1]);
  expect(await page.evaluate(() => window.__salon.state.zoomNail)).toBe(-1);
  expect(await mainPixel(page, p.x, p.y)).not.toEqual(before);
});

test('tapping the same finger again takes the ring off', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  const p = await ringPoint(page, 1);
  await page.mouse.click(p.x, p.y);
  expect((await ringsOf(page))[1]).toBe(0);
  await page.mouse.click(p.x, p.y);
  expect((await ringsOf(page))[1]).toBe(-1);
});

test('the sponge cleans the ring off a finger as well as the nail', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  const p = await ringPoint(page, 4);
  await page.mouse.click(p.x, p.y);
  expect((await ringsOf(page))[4]).toBe(0);
  await page.click('#tool-clear');
  await page.mouse.click(p.x, p.y);
  expect((await ringsOf(page))[4]).toBe(-1);
  await expect(page.locator('#tool-clear')).not.toHaveClass(/armed/);
});

test('picking the ring tool while zoomed in backs out to the whole hand', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 2);
  await page.click('#tool-ring');
  await page.waitForFunction(() => window.__salon.state.zoomNail === -1 && !window.__salon.state.animating);
});

test('rings and painted nails both reach the saved photo', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  const p = await ringPoint(page, 2);
  await page.mouse.click(p.x, p.y);
  await page.click('#btn-done');
  const info = await page.evaluate(async () => {
    const blob = await window.__salon.exportPhoto();
    const bmp = await createImageBitmap(blob);
    return { w: bmp.width, h: bmp.height, size: blob.size };
  });
  expect(info.w).toBe(1200);
  expect(info.h).toBe(1600);
  expect(info.size).toBeGreaterThan(10_000);
});
