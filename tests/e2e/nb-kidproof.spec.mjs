import { test, expect } from '@playwright/test';

const MODES = ['build', 'add', 'play'];

test('rapid random tapping never breaks the game', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/number-buddies/index.html');
  const size = page.viewportSize();
  for (const mode of MODES) {
    await page.click(`[data-mode="${mode}"]`);
    for (let i = 0; i < 60; i++) {
      await page.mouse.click(Math.random() * size.width, 90 + Math.random() * (size.height - 180));
    }
    await page.click('#btn-home');
    await expect(page.locator('#screen-home')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('there is no way out of the game', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  expect(await page.locator('a[href]').count()).toBe(0);
  for (const mode of MODES) {
    await page.click(`[data-mode="${mode}"]`);
    expect(await page.locator('a[href]').count(), mode).toBe(0);
    await page.click('#btn-home');
  }
});

test('nothing is selectable or zoomable', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none');
  expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior)).toBe('none');
});

test('switching modes repeatedly leaves no stale towers', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  for (let i = 0; i < 4; i++) {
    for (const mode of MODES) {
      await page.click(`[data-mode="${mode}"]`);
      await page.click('#btn-home');
    }
  }
  await page.click('[data-mode="build"]');
  expect(await page.locator('#build-tower .cube').count()).toBe(0);
  await page.click('#btn-home');
  await page.click('[data-mode="play"]');
  await page.click('[data-world="meadow"]');
  expect(await page.locator('#play-board .tower').count()).toBe(0);
});

test('mute survives moving between modes', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('#btn-mute');
  for (const mode of MODES) {
    await page.click(`[data-mode="${mode}"]`);
    expect(await page.evaluate(() => window.__nb.state.muted), mode).toBe(true);
    await expect(page.locator('#btn-mute')).toHaveText('🔇');
    await page.click('#btn-home');
  }
});

test('the home tiles show real buddies, not emoji', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  expect(await page.locator('[data-pic="build"] .cube').count()).toBe(3);
  expect(await page.locator('[data-pic="add"] .cube').count()).toBe(5);
  expect(await page.locator('[data-pic="play"] .buddy').count()).toBe(3);
});

test('a tower let go above the world falls back into it, sign and all', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  await page.click('[data-world="meadow"]');
  await page.waitForFunction(() => window.__nb.play.state.world === 'meadow');
  const x = await page.evaluate(() => {
    const W = document.getElementById('play-board').clientWidth, ps = window.__nb.play.state.platforms;
    for (let x = W - 44; x >= 0; x -= 4) if (!ps.some(p => Math.min(p.left + p.width, x + 44) - Math.max(p.left, x) > 0)) return x;
    return 0;
  });
  await page.evaluate(x => window.__nb.play.addTower(3, x, 0), x);
  await page.waitForFunction(() => window.__nb.play.state.towers.every(t => t.resting));
  const t = await page.locator('#play-board .tower').boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height - 20);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, 0, { steps: 8 });   // way past the top
  await page.mouse.up();
  await page.waitForFunction(() => window.__nb.play.state.towers.every(t => t.resting), null, { timeout: 5000 });
  const board = await page.locator('#play-board').boundingBox();
  const sign = await page.locator('#play-board .sign').boundingBox();
  expect(sign.y).toBeGreaterThanOrEqual(board.y - 1);
  expect(sign.y + sign.height).toBeLessThanOrEqual(board.y + board.height + 1);
});

test('nothing anywhere hard-codes ten in place of the parent setting', async ({ request }) => {
  for (const f of ['build.js', 'add.js', 'play.js']) {
    const src = await (await request.get(`/number-buddies/${f}`)).text();
    expect(src, `${f} should take its maximum from game.js`).toContain('max');
    expect(src, `${f} must not hard-code 10`).not.toMatch(/\b(?:max|MAX)\s*[=:]\s*10\b/);
  }
});

test('the game honours MAX_NUMBER, whatever it is set to', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  const max = await page.evaluate(() => window.__nb.settings.MAX_NUMBER);
  expect([10, 20]).toContain(max);
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  for (let i = 0; i < 25; i++) {
    const t = await page.evaluate(() => { window.__nb.build.nextTarget(); return window.__nb.build.state.target; });
    expect(t, `target ${t} exceeds MAX_NUMBER ${max}`).toBeLessThanOrEqual(max);
  }
});
