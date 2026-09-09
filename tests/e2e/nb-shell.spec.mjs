import { test, expect } from '@playwright/test';

test('launcher lists both games and opens Number Buddies', async ({ page }) => {
  await page.goto('/');
  const tile = page.locator('a.tile[href="./number-buddies/"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('Number Buddies');
  expect((await tile.boundingBox()).height).toBeGreaterThanOrEqual(120);
  await expect(page.locator('a.tile')).toHaveCount(2);
  await tile.click();
  await expect(page).toHaveURL(/\/number-buddies\//);
  await expect(page.locator('#screen-home')).toBeVisible();
});

test('the home screen offers exactly three modes', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await expect(page.locator('#screen-home [data-mode]')).toHaveCount(3);
  for (const mode of ['build', 'add', 'play']) {
    await expect(page.locator(`[data-mode="${mode}"]`)).toBeVisible();
  }
});

test('each mode opens and the home arrow comes back', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  for (const mode of ['build', 'add', 'play']) {
    await page.click(`[data-mode="${mode}"]`);
    await expect(page.locator(`#screen-${mode}`)).toBeVisible();
    await expect(page.locator('#screen-home')).toBeHidden();
    await page.click('#btn-home');
    await expect(page.locator('#screen-home')).toBeVisible();
  }
});

test('viewport is locked and the play area refuses browser gestures', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(vp).toContain('user-scalable=no');
  expect(vp).toContain('maximum-scale=1');
  expect(await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior)).toBe('none');
  await page.click('[data-mode="build"]');
  expect(await page.locator('#screen-build').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
});

test('every visible button is at least 56px square', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  const boxes = await page.locator('button:visible').evaluateAll(els =>
    els.map(el => { const r = el.getBoundingClientRect(); return { id: el.id || el.dataset.mode, w: r.width, h: r.height }; }));
  expect(boxes.length).toBeGreaterThanOrEqual(4);
  for (const b of boxes) {
    expect(b.w, `${b.id} width`).toBeGreaterThanOrEqual(56);
    expect(b.h, `${b.id} height`).toBeGreaterThanOrEqual(56);
  }
});

test('there are no links and no requests to other origins', async ({ page }) => {
  const foreign = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost:4173')) foreign.push(r.url()); });
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  expect(await page.locator('a[href]').count()).toBe(0);
  expect(foreign).toEqual([]);
});

test('manifest, icons and service worker are served', async ({ request }) => {
  const m = await request.get('/number-buddies/manifest.webmanifest');
  expect(m.ok()).toBeTruthy();
  const json = await m.json();
  expect(json.name).toBe('Number Buddies');
  expect(json.display).toBe('standalone');
  expect(json.start_url).toBe('./index.html');
  for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
    const r = await request.get(`/number-buddies/${f}`);
    expect(r.ok(), f).toBeTruthy();
    expect(r.headers()['content-type']).toBe('image/png');
  }
  expect((await request.get('/number-buddies/sw.js')).ok()).toBeTruthy();
});

test('the service worker caches every file the game needs', async ({ request }) => {
  const sw = await (await request.get('/number-buddies/sw.js')).text();
  for (const f of ['./index.html', './style.css', './game.js', './blocks.js', './render.js', './audio.js', './voice/manifest.json']) {
    expect(sw, f).toContain(f);
  }
});

test('every voice clip in the manifest is actually served', async ({ request }) => {
  const { clips } = await (await request.get('/number-buddies/voice/manifest.json')).json();
  const ids = Object.keys(clips);
  expect(ids.length).toBeGreaterThan(80);
  for (const id of ['count-1', 'is-1', 'is-10', 'make-5', 'cheer-1', 'join', 'nudge-tap']) {
    expect(ids, id).toContain(id);
  }
  const r = await request.get(`/number-buddies/voice/${clips['make-5']}`);
  expect(r.ok()).toBeTruthy();
  expect(r.headers()['content-type']).toBe('audio/mp4');
});

test('the home screen shows which version is running', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await expect(page.locator('#version')).toHaveText(/^v(\d+|\?)$/, { timeout: 5000 });
});
