import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag, zoomNail } from './helpers.mjs';

test('Done shows the celebration and confetti, New hand goes back to shapes', async ({ page }) => {
  await openSalon(page);
  await page.click('#btn-done');
  await expect(page.locator('#party')).toBeVisible();
  await expect(page.locator('#confetti')).toBeVisible();
  await page.click('#btn-new');
  await expect(page.locator('#screen-shape')).toBeVisible();
  await expect(page.locator('#party')).toBeHidden();
});

test('exportPhoto returns a PNG of 1200x1600 with the painted nails', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 1);
  const c = await nailCenter(page, 1);
  await drag(page, { x: c.x, y: c.y - 10 }, { x: c.x, y: c.y + 10 });
  await page.click('#btn-done');
  const info = await page.evaluate(async () => {
    const blob = await window.__salon.exportPhoto();
    const bmp = await createImageBitmap(blob);
    return { type: blob.type, size: blob.size, w: bmp.width, h: bmp.height };
  });
  expect(info.type).toBe('image/png');
  expect(info.size).toBeGreaterThan(10_000);
  expect(info.w).toBe(1200);
  expect(info.h).toBe(1600);
});

test('Photo falls back to an on-screen image when sharing is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await openSalon(page);
  await page.click('#btn-done');
  await page.click('#btn-photo');
  await expect(page.locator('#fallback')).toBeVisible();
  const w = await page.locator('#fallback-img').evaluate(img => img.naturalWidth);
  expect(w).toBe(1200);
  await page.click('#btn-fallback-close');
  await expect(page.locator('#fallback')).toBeHidden();
});
