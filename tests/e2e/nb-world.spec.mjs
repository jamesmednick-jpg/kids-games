import { test, expect } from '@playwright/test';

// Play is four worlds with gravity. Let go and it falls; land it on a
// platform and it sits; drop it on another buddy and they add up.

async function openPlay(page, world = 'meadow') {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  if (world) {
    await page.click(`[data-world="${world}"]`);
    await page.waitForFunction(w => window.__nb.play.state.world === w, world);
  }
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

const towerBox = (page, i = 0) => page.locator('#play-board .tower').nth(i).boundingBox();
// An x with nothing but ground underneath, so a drop really reaches the floor.
const freeX = page => page.evaluate(() => {
  const W = document.getElementById('play-board').clientWidth;
  const ps = window.__nb.play.state.platforms;
  for (let x = W - 44; x >= 0; x -= 4) {   // a cube is 44 wide at the smallest
    if (!ps.some(p => Math.min(p.left + p.width, x + 44) - Math.max(p.left, x) > 0)) return x;
  }
  return 0;
});
const settled = page => page.waitForFunction(() => window.__nb.play.state.towers.every(t => t.resting), null, { timeout: 5000 });

test('Play opens on a picker of four worlds, all available', async ({ page }) => {
  await openPlay(page, null);
  await expect(page.locator('#play-picker [data-world]')).toHaveCount(4);
  for (const w of ['meadow', 'clouds', 'rainbow', 'night']) {
    const tile = page.locator(`[data-world="${w}"]`);
    await expect(tile).toBeVisible();
    expect(await tile.evaluate(el => el.disabled || el.classList.contains('locked'))).toBeFalsy();
  }
  await expect(page.locator('#play-board')).toBeHidden();
});

test('picking a world shows its scene, ground and platforms', async ({ page }) => {
  await openPlay(page, 'clouds');
  await expect(page.locator('#play-picker')).toBeHidden();
  await expect(page.locator('#play-board')).toBeVisible();
  expect(await page.locator('#play-board .platform').count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#play-board .ground')).toBeVisible();
  expect(await page.locator('#play-board').evaluate(el => el.dataset.world)).toBe('clouds');
});

test('the worlds button returns to the picker and keeps every world open', async ({ page }) => {
  await openPlay(page, 'night');
  await page.click('#play-worlds');
  await expect(page.locator('#play-picker')).toBeVisible();
  await expect(page.locator('#play-picker [data-world]')).toHaveCount(4);
});

test('a cube from the bin drops in and lands on the ground', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin', { force: true });
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  await settled(page);
  const t = await page.evaluate(() => window.__nb.play.state.towers[0]);
  expect(t.y).toBeGreaterThanOrEqual(0);      // the ground, or whatever platform was under the bin
  expect(t.n).toBe(1);
});

test('a dropped tower falls, says wheee with its arms up, and lands with a squash', async ({ page }) => {
  await openPlay(page);
  const x = await freeX(page);
  await page.evaluate(x => window.__nb.play.addTower(3, x, 320), x);
  await expect(page.locator('#play-board .tower.falling')).toHaveCount(1);
  await expect(page.locator('#play-board .tower.falling .arms.up')).toHaveCount(1);
  await settled(page);
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.some(id => id.startsWith('fall-'))).toBeTruthy();
  await expect(page.locator('#play-board .tower.falling')).toHaveCount(0);
  await expect(page.locator('#play-board .tower.landed')).toHaveCount(1);
  expect((await page.evaluate(() => window.__nb.play.state.towers[0])).y).toBe(0);
});

test('a tower dropped above a platform lands on the platform, not the ground', async ({ page }) => {
  await openPlay(page, 'clouds');
  const p = await page.evaluate(() => window.__nb.play.state.platforms[0]);
  await page.evaluate(([x, y]) => window.__nb.play.addTower(2, x, y), [p.left + p.width / 2 - 20, p.top + 200]);
  await settled(page);
  const t = await page.evaluate(() => window.__nb.play.state.towers[0]);
  expect(t.y).toBeCloseTo(p.top, 0);
  expect(t.y).toBeGreaterThan(0);
});

