import { test, expect } from '@playwright/test';

async function openPlay(page) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

test('the board starts empty with a bin of cubes', async ({ page }) => {
  await openPlay(page);
  expect(await page.locator('#play-board .tower').count()).toBe(0);
  await expect(page.locator('#play-bin')).toBeVisible();
});

test('taking a cube from the bin makes a one', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin');
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  expect(await page.locator('#play-board .tower .cube').count()).toBe(1);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-1');
});

test('every tower on the board shares one cube size', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(1); window.__nb.play.addTower(6); });
  const boxes = await page.locator('#play-board .cube').evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
  expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(1);
  expect(Math.min(...boxes)).toBeGreaterThanOrEqual(44);
});

test('joining two towers announces the new number', async ({ page }) => {
  await openPlay(page);
  const [a, b] = await page.evaluate(() => [window.__nb.play.addTower(2), window.__nb.play.addTower(3)]);
  await page.evaluate(([a, b]) => window.__nb.play.join(a, b), [a, b]);
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  expect(await page.locator('#play-board .tower .cube').count()).toBe(5);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-5');
});

test('dropping one tower onto another joins them', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(2, 40, 200); window.__nb.play.addTower(3, 260, 200); });
  const from = await page.locator('#play-board .tower').nth(0).boundingBox();
  const to = await page.locator('#play-board .tower').nth(1).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height - 20);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 20, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  expect(await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n))).toEqual([5]);
});

test('splitting the top cube off leaves both halves', async ({ page }) => {
  await openPlay(page);
  const id = await page.evaluate(() => window.__nb.play.addTower(4));
  await page.evaluate(id => window.__nb.play.splitTop(id), id);
  await expect(page.locator('#play-board .tower')).toHaveCount(2);
  const sizes = await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n).sort());
  expect(sizes).toEqual([1, 3]);
});

test('splitting a one does nothing rather than making a zero', async ({ page }) => {
  await openPlay(page);
  const id = await page.evaluate(() => window.__nb.play.addTower(1));
  await page.evaluate(id => window.__nb.play.splitTop(id), id);
  expect(await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n))).toEqual([1]);
});

test('joining never exceeds the maximum', async ({ page }) => {
  await openPlay(page);
  const joined = await page.evaluate(() => {
    const a = window.__nb.play.addTower(9);
    const b = window.__nb.play.addTower(9);
    window.__nb.play.join(a, b);
    return window.__nb.play.state.towers.map(t => t.n);
  });
  const max = await page.evaluate(() => window.__nb.settings.MAX_NUMBER);
  for (const n of joined) expect(n).toBeLessThanOrEqual(max);
  expect(joined.reduce((a, b) => a + b, 0)).toBe(18);
});

test('sweep clears the board', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(3); window.__nb.play.addTower(2); });
  await page.click('#play-sweep');
  await expect(page.locator('#play-board .tower')).toHaveCount(0);
});

test('there are no goals, prompts or targets in play mode', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin');
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.some(id => id.startsWith('make-'))).toBeFalsy();
  expect(spoken.some(id => id.startsWith('over-'))).toBeFalsy();
});

test('leaving and coming back clears the board', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin');
  await page.click('#btn-home');
  await page.click('[data-mode="play"]');
  expect(await page.locator('#play-board .tower').count()).toBe(0);
});
