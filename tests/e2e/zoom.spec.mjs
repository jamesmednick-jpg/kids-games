import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, zoomNail, zoomOut, nailRect, stageBox } from './helpers.mjs';

test('tapping a nail zooms in until it fills most of the stage, back zooms out', async ({ page }) => {
  await openSalon(page);
  const stage = await stageBox(page);
  const small = await nailRect(page, 2);
  expect(small.w).toBeLessThan(stage.width * 0.25);
  await expect(page.locator('#btn-back')).toBeHidden();

  await zoomNail(page, 2);
  const big = await nailRect(page, 2);
  expect(big.w).toBeGreaterThan(stage.width * 0.45);
  // the whole nail is on screen
  expect(big.x).toBeGreaterThanOrEqual(stage.x);
  expect(big.x + big.w).toBeLessThanOrEqual(stage.x + stage.width);
  expect(big.y).toBeGreaterThanOrEqual(stage.y);
  expect(big.y + big.h).toBeLessThanOrEqual(stage.y + stage.height);
  await expect(page.locator('#btn-back')).toBeVisible();

  await zoomOut(page);
  const again = await nailRect(page, 2);
  expect(Math.abs(again.w - small.w)).toBeLessThan(1);
  await expect(page.locator('#btn-back')).toBeHidden();
});

test('a tap in the whole-hand view zooms but does not paint', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 1);
  expect(await page.evaluate(() => window.__salon.layerHasPaint(1))).toBe(false);
});

test('Done zooms back out so the celebration shows the whole hand', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 0);
  await page.click('#btn-done');
  await page.waitForFunction(() => window.__salon.state.zoomNail === -1 && !window.__salon.state.animating);
  await expect(page.locator('#party')).toBeVisible();
});

test('on a wide desktop window the salon stays phone-shaped', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await openSalon(page);
  const salon = await page.locator('#screen-salon').boundingBox();
  expect(salon.width).toBeLessThanOrEqual(480);
  expect(Math.abs(salon.x + salon.width / 2 - 700)).toBeLessThan(2); // centered
  const sw = await page.locator('#palette button').nth(1).boundingBox(); // an unselected swatch
  expect(sw.width).toBeLessThanOrEqual(64);
  expect(sw.width).toBeGreaterThanOrEqual(56);
  const stage = await stageBox(page);
  const nail = await nailRect(page, 2);
  expect(nail.w).toBeGreaterThan(30);
  expect(stage.height).toBeGreaterThan(400);
});