test('dropping a tower onto another adds them up with the merge beat, but no confetti', async ({ page }) => {
  await openPlay(page);
  const x = await freeX(page);
  await page.evaluate(x => window.__nb.play.addTower(3, x, 0), x);
  await settled(page);
  await page.evaluate(x => window.__nb.play.addTower(2, x + 5, 300), x);
  await page.waitForFunction(() => window.__nb.play.state.towers.length === 1, null, { timeout: 5000 });
  await page.waitForFunction(() => window.__nb.spoken.includes('is-5'), null, { timeout: 15000 });
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken).toContain('join');
  expect(spoken.filter(id => id.startsWith('count-'))).toEqual(['count-1', 'count-2', 'count-3', 'count-4', 'count-5']);
  expect(await page.evaluate(() => window.__nb.play.state.towers[0].n)).toBe(5);
  await expect(page.locator('#play-board .buddy.dance')).toHaveCount(1);
  expect(await page.locator('#screen-play .confetti-piece').count()).toBe(0);
  expect(await page.locator('#screen-play .firework').count()).toBe(0);
});

test('a join that would pass the maximum bounces off instead', async ({ page }) => {
  await openPlay(page);
  const x = await freeX(page);
  await page.evaluate(x => window.__nb.play.addTower(9, x, 0), x);
  await settled(page);
  await page.evaluate(x => window.__nb.play.addTower(9, x + 5, 300), x);
  await page.waitForTimeout(2500);
  const ns = await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n));
  expect(ns.sort()).toEqual([9, 9]);
});

test('letting go mid-swing flings the buddy through the air', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => window.__nb.play.addTower(2, 40, 0));
  await settled(page);
  const b = await towerBox(page);
  const x0 = await page.evaluate(() => window.__nb.play.state.towers[0].x);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height - 20);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + b.width / 2 + i * 22, b.y + b.height - 20 - i * 10, { steps: 1 }); await page.waitForTimeout(16); }
  await page.mouse.up();
  await expect(page.locator('#play-board .tower.falling')).toHaveCount(1);
  await settled(page);
  const t = await page.evaluate(() => window.__nb.play.state.towers[0]);
  expect(t.x).toBeGreaterThan(x0 + 8 * 22 + 20);   // kept moving after release
  expect(t.y).toBe(0);
});

test('pulling the top cube off still splits a tower', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => window.__nb.play.addTower(4, 100, 0));
  await settled(page);
  // The sign sits over the top of the top cube and acts as a handle for the
  // whole tower; the exposed lower part of the cube is what pops it off.
  const top = await page.locator('#play-board .tower .cube[data-index="0"]').boundingBox();
  await page.mouse.move(top.x + top.width / 2, top.y + top.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(top.x + 140, top.y - 40, { steps: 6 });
  await page.mouse.up();
  await settled(page);
  const ns = await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n).sort());
  expect(ns).toEqual([1, 3]);
});

test('every buddy in a world shares one cube size and has arms', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(1, 40, 0); window.__nb.play.addTower(6, 200, 0); });
  const widths = await page.locator('#play-board .cube').evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  expect(await page.locator('#play-board .buddy .arms').count()).toBe(2);
});

test('sweep clears the world and leaving clears it too', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(3, 60, 0); window.__nb.play.addTower(2, 200, 0); });
  await page.click('#play-sweep');
  await expect(page.locator('#play-board .tower')).toHaveCount(0);
  await page.evaluate(() => window.__nb.play.addTower(3, 60, 0));
  await page.click('#btn-home');
  await page.click('[data-mode="play"]');
  await expect(page.locator('#play-picker')).toBeVisible();
  expect(await page.locator('#play-board .tower').count()).toBe(0);
});

test('there are no goals, prompts or targets in the worlds', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin', { force: true });
  await settled(page);
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.some(id => id.startsWith('make-') || id.startsWith('over-') || id.startsWith('nudge-'))).toBeFalsy();
});
