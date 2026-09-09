import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SUPPORTED, COLORS, FEATURES, towerParts, joinTowers, splitTower, cubeSize,
  characterPitch, characterRate, countPitch, makeTargetBag, makeAddBag,
} from '../../number-buddies/blocks.js';

test('every number 1..10 has a colour and a feature', () => {
  for (let n = 1; n <= 10; n++) {
    assert.match(COLORS[n], /^#[0-9a-f]{6}$/i, `colour ${n}`);
    assert.ok(FEATURES[n], `feature ${n}`);
  }
  assert.equal(Object.keys(COLORS).length, 10);
  assert.equal(new Set(Object.values(FEATURES)).size, 10, 'features are distinct');
});

test('towers up to ten are one part', () => {
  for (let n = 1; n <= 10; n++) assert.deepEqual(towerParts(n), [n]);
});

test('towers above ten are a ten plus the remainder', () => {
  assert.deepEqual(towerParts(13), [10, 3]);
  assert.deepEqual(towerParts(20), [10, 10]);
  assert.deepEqual(towerParts(11), [10, 1]);
});

test('parts always sum to the number', () => {
  for (let n = 1; n <= MAX_SUPPORTED; n++) {
    assert.equal(towerParts(n).reduce((a, b) => a + b, 0), n, `n=${n}`);
  }
});

test('joining two towers gives the summed height', () => {
  assert.equal(joinTowers(2, 3, 10), 5);
  assert.equal(joinTowers(1, 9, 10), 10);
});

test('joining refuses to pass the maximum, rather than clipping', () => {
  assert.equal(joinTowers(9, 9, 10), null);
  assert.equal(joinTowers(9, 9, 20), 18);
});

test('splitting pops the top cube off', () => {
  assert.deepEqual(splitTower(4), [3, 1]);
  assert.deepEqual(splitTower(2), [1, 1]);
});

test('splitting a One does nothing — there is no zero buddy', () => {
  assert.equal(splitTower(1), null);
});

test('split halves always sum to the original', () => {
  for (let n = 2; n <= MAX_SUPPORTED; n++) {
    const [a, b] = splitTower(n);
    assert.equal(a + b, n, `n=${n}`);
    assert.ok(a >= 1 && b >= 1, `n=${n} produced a zero`);
  }
});

test('cubes shrink to fit but never below the tappable minimum', () => {
  assert.equal(cubeSize(600, 1, { gap: 4, min: 44, max: 72 }), 72);
  assert.ok(cubeSize(600, 10, { gap: 4, min: 44, max: 72 }) <= 60);
  assert.equal(cubeSize(200, 10, { gap: 4, min: 44, max: 72 }), 44, 'clamped, not tiny');
});

test('cubes and gaps fit the space whenever the minimum allows', () => {
  const n = 10, gap = 4, avail = 700;
  const s = cubeSize(avail, n, { gap, min: 44, max: 72 });
  assert.ok(s * n + gap * (n - 1) <= avail + 1e-9);
});

test('character pitch falls from squeaky One to deep Ten', () => {
  assert.equal(characterPitch(1), 92);
  assert.equal(characterPitch(10), 42);
  for (let n = 2; n <= 10; n++) assert.ok(characterPitch(n) < characterPitch(n - 1), `n=${n}`);
});

test('little buddies talk faster than big ones', () => {
  assert.equal(characterRate(1), 205);
  assert.equal(characterRate(10), 178);
});

test('the counting pitch rises with each cube', () => {
  assert.equal(countPitch(1), 52);
  for (let k = 2; k <= 20; k++) assert.ok(countPitch(k) > countPitch(k - 1), `k=${k}`);
});

test('the target bag shows every number before repeating any', () => {
  const bag = makeTargetBag(10);
  const first = Array.from({ length: 10 }, () => bag.next());
  assert.deepEqual([...first].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('the target bag never repeats across a refill', () => {
  const bag = makeTargetBag(10);
  let prev = null;
  for (let i = 0; i < 60; i++) {
    const n = bag.next();
    assert.notEqual(n, prev, `repeat at draw ${i}`);
    prev = n;
  }
});

test('the target bag respects the maximum', () => {
  const bag = makeTargetBag(20);
  for (let i = 0; i < 40; i++) {
    const n = bag.next();
    assert.ok(n >= 1 && n <= 20, `out of range: ${n}`);
  }
});

test('add pairs always sum within the maximum', () => {
  for (const max of [10, 20]) {
    const bag = makeAddBag(max);
    for (let i = 0; i < 60; i++) {
      const { a, b } = bag.next();
      assert.ok(a >= 1 && b >= 1, `addends must be real buddies: ${a}+${b}`);
      assert.ok(a + b <= max, `${a}+${b} exceeds ${max}`);
    }
  }
});

test('bags are deterministic given a seeded rng', () => {
  const seeded = () => { let s = 42; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };
  const a = makeTargetBag(10, seeded());
  const b = makeTargetBag(10, seeded());
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next(), `draw ${i}`);
});
