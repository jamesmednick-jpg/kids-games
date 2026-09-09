import { test, expect } from '@playwright/test';

async function openBuild(page, target = null) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build && window.__nb.build.state.target > 0);
  if (target) await page.evaluate(t => window.__nb.build.setTarget(t), target);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  return page.evaluate(() => window.__nb.build.state.target);
}

// A tap sends a cube flying; it is only counted once it lands.
const tap = async page => {
  await page.click('#build-source', { force: true });
  await page.waitForFunction(() => !document.querySelector('#screen-build .flying'));
  await page.waitForTimeout(60);
};

test('the game asks for a target and shows a ghost of it', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  const target = await page.evaluate(() => window.__nb.build.state.target);
  const max = await page.evaluate(() => window.__nb.settings.MAX_NUMBER);
  expect(target).toBeGreaterThanOrEqual(1);
  expect(target).toBeLessThanOrEqual(max);
  expect(await page.locator('#build-target .cube').count()).toBe(target);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain(`make-${target}`);
});

test('each tap adds one cube and counts it aloud', async ({ page }) => {
  await openBuild(page, 5);
  for (let k = 1; k <= 3; k++) {
    await tap(page);
    expect(await page.locator('#build-tower .cube').count(), `after ${k}`).toBe(k);
  }
  expect(await page.evaluate(() => window.__nb.spoken)).toEqual(['count-1', 'count-2', 'count-3']);
});

test('her tower and the ghost use the same cube size', async ({ page }) => {
  await openBuild(page, 7);
  await tap(page);
  const ghost = await page.locator('#build-target .cube').first().boundingBox();
  const hers = await page.locator('#build-tower .cube').first().boundingBox();
  expect(hers.width).toBeCloseTo(ghost.width, 0);
  expect(hers.width).toBeGreaterThanOrEqual(44);
});

test('reaching the target celebrates and introduces the buddy', async ({ page }) => {
  await openBuild(page, 4);
  for (let k = 0; k < 4; k++) await tap(page);
  await page.waitForFunction(() => window.__nb.build.state.done);
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.slice(0, 4)).toEqual(['count-1', 'count-2', 'count-3', 'count-4']);
  expect(spoken).toContain('is-4');
  expect(spoken.some(id => id.startsWith('cheer-'))).toBeTruthy();
  await expect(page.locator('#build-tower .face')).toHaveCount(1);
  await expect(page.locator('#build-again')).toBeVisible();
});

test('the tower carries the finished buddy\'s feature', async ({ page }) => {
  await openBuild(page, 3);
  for (let k = 0; k < 3; k++) await tap(page);
  await page.waitForFunction(() => window.__nb.build.state.done);
  await expect(page.locator('#build-tower .feature-shape')).toHaveCount(3);
});

test('overshoot is met kindly, never with a refusal', async ({ page }) => {
  await openBuild(page, 3);
  for (let k = 0; k < 4; k++) await tap(page);
  expect(await page.locator('#build-tower .cube').count()).toBe(4);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('over-4');
  await expect(page.locator('#build-tower .cube[data-extra]')).toHaveCount(1);
});

test('tapping an extra cube removes it and gets back to the celebration', async ({ page }) => {
  await openBuild(page, 3);
  for (let k = 0; k < 4; k++) await tap(page);
  // The extra cube jiggles forever; Playwright waits for stillness before a
  // click, a child's finger does not. Force it.
  await page.click('#build-tower .cube[data-extra]', { force: true });
  await page.waitForFunction(() => window.__nb.build.state.done);
  expect(await page.locator('#build-tower .cube').count()).toBe(3);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-3');
});

test('again offers a different target', async ({ page }) => {
  const first = await openBuild(page);
  await page.evaluate(() => window.__nb.build.setTarget(window.__nb.build.state.target));
  for (let k = 0; k < first; k++) await tap(page);
  await page.waitForFunction(() => window.__nb.build.state.done);
  await page.click('#build-again');
  await page.waitForFunction(t => window.__nb.build.state.target !== t && !window.__nb.build.state.done, first);
  expect(await page.locator('#build-tower .cube').count()).toBe(0);
});

test('targets never exceed the parent setting', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  const max = await page.evaluate(() => window.__nb.settings.MAX_NUMBER);
  for (let i = 0; i < 25; i++) {
    const t = await page.evaluate(() => { window.__nb.build.nextTarget(); return window.__nb.build.state.target; });
    expect(t).toBeGreaterThanOrEqual(1);
    expect(t).toBeLessThanOrEqual(max);
  }
});

test('leaving and coming back does not double up the tower', async ({ page }) => {
  await openBuild(page, 5);
  await tap(page);
  await page.click('#btn-home');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build.state.height === 0);
  expect(await page.locator('#build-tower .cube').count()).toBe(0);
});

// ---- the idle nudge ----

async function openBuildFast(page, delay = 250) {
  await page.goto(`/number-buddies/index.html?nudge=${delay}`);
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

test('after a pause the cube to tap glows', async ({ page }) => {
  await openBuildFast(page);
  await expect(page.locator('#build-source.hint')).toBeVisible({ timeout: 3000 });
});

test('a longer pause adds a spoken nudge', async ({ page }) => {
  await openBuildFast(page);
  await page.waitForFunction(() => window.__nb.spoken.includes('nudge-tap'), null, { timeout: 5000 });
});

test('touching the cube resets the nudge', async ({ page }) => {
  await openBuildFast(page, 900);
  await page.click('#build-source', { force: true });
  await page.waitForTimeout(500);
  expect(await page.locator('#build-source.hint').count()).toBe(0);
});

test('the nudge never advances the game for her', async ({ page }) => {
  await openBuildFast(page);
  const target = await page.evaluate(() => window.__nb.build.state.target);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__nb.build.state.height)).toBe(0);
  expect(await page.evaluate(() => window.__nb.build.state.target)).toBe(target);
});

test('a finished buddy stops nudging', async ({ page }) => {
  await openBuildFast(page, 400);
  await page.evaluate(() => window.__nb.build.setTarget(1));
  await page.click('#build-source', { force: true });
  await page.waitForFunction(() => window.__nb.build.state.done);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__nb.spoken)).not.toContain('nudge-tap');
});
