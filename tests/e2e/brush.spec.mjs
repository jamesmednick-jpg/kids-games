import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, drag, zoomNail, stageBox } from './helpers.mjs';

const hasPaint = (page, i) => page.evaluate(i => window.__salon.layerHasPaint(i), i);
const leak = (page, i) => page.evaluate(i => window.__salon.layerLeak(i), i);

test('dragging inside a nail paints inside and not outside it', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 2);
  const c = await nailCenter(page, 2);
  await drag(page, { x: c.x, y: c.y - 15 }, { x: c.x, y: c.y + 15 });
  const inside = await page.evaluate(() => {
    const n = window.__salon.hand().nails[2].rect;
    return window.__salon.layerAlphaAt(2, n.x + n.w / 2, n.y + n.h / 2);
  });
  expect(inside).toBeGreaterThan(0);
  const outside = await page.evaluate(() => {
    const p = window.__salon.outsidePoint(2);
    return window.__salon.layerAlphaAt(2, p.x, p.y);
  });
  expect(outside).toBe(0);
  expect(await leak(page, 2)).toBe(0);
});

test('a drag that starts outside every nail paints nothing', async ({ page }) => {
  await openSalon(page);
  // whole-hand view: palm to nail
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const c = await nailCenter(page, 1);
  await drag(page, palm, c);
  for (let i = 0; i < 5; i++) expect(await hasPaint(page, i)).toBe(false);
  expect(await page.evaluate(() => window.__salon.state.zoomNail)).toBe(-1);
  // zoomed view: from just outside the nail outline into its center
  await zoomNail(page, 1);
  const out = await page.evaluate(() => { const p = window.__salon.outsidePoint(1); return window.__salon.toScreen(p.x, p.y); });
  const c1 = await nailCenter(page, 1);
  await drag(page, out, c1);
  for (let i = 0; i < 5; i++) expect(await hasPaint(page, i)).toBe(false);
});

test('a drag from nail 1 toward nail 2 paints only nail 1', async ({ page }) => {
  await openSalon(page);
  await zoomNail(page, 1);
  const a = await nailCenter(page, 1);
  const stage = await stageBox(page);
  const b = { x: stage.x + stage.width - 4, y: a.y }; // off the nail, toward the middle finger
  await drag(page, a, b, 20);
  expect(await hasPaint(page, 1)).toBe(true);
  expect(await hasPaint(page, 2)).toBe(false);
  expect(await leak(page, 1)).toBe(0);
});

test('the selected palette color is what gets painted', async ({ page }) => {
  await openSalon(page);
  await page.click('#palette button[data-color="3"]'); // #ffd60a yellow
  await zoomNail(page, 0);
  const c = await nailCenter(page, 0);
  await drag(page, { x: c.x - 5, y: c.y }, { x: c.x + 5, y: c.y });
  const rgba = await page.evaluate(() => {
    const n = window.__salon.hand().nails[0].rect;
    return window.__salon.layerPixelAt(0, n.x + n.w / 2, n.y + n.h / 2);
  });
  expect(rgba[0]).toBeGreaterThan(240);
  expect(rgba[1]).toBeGreaterThan(190);
  expect(rgba[2]).toBeLessThan(60);
});
