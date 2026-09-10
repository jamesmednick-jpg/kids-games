import { test, expect } from '@playwright/test';

// Add: a challenge on a little world with the same physics as Play. Two
// buddies stand apart with a ghost of the answer between them; carry one to
// the other — push them together or drop one on top — and they add up.

async function openAdd(page, a = null, b = null) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  if (a) await page.evaluate(([a, b]) => window.__nb.add.setPair(a, b), [a, b]);
  await page.waitForFunction(() => window.__nb.add.state.towers.every(t => t.resting));
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

const tower = (page, i) => page.locator('#add-board .tower').nth(i);
const grip = async (page, i) => { const b = await tower(page, i).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height - 20 }; };

// Carry the first buddy over and drop it onto the second.
async function dropOnto(page) {
  const from = await grip(page, 0);
  const to = await tower(page, 1).boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y - 80, { steps: 14 });
  await page.waitForTimeout(60);
  await page.mouse.up();
}

// Carry the first buddy sideways into the second along the ground.
async function pushInto(page) {
  const from = await grip(page, 0);
  const to = await tower(page, 1).boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, from.y, { steps: 16 });
  await page.waitForTimeout(60);
  await page.mouse.up();
}

const merged = page => page.waitForFunction(() => window.__nb.add.state.merged, null, { timeout: 15000 });

test('the first challenge is always One and One, asked out loud, with a ghost of the answer', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  const { a, b } = await page.evaluate(() => window.__nb.add.state);
  expect([a, b]).toEqual([1, 1]);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('add-1-1');
  await expect(page.locator('#add-target.ghost .cube')).toHaveCount(2);
  await expect(page.locator('#add-target .sign')).toHaveText('2');
});

test('two buddies stand on the ground apart, with a plus between them', async ({ page }) => {
  await openAdd(page, 2, 3);
  await expect(page.locator('#add-board .tower')).toHaveCount(2);
  expect(await tower(page, 0).locator('.cube').count()).toBe(2);
  expect(await tower(page, 1).locator('.cube').count()).toBe(3);
  await expect(page.locator('#add-plus')).toBeVisible();
  const ys = await page.evaluate(() => window.__nb.add.state.towers.map(t => t.y));
  expect(ys).toEqual([0, 0]);
  const a = await tower(page, 0).boundingBox(), b = await tower(page, 1).boundingBox();
  expect(b.x - (a.x + a.width)).toBeGreaterThan(80);
});

test('both buddies and the ghost share one cube size', async ({ page }) => {
  await openAdd(page, 2, 3);
  const w = await page.locator('#add-board .cube, #add-target .cube').evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
  expect(Math.max(...w) - Math.min(...w)).toBeLessThan(1);
  expect(Math.min(...w)).toBeGreaterThanOrEqual(44);
});

test('she can carry a buddy anywhere and drop it, and it just falls back down', async ({ page }) => {
  await openAdd(page, 2, 3);
  const from = await grip(page, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y - 220, { steps: 10 });
  await page.waitForTimeout(80);
  const held = await page.evaluate(() => window.__nb.add.state.towers[0]);
  expect(held.y).toBeGreaterThan(150);
  await page.mouse.up();
  await page.waitForFunction(() => window.__nb.add.state.towers.every(t => t.resting), null, { timeout: 5000 });
  const t = await page.evaluate(() => window.__nb.add.state.towers[0]);
  expect(t.y).toBe(0);
  expect(await page.locator('#add-board .tower').count()).toBe(2);      // no merge: they never touched
  expect(await page.evaluate(() => window.__nb.add.state.merged)).toBe(false);
});

test('dropping one buddy onto the other adds them up', async ({ page }) => {
  await openAdd(page, 2, 3);
  await dropOnto(page);
  await merged(page);
  await expect(page.locator('#add-board .tower')).toHaveCount(1);
  await expect(page.locator('#add-board .tower .sign')).toHaveText('5');
  expect(await page.locator('#add-board .tower .cube').count()).toBe(5);
});

