import { test, expect } from '@playwright/test';

async function openAdd(page, a = null, b = null) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  if (a) await page.evaluate(([a, b]) => window.__nb.add.setPair(a, b), [a, b]);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

async function dragTogether(page) {
  const from = await page.locator('#add-a').boundingBox();
  const to = await page.locator('#add-b').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('two buddies stand apart with a plus between them', async ({ page }) => {
  await openAdd(page, 2, 3);
  expect(await page.locator('#add-a .cube').count()).toBe(2);
  expect(await page.locator('#add-b .cube').count()).toBe(3);
  await expect(page.locator('#add-plus')).toBeVisible();
  await expect(page.locator('#add-a .sign')).toHaveText('2');
  await expect(page.locator('#add-b .sign')).toHaveText('3');
});

test('both buddies and the result share one cube size', async ({ page }) => {
  await openAdd(page, 2, 3);
  const a = await page.locator('#add-a .cube').first().boundingBox();
  const b = await page.locator('#add-b .cube').first().boundingBox();
  expect(a.width).toBeCloseTo(b.width, 0);
  await dragTogether(page);
  await page.waitForSelector('#add-result .cube');
  const r = await page.locator('#add-result .cube').first().boundingBox();
  expect(r.width).toBeCloseTo(a.width, 0);
});

test('dragging them together makes the sum', async ({ page }) => {
  await openAdd(page, 2, 3);
  await dragTogether(page);
  await page.waitForSelector('#add-result .cube');
  expect(await page.locator('#add-result .cube').count()).toBe(5);
  await expect(page.locator('#add-result .sign')).toHaveText('5');
  await expect(page.locator('#add-a')).toBeHidden();
  await expect(page.locator('#add-b')).toBeHidden();
});

test('the merged tower recounts from one, not on from the first addend', async ({ page }) => {
  await openAdd(page, 2, 3);
  await dragTogether(page);
  await page.waitForFunction(() => window.__nb.spoken.includes('is-5'));
  const spoken = await page.evaluate(() => window.__nb.spoken);
  const counts = spoken.filter(id => id.startsWith('count-'));
  expect(counts).toEqual(['count-1', 'count-2', 'count-3', 'count-4', 'count-5']);
  expect(spoken).toContain('join');
  expect(spoken).toContain('is-5');
  expect(spoken.some(id => id.startsWith('cheer-'))).toBeTruthy();
});

test('tapping instead of dragging also merges', async ({ page }) => {
  await openAdd(page, 4, 1);
  await page.click('#add-a');
  await page.waitForSelector('#add-result .cube');
  expect(await page.locator('#add-result .cube').count()).toBe(5);
});

test('a stalled drag hints rather than failing', async ({ page }) => {
  await openAdd(page, 2, 2);
  const box = await page.locator('#add-a').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__nb.add.state.merged)).toBe(false);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('nudge-drag');
});

test('again offers a new pair within the maximum', async ({ page }) => {
  await openAdd(page);
  await dragTogether(page);
  await page.waitForFunction(() => window.__nb.add.state.merged);
  await page.waitForSelector('#add-again:not([hidden])');
  await page.click('#add-again');
  await page.waitForFunction(() => !window.__nb.add.state.merged);
  const { a, b, max } = await page.evaluate(() => ({
    a: window.__nb.add.state.a, b: window.__nb.add.state.b, max: window.__nb.settings.MAX_NUMBER,
  }));
  expect(a).toBeGreaterThanOrEqual(1);
  expect(b).toBeGreaterThanOrEqual(1);
  expect(a + b).toBeLessThanOrEqual(max);
});

test('a Ten never ends up with a cube under the again button', async ({ page }) => {
  await openAdd(page, 5, 5);
  await page.click('#add-a');
  await page.waitForSelector('#add-again:not([hidden])');
  // What matters: a tap in the middle of "again" reaches the button, not a cube.
  const hit = await page.evaluate(() => {
    const b = document.getElementById('add-again');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el === b || b.contains(el);
  });
  expect(hit).toBeTruthy();
  const again = await page.locator('#add-again').boundingBox();
  const bottom = await page.locator('#add-result .cube').last().boundingBox();
  expect(bottom.y + bottom.height).toBeLessThanOrEqual(again.y + 12);   // the dance dips a corner a few px
  await page.click('#add-again');
  await page.waitForFunction(() => !window.__nb.add.state.merged);
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
  await expect(page.locator('#add-a.hint')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#add-b.hint')).toBeVisible();
});

test('a longer pause asks her to push them together', async ({ page }) => {
  await openAddFast(page);
  await page.waitForFunction(() => window.__nb.spoken.includes('nudge-drag'), null, { timeout: 5000 });
});

test('merging stops the nudge', async ({ page }) => {
  await openAddFast(page, 400);
  await page.click('#add-a', { force: true });   // it may already be glowing, which Playwright counts as unstable
  await page.waitForFunction(() => window.__nb.add.state.merged);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__nb.spoken)).not.toContain('nudge-drag');
});
