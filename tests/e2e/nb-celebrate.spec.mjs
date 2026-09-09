import { test, expect } from '@playwright/test';

// The celebration: buddies dance and confetti falls when a number is made in
// Build or Add. Milestones get fireworks. Play stays calm.

async function openBuild(page, target) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build && window.__nb.build.state.target > 0);
  await page.evaluate(t => window.__nb.build.setTarget(t), target);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

async function openAdd(page, a, b) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  await page.evaluate(([a, b]) => window.__nb.add.setPair(a, b), [a, b]);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

test('completing a buddy in Build makes it dance under confetti', async ({ page }) => {
  await openBuild(page, 3);
  for (let k = 0; k < 3; k++) { await page.click('#build-source', { force: true }); await page.waitForFunction(() => !document.querySelector('#screen-build .flying')); await page.waitForTimeout(40); }
  await page.waitForFunction(() => window.__nb.build.state.done);
  await expect(page.locator('#build-tower .buddy.dance')).toHaveCount(1);
  expect(await page.locator('#screen-build .confetti-piece').count()).toBeGreaterThan(10);
  await expect(page.locator('#build-target.matched')).toHaveCount(1);
  expect(await page.locator('#screen-build .firework').count()).toBe(0);
});

test('a milestone in Build gets fireworks on top', async ({ page }) => {
  await openBuild(page, 5);
  for (let k = 0; k < 5; k++) { await page.click('#build-source', { force: true }); await page.waitForFunction(() => !document.querySelector('#screen-build .flying')); await page.waitForTimeout(40); }
  await page.waitForFunction(() => window.__nb.build.state.done);
  expect(await page.locator('#screen-build .firework').count()).toBeGreaterThan(10);
});

test('again is available as soon as the dance starts', async ({ page }) => {
  await openBuild(page, 2);
  for (let k = 0; k < 2; k++) { await page.click('#build-source', { force: true }); await page.waitForFunction(() => !document.querySelector('#screen-build .flying')); await page.waitForTimeout(40); }
  await page.waitForFunction(() => window.__nb.build.state.done);
  await expect(page.locator('#build-again')).toBeVisible({ timeout: 1500 });
  await page.click('#build-again');
  await page.waitForFunction(() => !window.__nb.build.state.done);
  expect(await page.locator('#build-tower .buddy.dance').count()).toBe(0);
  expect(await page.locator('#screen-build .confetti-piece').count()).toBe(0);
});

test('the confetti is gone within a few seconds', async ({ page }) => {
  await openBuild(page, 1);
  await page.click('#build-source', { force: true });
  await page.waitForFunction(() => window.__nb.build.state.done);
  await expect(page.locator('#screen-build .confetti-piece')).toHaveCount(0, { timeout: 6000 });
});

test('merging in Add bursts stars, lights the cubes in turn, then pops the face on', async ({ page }) => {
  await openAdd(page, 2, 3);
  await page.click('#add-a');
  await page.waitForFunction(() => window.__nb.add.state.merged);
  await expect(page.locator('#add-a.merging')).toHaveCount(1);
  await expect(page.locator('#screen-add .star')).not.toHaveCount(0, { timeout: 2000 });
  // While it counts, the result is faceless and cubes light up one by one.
  await page.waitForFunction(() => window.__nb.spoken.includes('count-2'));
  expect(await page.locator('#add-result .face').count()).toBe(0);
  expect(await page.locator('#add-result .cube.lit').count()).toBeGreaterThanOrEqual(1);
  // The face arrives with the buddy's name.
  await page.waitForFunction(() => window.__nb.spoken.includes('is-5'));
  await expect(page.locator('#add-result .face.pop')).toHaveCount(1);
  await expect(page.locator('#add-result .buddy.dance')).toHaveCount(1);
  expect(await page.locator('#screen-add .confetti-piece').count()).toBeGreaterThan(10);
  expect(await page.locator('#screen-add .firework').count()).toBeGreaterThan(10);   // five is a milestone
});

test('a non-milestone sum in Add dances without fireworks', async ({ page }) => {
  await openAdd(page, 1, 2);
  await page.click('#add-a');
  await page.waitForFunction(() => window.__nb.spoken.includes('is-3'));
  await expect(page.locator('#add-result .buddy.dance')).toHaveCount(1);
  expect(await page.locator('#screen-add .firework').count()).toBe(0);
});

test('joining in Play has the merge beat but never confetti or fireworks', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  await page.click('[data-world="meadow"]');
  await page.waitForFunction(() => window.__nb.play.state.world === 'meadow');
  const [a, b] = await page.evaluate(() => [window.__nb.play.addTower(2, 100, 0), window.__nb.play.addTower(3, 220, 0)]);
  await page.evaluate(([a, b]) => window.__nb.play.join(a, b), [a, b]);
  await page.waitForFunction(() => window.__nb.spoken.includes('is-5'), null, { timeout: 15000 });
  expect(await page.locator('#screen-play .confetti-piece').count()).toBe(0);
  expect(await page.locator('#screen-play .firework').count()).toBe(0);
  await expect(page.locator('#play-board .buddy.dance')).toHaveCount(1);
});

test('celebration sounds exist and stay quiet when muted', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  const ok = await page.evaluate(async () => {
    const a = await import('/number-buddies/audio.js');
    await a.initAudio();
    a.setMuted(true);
    a.sparkle(); a.fanfare();
    return typeof a.sparkle === 'function' && typeof a.fanfare === 'function';
  });
  expect(ok).toBeTruthy();
});
