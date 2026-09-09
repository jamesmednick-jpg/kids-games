// The tower model. Pure numbers and tables — no DOM, no audio, no timers.

export const MAX_SUPPORTED = 20;

// Original palette. Chosen for contrast against the background and each other.
export const COLORS = {
  1: '#e63946', 2: '#f4802b', 3: '#ffd23f', 4: '#43aa5a', 5: '#3b82d6',
  6: '#8b5cf6', 7: '#38bdf8', 8: '#ec4899', 9: '#14b8a6', 10: '#ffffff',
};

// Each buddy wears N of its own decoration, so the character design is itself
// countable: she can count Three's freckles.
export const FEATURES = {
  1: 'eye', 2: 'antennae', 3: 'freckles', 4: 'petals4', 5: 'star',
  6: 'spots', 7: 'sparkles', 8: 'arms', 9: 'petals9', 10: 'stripes',
};

// Above ten a number stands as a full ten beside its remainder, the way the
// cubes would actually sit on a table.
export function towerParts(n) {
  return n <= 10 ? [n] : [10, n - 10];
}

// Joining refuses rather than clipping, so a tower never silently loses cubes.
export function joinTowers(a, b, max) {
  const total = a + b;
  return total > max ? null : total;
}

// Pops the top cube off. A One cannot be split — there is no zero buddy.
export function splitTower(n) {
  return n <= 1 ? null : [n - 1, 1];
}

export function cubeSize(availableH, n, { gap = 4, min = 44, max = 72 } = {}) {
  const fit = (availableH - gap * (n - 1)) / n;
  return Math.max(min, Math.min(max, fit));
}

// Squeaky One down to deep Ten, so the buddies feel like different little
// characters without needing different voices.
export const characterPitch = n => Math.round(92 - (n - 1) * 5.6);
export const characterRate = n => Math.round(205 - (n - 1) * 3);

// Each counting clip is generated a little higher than the last, so playing
// them in order produces the rising count with no runtime pitch handling.
export const countPitch = k => Math.round(50 + k * 1.6);

function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draws from a shuffled bag so every value is seen before any repeats, and
// never hands out the same value twice in a row across a refill.
function makeBag(items, rng, same) {
  let queue = shuffle(items, rng);
  let last = null;
  return {
    next() {
      if (!queue.length) {
        queue = shuffle(items, rng);
        if (queue.length > 1 && same(queue[0], last)) queue.push(queue.shift());
      }
      last = queue.shift();
      return last;
    },
  };
}

export function makeTargetBag(max, rng = Math.random) {
  const items = Array.from({ length: max }, (_, i) => i + 1);
  return makeBag(items, rng, (a, b) => a === b);
}

export function makeAddBag(max, rng = Math.random) {
  const items = [];
  for (let a = 1; a <= max - 1; a++) {
    for (let b = 1; a + b <= max; b++) items.push({ a, b });
  }
  return makeBag(items, rng, (x, y) => !!y && x.a === y.a && x.b === y.b);
}
