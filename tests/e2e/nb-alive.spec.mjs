import { test, expect } from '@playwright/test';

// The buddies are never still: they breathe, blink, look at her finger,
// wriggle when held, and sparkle when they move or meet.

async function openAdd(page, a = 2, b = 3) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="add"]');
  await page.waitForFunction(() => window.__nb.add && window.__nb.add.state.a > 0);
  await page.evaluate(([a, b]) => window.__nb.add.setPair(a, b), [a, b]);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

const center = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height - 30 };
};

test('every buddy on every screen is alive', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  expect(await page.locator('.buddy').count()).toBeGreaterThan(0);
  for (const mode of ['build', 'add', 'play']) {
    await page.click(`[data-mode="${mode}"]`);
    if (mode === 'play') await page.evaluate(() => window.__nb.play.addTower(3));
    await page.waitForSelector(`#screen-${mode} .buddy`);
    const all = await page.locator(`#screen-${mode} .buddy`).count();
    const alive = await page.locator(`#screen-${mode} .buddy.alive`).count();
    expect(alive, mode).toBe(all);
    await page.click('#btn-home');
  }
  expect(await page.locator('#screen-home .buddy.alive').count()).toBe(await page.locator('#screen-home .buddy').count());
});

test('buddies breathe and blink', async ({ page }) => {
  await openAdd(page);
  const names = await page.locator('#add-a .parts').evaluate(el => getComputedStyle(el).animationName);
  expect(names).toContain('breathe');
  expect(await page.locator('#add-a .face .lid').count()).toBe(2);
  const lidAnim = await page.locator('#add-a .face .lid').first().evaluate(el => getComputedStyle(el).animationName);
  expect(lidAnim).toContain('blink');
});

test('eyes follow her finger', async ({ page }) => {
  await openAdd(page);
  const b = await page.locator('#add-b').boundingBox();
  await page.mouse.move(10, b.y + 10);
  await page.waitForTimeout(80);
  const left = await page.locator('#add-b .face').evaluate(el => parseFloat(el.style.getPropertyValue('--px')));
  await page.mouse.move(380, b.y + 10);
  await page.waitForTimeout(80);
  const right = await page.locator('#add-b .face').evaluate(el => parseFloat(el.style.getPropertyValue('--px')));
  expect(left).toBeLessThan(0);
  expect(right).toBeGreaterThan(0);
});

test('a held buddy lifts, leans into the drag, trails sparkles, and settles when let go', async ({ page }) => {
  await openAdd(page);
  const from = await center(page, '#add-a');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect(page.locator('#add-a.held')).toHaveCount(1);
  expect((await page.evaluate(() => window.__nb.spoken)).some(id => id.startsWith('pickup-'))).toBeTruthy();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(from.x + i * 12, from.y, { steps: 1 }); await page.waitForTimeout(16); }
  const lean = await page.locator('#add-a').evaluate(el => parseFloat(el.style.getPropertyValue('--lean')));
  expect(lean).toBeGreaterThan(0);
  expect(await page.locator('#screen-add .spark').count()).toBeGreaterThan(0);
  await page.mouse.move(from.x + 40, from.y, { steps: 2 });   // a little back, not a merge
  await page.mouse.up();
  await expect(page.locator('#add-a.held')).toHaveCount(0);
  await expect(page.locator('#add-a.settle')).toHaveCount(1);
});

test('the other buddy beckons as she brings one close, with sparkles between them', async ({ page }) => {
  await openAdd(page);
  const from = await center(page, '#add-a');
  const to = await center(page, '#add-b');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) * 0.55, from.y, { steps: 6 });
  await page.waitForTimeout(150);
  await expect(page.locator('#add-b.beckon')).toHaveCount(1);
  expect(await page.locator('#screen-add .spark').count()).toBeGreaterThan(0);
  await page.mouse.move(from.x, from.y, { steps: 4 });
  await page.waitForTimeout(100);
  await expect(page.locator('#add-b.beckon')).toHaveCount(0);
  await page.mouse.up();
});

test('coming together flashes, then glitters the whole time it counts', async ({ page }) => {
  await openAdd(page, 3, 4);
  await page.click('#add-a');
  await expect(page.locator('#screen-add .flash')).not.toHaveCount(0, { timeout: 1500 });
  await page.waitForFunction(() => window.__nb.spoken.includes('count-3'));
  expect(await page.locator('#screen-add .spark').count()).toBeGreaterThan(0);
  await page.waitForFunction(() => window.__nb.spoken.includes('is-7'));
});

test('in Build the cube flies from the button onto the tower and lands with sparkles', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build && window.__nb.build.state.target > 0);
  await page.evaluate(() => window.__nb.build.setTarget(4));
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.click('#build-source', { force: true });
  await expect(page.locator('#screen-build .flying')).toHaveCount(1);
  expect(await page.evaluate(() => window.__nb.spoken)).toEqual([]);          // not counted until it lands
  await expect(page.locator('#screen-build .flying')).toHaveCount(0, { timeout: 2000 });
  await page.waitForFunction(() => window.__nb.spoken.includes('count-1'));
  expect(await page.locator('#screen-build .spark').count()).toBeGreaterThan(0);
  expect(await page.locator('#build-tower .cube').count()).toBe(1);
});

test('the tap-cube bobs invitingly all the time', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  const anim = await page.locator('#build-source').evaluate(el => getComputedStyle(el).animationName);
  expect(anim).toContain('bob');
});

test('in Play a held tower wriggles and sparkles, and still no confetti', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  await page.evaluate(() => window.__nb.play.addTower(3, 60, 40));
  const t = await page.locator('#play-board .tower').boundingBox();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height - 20);
  await page.mouse.down();
  await expect(page.locator('#play-board .tower.held')).toHaveCount(1);
  for (let i = 1; i <= 6; i++) { await page.mouse.move(t.x + t.width / 2 + i * 14, t.y + t.height - 20, { steps: 1 }); await page.waitForTimeout(16); }
  expect(await page.locator('#screen-play .spark').count()).toBeGreaterThan(0);
  await page.mouse.up();
  await expect(page.locator('#play-board .tower.held')).toHaveCount(0);
  expect(await page.locator('#screen-play .confetti-piece').count()).toBe(0);
});