test('pushing them together along the ground adds them up too', async ({ page }) => {
  await openAdd(page, 4, 1);
  await pushInto(page);
  await merged(page);
  await expect(page.locator('#add-board .tower')).toHaveCount(1);
  expect(await page.evaluate(() => window.__nb.add.state.towers[0].n)).toBe(5);
});

test('the merged tower recounts from one, then says the sum plainly, then hello', async ({ page }) => {
  await openAdd(page, 2, 3);
  await dropOnto(page);
  await page.waitForFunction(() => window.__nb.spoken.includes('is-5'), null, { timeout: 15000 });
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.filter(id => id.startsWith('count-'))).toEqual(['count-1', 'count-2', 'count-3', 'count-4', 'count-5']);
  expect(spoken).toContain('join');
  expect(spoken.indexOf('sum-2-3')).toBeGreaterThan(spoken.indexOf('count-5'));
  expect(spoken.indexOf('sum-2-3')).toBeLessThan(spoken.indexOf('is-5'));
  expect(spoken.some(id => id.startsWith('cheer-'))).toBeTruthy();
  await expect(page.locator('#add-target.matched')).toHaveCount(1);
});

test('again offers a new challenge within the maximum', async ({ page }) => {
  await openAdd(page);
  await dropOnto(page);
  await merged(page);
  await page.waitForSelector('#add-again:not([hidden])');
  await page.click('#add-again');
  await page.waitForFunction(() => !window.__nb.add.state.merged);
  const { a, b, max } = await page.evaluate(() => ({ a: window.__nb.add.state.a, b: window.__nb.add.state.b, max: window.__nb.settings.MAX_NUMBER }));
  expect(a).toBeGreaterThanOrEqual(1);
  expect(b).toBeGreaterThanOrEqual(1);
  expect(a + b).toBeLessThanOrEqual(max);
  await expect(page.locator('#add-board .tower')).toHaveCount(2);
});

test('a Ten never ends up under the again button', async ({ page }) => {
  await openAdd(page, 5, 5);
  await dropOnto(page);
  await merged(page);
  await page.waitForSelector('#add-again:not([hidden])');
  const hit = await page.evaluate(() => {
    const b = document.getElementById('add-again');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el === b || b.contains(el);
  });
  expect(hit).toBeTruthy();
  await page.click('#add-again');
  await page.waitForFunction(() => !window.__nb.add.state.merged);
});

test('challenges ramp: the first few sums are small', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  const sums = [];
  for (let i = 0; i < 4; i++) {          // four challenges have sums of four or less
    sums.push(await page.evaluate(() => window.__nb.add.state.a + window.__nb.add.state.b));
    await page.evaluate(() => window.__nb.add.nextPair());
  }
  expect(Math.max(...sums)).toBeLessThanOrEqual(4);
});

test('pairs always sum within the maximum across many draws', async ({ page }) => {
  await openAdd(page);
  for (let i = 0; i < 25; i++) {
    const { a, b, max } = await page.evaluate(() => {
      window.__nb.add.nextPair();
      return { a: window.__nb.add.state.a, b: window.__nb.add.state.b, max: window.__nb.settings.MAX_NUMBER };
    });
    expect(a + b, `${a}+${b}`).toBeLessThanOrEqual(max);
  }
});

// ---- the idle nudge ----

async function openAddFast(page, delay = 250) {
  await page.goto(`/number-buddies/index.html?nudge=${delay}`);
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

test('after a pause both buddies glow', async ({ page }) => {
  await openAddFast(page);
  await expect(page.locator('#add-board .tower.hint')).toHaveCount(2, { timeout: 3000 });
});

test('a longer pause asks her to push them together', async ({ page }) => {
  await openAddFast(page);
  await page.waitForFunction(() => window.__nb.spoken.includes('nudge-drag'), null, { timeout: 5000 });
});

test('merging stops the nudge', async ({ page }) => {
  await openAddFast(page, 400);
  await page.evaluate(() => window.__nb.add.setPair(1, 1));
  await page.waitForFunction(() => window.__nb.add.state.towers.every(t => t.resting));
  await dropOnto(page);
  await merged(page);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__nb.spoken)).not.toContain('nudge-drag');
});
