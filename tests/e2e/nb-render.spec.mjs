import { test, expect } from '@playwright/test';

// Renders a buddy into a scratch element on the real page, so CSS applies.
// Pass sizeFor to share one cube size with a taller buddy, as the game does.
async function draw(page, n, availableH = 520, sizeFor = null) {
  return page.evaluate(async ([n, availableH, sizeFor]) => {
    const { drawBuddy, cubeSizeFor } = await import('/number-buddies/render.js');
    let host = document.getElementById('scratch');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scratch';
      host.style.cssText = `position:fixed;left:0;top:0;width:390px;height:${availableH}px`;
      document.body.append(host);
    }
    const size = sizeFor ? cubeSizeFor(availableH, sizeFor) : null;
    const el = drawBuddy(host, n, { availableH, size });
    return {
      height: el.querySelector('.parts').getBoundingClientRect().height,
      cubes: el.querySelectorAll('.cube').length,
      parts: [...el.querySelectorAll('.part')].map(p => Number(p.dataset.partN)),
      faces: el.querySelectorAll('.face').length,
      features: el.querySelectorAll('.feature-shape').length,
      sign: el.querySelector('.sign').textContent,
      signBox: el.querySelector('.sign').getBoundingClientRect().width,
      cubeBox: el.querySelector('.cube').getBoundingClientRect().width,
      color: getComputedStyle(el.querySelector('.cube')).backgroundColor,
    };
  }, [n, availableH, sizeFor]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  // These tests measure geometry; hold the buddies still while we do.
  await page.addStyleTag({ content: '.buddy * { animation: none !important; }' });
});

test('a buddy has exactly N cubes', async ({ page }) => {
  for (const n of [1, 2, 5, 7, 10]) {
    expect((await draw(page, n)).cubes, `n=${n}`).toBe(n);
  }
});

test('the numeral sign shows the number', async ({ page }) => {
  expect((await draw(page, 7)).sign).toBe('7');
  expect((await draw(page, 10)).sign).toBe('10');
});

test('the numeral sign is the same size for a One and a Ten', async ({ page }) => {
  const one = await draw(page, 1);
  const ten = await draw(page, 10);
  expect(ten.cubeBox).toBeLessThan(one.cubeBox);      // cubes shrink
  expect(ten.signBox).toBeCloseTo(one.signBox, 0);    // the sign does not
});

test('buddies sharing a scene share one cube size, so heights are proportional', async ({ page }) => {
  const one = await draw(page, 1, 520, 10);
  const nine = await draw(page, 9, 520, 10);
  const ten = await draw(page, 10, 520, 10);
  expect(one.cubeBox).toBeCloseTo(ten.cubeBox, 1);
  expect(nine.cubeBox).toBeCloseTo(ten.cubeBox, 1);
  expect(ten.height).toBeGreaterThan(nine.height + ten.cubeBox * 0.9);   // one whole cube taller
  expect(ten.height / one.height).toBeGreaterThan(9);
});

test('cubes never fall below the tappable minimum', async ({ page }) => {
  expect((await draw(page, 10, 200)).cubeBox).toBeGreaterThanOrEqual(44);
});

test('exactly one face, on the buddy', async ({ page }) => {
  for (const n of [1, 4, 10]) expect((await draw(page, n)).faces, `n=${n}`).toBe(1);
});

test('each buddy wears N of its own decoration', async ({ page }) => {
  for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 10]) {
    expect((await draw(page, n)).features, `n=${n}`).toBe(n);
  }
  expect((await draw(page, 5)).features, 'five wears one five-pointed star').toBe(1);
});

test('each number has its own colour', async ({ page }) => {
  const seen = new Set();
  for (let n = 1; n <= 10; n++) seen.add((await draw(page, n)).color);
  expect(seen.size).toBe(10);
});

test('above ten a buddy is a ten beside its remainder', async ({ page }) => {
  const thirteen = await draw(page, 13);
  expect(thirteen.parts).toEqual([10, 3]);
  expect(thirteen.cubes).toBe(13);
  expect(thirteen.sign).toBe('13');
});
