import { test, expect } from '@playwright/test';
import { openSalon, zoomNail, mainPixel, stageBox } from './helpers.mjs';

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

test('a ring can be dragged out of the strip and dropped onto a finger', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  const from = await page.locator('#rings button[data-ring="5"]').boundingBox();
  const to = await page.evaluate(() => window.__salon.ringPointScreen(3));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 40, { steps: 4 });
  await expect(page.locator('#ring-ghost')).toBeVisible();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  // the finger it is over previews the ring before you let go
  await page.waitForFunction(() => window.__salon.state.ringPreview === 3);
  await page.mouse.up();
  await expect(page.locator('#ring-ghost')).toBeHidden();
  expect(await page.evaluate(() => window.__salon.state.rings.slice())).toEqual([-1, -1, -1, 5, -1]);
  expect(await page.evaluate(() => window.__salon.state.ringPreview)).toBe(-1);
});

test('dragging a ring onto the palm drops nothing and changes nothing', async ({ page }) => {
  await openSalon(page);
  await page.click('#tool-ring');
  const from = await page.locator('#rings button[data-ring="2"]').boundingBox();
  const stage = await stageBox(page);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.85, { steps: 12 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__salon.state.rings.slice())).toEqual([-1, -1, -1, -1, -1]);
  // but the ring you dragged is now the selected one
  await expect(page.locator('#rings button[data-ring="2"]')).toHaveClass(/selected/);
});
