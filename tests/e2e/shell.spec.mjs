import { test, expect } from '@playwright/test';
import { openSalon, nailCenter, mainPixel } from './helpers.mjs';

test('shape picker shows five shape tiles and four skin tones', async ({ page }) => {
  await page.goto('/nail-salon/index.html');
  await expect(page.locator('#tiles button[data-shape]')).toHaveCount(5);
  await expect(page.locator('#skins button[data-skin]')).toHaveCount(4);
});

test('picking a shape opens the salon with that shape', async ({ page }) => {
  await openSalon(page, 'almond');
  const shape = await page.evaluate(() => window.__salon.hand().shape);
  expect(shape).toBe('almond');
});

test('the hand is drawn: palm pixel is skin colored, nail center is pale', async ({ page }) => {
  await openSalon(page);
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const [r, g, b, a] = await mainPixel(page, palm.x, palm.y);
  expect(a).toBe(255);
  expect(r).toBeGreaterThan(g); // skin tones are warm
  const c = await nailCenter(page, 2);
  const [nr, ng, nb] = await mainPixel(page, c.x, c.y);
  expect(nr).toBeGreaterThan(200); expect(ng).toBeGreaterThan(180); expect(nb).toBeGreaterThan(180);
});

test('home button returns to the shape picker', async ({ page }) => {
  await openSalon(page);
  await page.click('#btn-home');
  await expect(page.locator('#screen-shape')).toBeVisible();
  await expect(page.locator('#screen-salon')).toBeHidden();
});

test('changing skin tone changes the salon hand', async ({ page }) => {
  await page.goto('/nail-salon/index.html');
  await page.click('[data-skin="3"]');
  await page.click('[data-shape="round"]');
  await page.waitForFunction(() => window.__salon && window.__salon.hand() && window.__salon.state.frames > 0);
  const palm = await page.evaluate(() => window.__salon.toScreen(350, 700));
  const [r] = await mainPixel(page, palm.x, palm.y);
  expect(r).toBeLessThan(140); // darkest tone
});
