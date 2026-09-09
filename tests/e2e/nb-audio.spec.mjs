import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/number-buddies/index.html'); });

test('the clip manifest loads and the game can name a clip', async ({ page }) => {
  const ok = await page.evaluate(async () => {
    const a = await import('/number-buddies/audio.js');
    await a.initAudio();
    a.setMuted(true);
    await a.say('make-5');
    return window.__nb.spoken.includes('make-5');
  });
  expect(ok).toBeTruthy();
});

test('spoken clips are recorded in order', async ({ page }) => {
  const spoken = await page.evaluate(async () => {
    const a = await import('/number-buddies/audio.js');
    await a.initAudio();
    a.setMuted(true);
    window.__nb.spoken.length = 0;
    await a.sayAll(['count-1', 'count-2', 'count-3']);
    return window.__nb.spoken;
  });
  expect(spoken).toEqual(['count-1', 'count-2', 'count-3']);
});

test('an unknown clip warns but does not throw', async ({ page }) => {
  const warnings = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  const ok = await page.evaluate(async () => {
    const a = await import('/number-buddies/audio.js');
    await a.initAudio();
    a.setMuted(true);
    await a.say('not-a-clip');
    return true;
  });
  expect(ok).toBeTruthy();
  expect(warnings.join(' ')).toContain('not-a-clip');
});

test('muting silences sound but still records what was asked for', async ({ page }) => {
  const spoken = await page.evaluate(async () => {
    const a = await import('/number-buddies/audio.js');
    await a.initAudio();
    a.setMuted(true);
    window.__nb.spoken.length = 0;
    await a.say('cheer-1');
    a.thunk(); a.step(3); a.clunk(); a.chime();
    return window.__nb.spoken;
  });
  expect(spoken).toEqual(['cheer-1']);
});

test('the mute button toggles and shows its state', async ({ page }) => {
  await expect(page.locator('#btn-mute')).toHaveText('🔊');
  await page.click('#btn-mute');
  await expect(page.locator('#btn-mute')).toHaveText('🔇');
  expect(await page.evaluate(() => window.__nb.state.muted)).toBe(true);
  await page.click('#btn-mute');
  expect(await page.evaluate(() => window.__nb.state.muted)).toBe(false);
});

test('tapping a mode tile speaks its name', async ({ page }) => {
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.spoken && window.__nb.spoken.includes('mode-build'));
});
