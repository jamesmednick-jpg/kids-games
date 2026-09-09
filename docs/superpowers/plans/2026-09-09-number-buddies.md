# Number Buddies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A counting and adding game for a 5-year-old — build a number out of cubes, push two buddies together to make a bigger one, or play freely with a bin of blocks — with an Irish voice that counts along.

**Architecture:** A static web app in `number-buddies/`, following every convention set by `nail-salon/`. Pure tower logic lives in `blocks.js` and is unit tested with `node --test`. Towers are DOM elements styled with CSS (not canvas), so animation comes from CSS transitions and Playwright can drive everything. All speech is pre-generated on the developer's Mac with `say` and shipped as `.m4a` files; nothing is spoken live by the phone.

**Tech Stack:** Vanilla ES modules, no framework, no runtime dependencies. `node --test` for unit tests, `@playwright/test` for end-to-end. macOS `say` + `afconvert` for voice generation (developer machine only, never at runtime).

**Spec:** `docs/superpowers/specs/2026-09-09-number-buddies-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No build step, no runtime dependencies.** Plain files served statically. ES modules only.
- **No network calls, no links off-site, no analytics, no ads, no accounts.** The kidproof test asserts this.
- **Never write "Numberblocks"** or any character name from the show in code, copy, filenames, comments, or commit messages. The game is **Number Buddies**. Art and character features are original.
- **No score, no stars, no timers, no streaks, no levels, no unlocks, no in-game settings screen.**
- **No text the child must read in order to proceed.** Numerals and mode labels are decorative; every instruction is voice plus picture.
- **Touch targets minimum 56 px.** Cube edge minimum 44 px.
- **Portrait, viewport locked:** `user-scalable=no`, `maximum-scale=1`, `touch-action: none` on the play area, `overscroll-behavior: none` on body.
- **`MAX_NUMBER`** is a parent setting in `number-buddies/game.js`, default `10`, supported values `10` and `20`. Nothing else may hard-code `10`.
- **The numeral sign is drawn at a fixed size** regardless of tower height or cube size.
- **No game code may depend on which voice produced a clip.** The game asks `audio.say('is-7')`; the voice behind it is `tools/make-voice.mjs`'s business alone.
- **Narrator voice:** Moira, `[[pbas 66]] [[pmod 170]] [[rate 200]]`.
- Run `npm test` (unit + e2e) before every commit that touches game code.

---

### Task 1: Make the tooling handle more than one game

`tools/publish.mjs` and `tools/make-icons.mjs` are hard-wired to `nail-salon`, and `tools/serve.mjs` has no MIME type for `.m4a`, so voice clips would fail to load in dev and in tests. Fix all three before writing any game code.

**Files:**
- Create: `tools/games.mjs`
- Modify: `tools/publish.mjs` (whole file), `tools/make-icons.mjs` (whole file), `tools/serve.mjs:8-12`, `package.json:5-11`
- Test: `tests/unit/games.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `bumpCache(source: string, game: string) -> { text: string, version: number }` — returns the service worker source with `const CACHE = '<game>-vN'` incremented, and the new N. Throws `Error` if the line is absent.
  - `GAMES: string[]` — folder names of every game, currently `['nail-salon', 'number-buddies']`.
  - `npm run publish` bumps every game whose folder has uncommitted changes; `npm run icons -- <game> <emoji> <colorA> <colorB>` writes that game's icons.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/games.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bumpCache, GAMES } from '../../tools/games.mjs';

test('GAMES lists every game folder', () => {
  assert.deepEqual(GAMES, ['nail-salon', 'number-buddies']);
});

test('bumpCache increments the version for the named game', () => {
  const src = "const CACHE = 'number-buddies-v3';\nconst FILES = [];\n";
  const { text, version } = bumpCache(src, 'number-buddies');
  assert.equal(version, 4);
  assert.ok(text.includes("const CACHE = 'number-buddies-v4'"));
  assert.ok(text.includes('const FILES = []'));
});

test('bumpCache leaves a different game alone', () => {
  const src = "const CACHE = 'nail-salon-v2';\n";
  const { text, version } = bumpCache(src, 'nail-salon');
  assert.equal(version, 3);
  assert.equal(text, "const CACHE = 'nail-salon-v3';\n");
});

test('bumpCache throws when the cache line is missing', () => {
  assert.throws(() => bumpCache('const FILES = [];', 'number-buddies'), /cache name/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../../tools/games.mjs'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/games.mjs`:

```js
// Shared knowledge about the games in this repo, so the tools do not each
// hard-code one game's folder name.
export const GAMES = ['nail-salon', 'number-buddies'];

// Service workers serve the cached copy until the cache name changes, so a
// publish that skips this is an update nobody ever sees.
export function bumpCache(source, game) {
  const re = new RegExp(`const CACHE = '${game}-v(\\\\d+)'`);
  const match = source.match(re);
  if (!match) throw new Error(`Could not find the cache name for ${game}.`);
  const version = Number(match[1]) + 1;
  return { text: source.replace(match[0], `const CACHE = '${game}-v${version}'`), version };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS — 4 tests in `games.test.mjs`. (`number-buddies` does not exist yet; `GAMES` is a declaration, not a filesystem check, so this passes.)

- [ ] **Step 5: Rewrite publish.mjs to bump every changed game**

Replace the whole of `tools/publish.mjs`:

```js
// Publish the games to GitHub Pages.
//
// Bumps the service worker cache name of every game with uncommitted changes:
// phones that already installed a game keep serving the old cached copy until
// that name changes, so skipping this step means an update nobody ever sees.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { GAMES, bumpCache } from './games.mjs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const status = git('status', '--porcelain');
if (!status) {
  console.log('Nothing to publish.');
  process.exit(0);
}

const bumped = [];
for (const game of GAMES) {
  if (!status.split('\n').some(line => line.slice(3).startsWith(game + '/'))) continue;
  const path = `${ROOT}${game}/sw.js`;
  const { text, version } = bumpCache(await readFile(path, 'utf8'), game);
  await writeFile(path, text);
  bumped.push(`${game} v${version}`);
  console.log(`cache bumped to ${game}-v${version}`);
}
if (!bumped.length) console.log('No game files changed; publishing without a cache bump.');

git('add', '-A');
git('commit', '-m', process.argv[2] || `Update ${bumped.join(', ') || 'the site'}`);
git('push');
console.log('\nPushed. GitHub Pages rebuilds in about a minute:');
console.log('  https://jamesmednick-jpg.github.io/kids-games/');
console.log('\nOn her phone the new version arrives the second time she opens a game.');
```

- [ ] **Step 6: Rewrite make-icons.mjs to take a game**

Replace the whole of `tools/make-icons.mjs`:

```js
// Renders a game's app icon at the sizes iOS and the manifest need.
// Usage: node tools/make-icons.mjs <game> <emoji> <colorA> <colorB>
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { GAMES } from './games.mjs';

const [game = 'nail-salon', emoji = '💅', a = '#ffafcc', b = '#ff4d6d'] = process.argv.slice(2);
if (!GAMES.includes(game)) {
  console.error(`Unknown game "${game}". Known games: ${GAMES.join(', ')}`);
  process.exit(1);
}
const OUT = decodeURIComponent(new URL(`../${game}/`, import.meta.url).pathname);
const SIZES = [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]];

const browser = await chromium.launch();
for (const [name, size] of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(160deg,${a},${b});font-size:${size * 0.62}px;line-height:1;
    font-family:'Apple Color Emoji','Segoe UI Emoji',sans-serif">${emoji}</body>`);
  await writeFile(OUT + name, await page.screenshot({ type: 'png' }));
  console.log('wrote', game + '/' + name);
}
await browser.close();
```

- [ ] **Step 7: Teach serve.mjs about audio**

In `tools/serve.mjs`, add `.m4a` to the `MIME` table so voice clips load in dev and in Playwright:

```js
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.m4a': 'audio/mp4',
```

- [ ] **Step 8: Verify the existing game still publishes and still passes**

Run: `npm test`
Expected: PASS — every existing nail-salon test still green.

Run: `node -e "import('./tools/games.mjs').then(m => console.log(m.GAMES))"`
Expected: `[ 'nail-salon', 'number-buddies' ]`

- [ ] **Step 9: Commit**

```bash
git add tools/games.mjs tools/publish.mjs tools/make-icons.mjs tools/serve.mjs tests/unit/games.test.mjs
git commit -m "Let the tools handle more than one game"
```

---

### Task 2: The tower model

Pure logic, no DOM, no audio. Everything numeric about a buddy lives here so it can be tested without a browser.

**Files:**
- Create: `number-buddies/blocks.js`
- Test: `tests/unit/blocks.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MAX_SUPPORTED = 20`
  - `COLORS: Record<number, string>` — 1..10, hex strings.
  - `FEATURES: Record<number, string>` — 1..10, feature ids: `eye, antennae, freckles, petals4, star, spots, sparkles, arms, petals9, stripes`.
  - `towerParts(n: number) -> number[]` — `[n]` when n ≤ 10, `[10, n - 10]` above.
  - `joinTowers(a: number, b: number, max: number) -> number | null` — the summed height, or `null` when it would pass `max`.
  - `splitTower(n: number) -> [number, number] | null` — pops the top cube, returning `[n - 1, 1]`, or `null` for a One (there is no zero).
  - `cubeSize(availableH: number, n: number, opts?: {gap?: number, min?: number, max?: number}) -> number`
  - `characterPitch(n: number) -> number`, `characterRate(n: number) -> number`, `countPitch(k: number) -> number`
  - `makeTargetBag(max: number, rng?: () => number) -> { next(): number }`
  - `makeAddBag(max: number, rng?: () => number) -> { next(): {a: number, b: number} }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/blocks.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../../number-buddies/blocks.js'`

- [ ] **Step 3: Write minimal implementation**

Create `number-buddies/blocks.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS — all 18 tests in `blocks.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add number-buddies/blocks.js tests/unit/blocks.test.mjs
git commit -m "Add the Number Buddies tower model"
```

---

### Task 3: Generate the voice

Produces every spoken clip up front on the developer's Mac. Nothing is spoken live by the phone, so the delivery is identical everywhere and works with no network.

Requires macOS (`say`, `afconvert`). The generated `.m4a` files are committed, so nobody else needs a Mac to run the game or its tests.

**Files:**
- Create: `tools/make-voice.mjs`, `number-buddies/voice/` (generated: `manifest.json` + `*.m4a`)
- Modify: `package.json` (add `"voice": "node tools/make-voice.mjs"`)
- Test: `tests/unit/voice.test.mjs`

**Interfaces:**
- Consumes: `characterPitch`, `characterRate`, `countPitch` from `number-buddies/blocks.js`.
- Produces:
  - `NARRATOR = { voice: 'Moira', pbas: 66, pmod: 170, rate: 200 }`
  - `VOICES: Record<number, {voice: string, pbas: number, rate: number}>` — one entry per number 1..20. Every entry is Moira today; giving each buddy its own voice later is an edit to this table plus `npm run voice`, with no change to any game file.
  - `buildPhrases(max: number) -> Array<{id: string, text: string, voice: string, pbas: number, pmod: number, rate: number}>`
  - `number-buddies/voice/manifest.json` — `{ "clips": { "<id>": "<id>.m4a", ... } }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/voice.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPhrases, VOICES, NARRATOR } from '../../tools/make-voice.mjs';
import { characterPitch, countPitch } from '../../number-buddies/blocks.js';

test('the narrator is Moira, tuned playful', () => {
  assert.equal(NARRATOR.voice, 'Moira');
  assert.deepEqual([NARRATOR.pbas, NARRATOR.pmod, NARRATOR.rate], [66, 170, 200]);
});

test('every number has a voice entry, all Moira for now', () => {
  for (let n = 1; n <= 20; n++) {
    assert.ok(VOICES[n], `missing voice for ${n}`);
    assert.equal(VOICES[n].voice, 'Moira');
    assert.equal(VOICES[n].pbas, characterPitch(n));
  }
});

test('the phrase list covers every clip the game asks for', () => {
  const ids = new Set(buildPhrases(20).map(p => p.id));
  for (let n = 1; n <= 20; n++) {
    for (const prefix of ['count', 'is', 'make']) assert.ok(ids.has(`${prefix}-${n}`), `${prefix}-${n}`);
  }
  for (let n = 2; n <= 22; n++) assert.ok(ids.has(`over-${n}`), `over-${n}`);
  for (const id of ['join', 'nudge-tap', 'nudge-drag', 'mode-build', 'mode-add', 'mode-play']) {
    assert.ok(ids.has(id), id);
  }
  for (let i = 1; i <= 4; i++) assert.ok(ids.has(`cheer-${i}`), `cheer-${i}`);
});

test('clip ids are unique', () => {
  const list = buildPhrases(20);
  assert.equal(new Set(list.map(p => p.id)).size, list.length);
});

test('counting clips rise in pitch', () => {
  const byId = Object.fromEntries(buildPhrases(20).map(p => [p.id, p]));
  for (let k = 1; k <= 20; k++) assert.equal(byId[`count-${k}`].pbas, countPitch(k));
  assert.ok(byId['count-10'].pbas > byId['count-1'].pbas);
});

test('character lines use the character pitch, narration uses the narrator', () => {
  const byId = Object.fromEntries(buildPhrases(20).map(p => [p.id, p]));
  assert.equal(byId['is-3'].pbas, characterPitch(3));
  assert.equal(byId['make-3'].pbas, NARRATOR.pbas);
  assert.equal(byId['cheer-1'].pbas, NARRATOR.pbas);
});

test('no phrase names the television show', () => {
  for (const p of buildPhrases(20)) {
    assert.doesNotMatch(p.text, /numberblock/i, p.id);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '../../tools/make-voice.mjs'`

- [ ] **Step 3: Write minimal implementation**

Create `tools/make-voice.mjs`. Note the guard at the bottom: importing the module (as the test does) must not shell out to `say`.

```js
// Pre-generates every spoken clip with the macOS `say` command.
//
// Nothing is spoken live by the phone. Generating up front means the voice is
// identical on every device, works with no network, and cannot fail because a
// voice is missing from the phone.
//
// Requires macOS. The generated .m4a files are committed, so running the game
// or its tests needs no Mac.
//
//   npm run voice
//
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { characterPitch, characterRate, countPitch } from '../number-buddies/blocks.js';

// ===== Voice config: edit these freely, then run `npm run voice` =====
// pbas = pitch (higher is squeakier), pmod = sing-song lilt, rate = words/min.
export const NARRATOR = { voice: 'Moira', pbas: 66, pmod: 170, rate: 200 };

// One entry per buddy. Today every buddy is Moira at its own pitch. To give
// each buddy a real voice of its own, change the `voice` here and re-run —
// no game file knows or cares which voice produced a clip.
export const VOICES = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => i + 1).map(n => [n, {
    voice: 'Moira', pbas: characterPitch(n), rate: characterRate(n),
  }]),
);
// =====================================================================

const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen', 'twenty', 'twenty one', 'twenty two',
];
const word = n => NUMBER_WORDS[n - 1];

const narrated = (id, text, over = {}) => ({ id, text, ...NARRATOR, ...over });

export function buildPhrases(max) {
  const out = [];

  // The counting beat. Each clip is a little higher than the last, so playing
  // them in order gives the rising count with no runtime pitch handling.
  for (let k = 1; k <= max; k++) {
    out.push(narrated(`count-${k}`, `${word(k)}.`, { pbas: countPitch(k), pmod: 120 }));
  }

  // A buddy introducing itself, in that buddy's own voice.
  for (let n = 1; n <= max; n++) {
    const v = VOICES[n];
    out.push({ id: `is-${n}`, text: `[[emph +]] I'm ${word(n)}!`, voice: v.voice, pbas: v.pbas, pmod: 170, rate: v.rate });
  }

  // The prompt.
  for (let n = 1; n <= max; n++) out.push(narrated(`make-${n}`, `Can you make ${word(n)}?`));

  // Overshoot, always kind and always with a way out. Covers up to two cubes
  // past the largest target.
  for (let n = 2; n <= max + 2; n++) {
    out.push(narrated(`over-${n}`, `Ooh, that's ${word(n)}! Pop one off?`));
  }

  out.push(narrated('join', `Let's count them all!`));
  out.push(narrated('nudge-tap', 'Tap another block!'));
  out.push(narrated('nudge-drag', 'Push them together!'));
  out.push(narrated('mode-build', 'Build!'));
  out.push(narrated('mode-add', 'Add!'));
  out.push(narrated('mode-play', 'Play!'));

  ['You made it!', 'Woo hoo!', 'Brilliant!', 'Look at you!']
    .forEach((text, i) => out.push(narrated(`cheer-${i + 1}`, `[[emph +]] ${text}`)));

  return out;
}

async function main() {
  const OUT = decodeURIComponent(new URL('../number-buddies/voice/', import.meta.url).pathname);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const phrases = buildPhrases(20);
  const clips = {};
  for (const p of phrases) {
    const wav = `${OUT}${p.id}.wav`;
    const m4a = `${OUT}${p.id}.m4a`;
    execFileSync('say', ['-v', p.voice, '-o', wav, '--data-format=LEI16@22050',
      `[[pbas ${p.pbas}]] [[pmod ${p.pmod}]] [[rate ${p.rate}]] ${p.text}`]);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', wav, m4a]);
    await rm(wav);
    clips[p.id] = `${p.id}.m4a`;
  }
  await writeFile(`${OUT}manifest.json`, JSON.stringify({ clips }, null, 2) + '\n');
  console.log(`wrote ${phrases.length} clips to number-buddies/voice/`);
}

// Only generate when run directly; importing this module must not shell out.
if (process.argv[1] && process.argv[1].endsWith('make-voice.mjs')) await main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS — all 7 tests in `voice.test.mjs`.

- [ ] **Step 5: Add the npm script and generate the clips**

In `package.json`, add to `scripts`:

```json
    "voice": "node tools/make-voice.mjs",
```

Run: `npm run voice`
Expected: `wrote 109 clips to number-buddies/voice/`

Verify a clip sounds right before committing 109 files:

```bash
afplay number-buddies/voice/make-5.m4a
afplay number-buddies/voice/is-1.m4a
afplay number-buddies/voice/is-10.m4a
```

Expected: an Irish voice, lilting and quick; `is-1` noticeably squeakier than `is-10`.

- [ ] **Step 6: Commit**

```bash
git add tools/make-voice.mjs tests/unit/voice.test.mjs package.json number-buddies/voice
git commit -m "Generate the Number Buddies voice clips"
```

---

### Task 4: The shell

Folder, page, offline cache, icons, launcher tile. No game yet — a home screen with three tiles that do nothing but log.

**Files:**
- Create: `number-buddies/index.html`, `number-buddies/style.css`, `number-buddies/game.js`, `number-buddies/sw.js`, `number-buddies/manifest.webmanifest`, icons (generated)
- Modify: `index.html:32` (add the tile)
- Test: `tests/e2e/nb-shell.spec.mjs`

**Interfaces:**
- Consumes: `blocks.js` (imported but barely used yet).
- Produces:
  - `window.__nb` test hook: `{ state, go(name), settings }` where `state = { screen, muted }` and `screen` is one of `home | build | add | play`.
  - DOM ids: `#screen-home`, `#screen-build`, `#screen-add`, `#screen-play`, `#btn-home`, `#btn-mute`, and home tiles `[data-mode="build"|"add"|"play"]`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-shell.spec.mjs`:

```js
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
  expect(ids.length).toBeGreaterThan(100);
  for (const id of ['count-1', 'is-1', 'is-10', 'make-5', 'cheer-1', 'join', 'nudge-tap']) {
    expect(ids, id).toContain(id);
  }
  const r = await request.get(`/number-buddies/voice/${clips['make-5']}`);
  expect(r.ok()).toBeTruthy();
  expect(r.headers()['content-type']).toBe('audio/mp4');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-shell.spec.mjs`
Expected: FAIL — the launcher tile does not exist and `/number-buddies/index.html` 404s.

- [ ] **Step 3: Create the page**

Create `number-buddies/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#fdf6e3">
<title>Number Buddies</title>
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./apple-touch-icon.png">
<link rel="stylesheet" href="./style.css">
</head>
<body>
<button id="btn-mute" aria-label="Sound on or off">🔊</button>

<section id="screen-home">
  <h1>Number Buddies</h1>
  <div class="tiles">
    <button class="tile" data-mode="build"><span class="pic">🧱</span>Build</button>
    <button class="tile" data-mode="add"><span class="pic">➕</span>Add</button>
    <button class="tile" data-mode="play"><span class="pic">🎨</span>Play</button>
  </div>
</section>

<section id="screen-build" class="play" hidden></section>
<section id="screen-add" class="play" hidden></section>
<section id="screen-play" class="play" hidden></section>

<button id="btn-home" aria-label="Home" hidden>⬅️</button>

<script type="module" src="./game.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the stylesheet**

Create `number-buddies/style.css`:

```css
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
  margin: 0; height: 100%; background: #fdf6e3;
  font-family: -apple-system, system-ui, sans-serif;
  -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
  overscroll-behavior: none; overflow: hidden;
}
button { font: inherit; border: 0; background: none; cursor: pointer; }

#btn-mute, #btn-home {
  position: fixed; top: max(12px, env(safe-area-inset-top)); z-index: 10;
  width: 56px; height: 56px; border-radius: 50%; font-size: 26px;
  background: #fff; box-shadow: 0 3px 0 #d9cdb0;
}
#btn-mute { right: 12px; }
#btn-home { left: 12px; }
#btn-mute:active, #btn-home:active { transform: translateY(2px); box-shadow: 0 1px 0 #d9cdb0; }

#screen-home { display: flex; flex-direction: column; justify-content: center; height: 100%; padding: 16px; }
#screen-home h1 { text-align: center; font-size: 34px; margin: 0 0 24px; color: #5b4636; }
.tiles { display: grid; gap: 16px; max-width: 520px; width: 100%; margin: 0 auto; }
@media (min-width: 520px) { .tiles { grid-template-columns: repeat(3, 1fr); } }
.tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  min-height: 120px; background: #fff; border-radius: 28px; box-shadow: 0 4px 0 #d9cdb0;
  color: #5b4636; font-weight: 800; font-size: 22px;
}
.tile .pic { font-size: 56px; line-height: 1; }
.tile:active { transform: translateY(3px); box-shadow: 0 1px 0 #d9cdb0; }

.play { position: relative; height: 100%; touch-action: none; }
[hidden] { display: none !important; }
```

- [ ] **Step 5: Create the game shell**

Create `number-buddies/game.js`:

```js
import { MAX_SUPPORTED } from './blocks.js';

// ===== Parent config: edit these freely =====
export const MAX_NUMBER = 10;        // 10 or 20
export const IDLE_NUDGE_MS = 8000;   // how long before the game offers a hint
export const CHATTINESS = 1;         // 0 quiet, 1 normal, 2 chatty
// Colours and character features live in blocks.js because they are drawn.
// Voice tuning lives in tools/make-voice.mjs; run `npm run voice` after editing.
// ============================================

if (MAX_NUMBER > MAX_SUPPORTED) throw new Error(`MAX_NUMBER must be at most ${MAX_SUPPORTED}`);

const $ = id => document.getElementById(id);
const SCREENS = ['home', 'build', 'add', 'play'];

export const state = { screen: 'home', muted: false };

export function go(name) {
  state.screen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('btn-home').hidden = name === 'home';
}

for (const btn of document.querySelectorAll('[data-mode]')) {
  btn.addEventListener('click', () => go(btn.dataset.mode));
}
$('btn-home').addEventListener('click', () => go('home'));
$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  $('btn-mute').textContent = state.muted ? '🔇' : '🔊';
});

go('home');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.__nb = { state, go, settings: { MAX_NUMBER, IDLE_NUDGE_MS, CHATTINESS } };
```

- [ ] **Step 6: Create the manifest and service worker**

Create `number-buddies/manifest.webmanifest`:

```json
{
  "name": "Number Buddies",
  "short_name": "Numbers",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fdf6e3",
  "theme_color": "#fdf6e3",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Create `number-buddies/sw.js`. It reads the voice manifest at install time so the clip list never has to be maintained by hand:

```js
// Offline cache for Number Buddies. Bump CACHE when you change any file —
// `npm run publish` does it for you.
const CACHE = 'number-buddies-v1';
const FILES = [
  './', './index.html', './style.css', './game.js', './blocks.js', './render.js',
  './audio.js', './manifest.webmanifest', './voice/manifest.json',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png',
];

async function fill(cache) {
  await cache.addAll(FILES);
  // Every voice clip, taken from the generated manifest so the list here
  // never falls behind `npm run voice`.
  try {
    const { clips } = await (await fetch('./voice/manifest.json')).json();
    await cache.addAll(Object.values(clips).map(f => `./voice/${f}`));
  } catch (err) {
    console.warn('voice clips not cached', err);
  }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(fill).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cached copy first for instant offline start; refresh the cache in the background.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
```

- [ ] **Step 7: Add the launcher tile**

In the root `index.html`, replace the comment line with the tile:

```html
  <a class="tile" href="./number-buddies/"><span class="icon">🔢</span>Number Buddies</a>
  <!-- Add the next game here: <a class="tile" href="./game-folder/"><span class="icon">🎨</span>Name</a> -->
```

- [ ] **Step 8: Generate the icons**

Run: `node tools/make-icons.mjs number-buddies 🔢 "#ffd23f" "#43aa5a"`
Expected: `wrote number-buddies/icon-192.png` and two more.

- [ ] **Step 9: Create empty render.js and audio.js so the cache list is honest**

The service worker lists `render.js` and `audio.js`; they must exist. Create `number-buddies/render.js`:

```js
// Drawing the buddies. Filled in by the next task.
export {};
```

Create `number-buddies/audio.js`:

```js
// Clip playback and sound effects. Filled in by a later task.
export {};
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-shell.spec.mjs`
Expected: PASS — 9 tests.

Run: `npm test`
Expected: PASS — nail-salon tests still green.

- [ ] **Step 11: Commit**

```bash
git add number-buddies index.html tests/e2e/nb-shell.spec.mjs
git commit -m "Add the Number Buddies shell and launcher tile"
```

---

### Task 5: Drawing a buddy

One function that renders a tower into a container: cubes, face, signature feature, numeral sign. Every later task uses it.

**Files:**
- Create: `number-buddies/render.js` (replace the stub)
- Modify: `number-buddies/style.css` (append the buddy styles)
- Test: `tests/e2e/nb-render.spec.mjs`, `tests/unit/blocks.test.mjs` (no change; sizing is already covered)

**Interfaces:**
- Consumes: `COLORS`, `FEATURES`, `towerParts`, `cubeSize` from `blocks.js`.
- Produces:
  - `SIGN_SIZE = 72` — the numeral sign's fixed diameter in px.
  - `drawBuddy(host: HTMLElement, n: number, opts?: {availableH?: number, faces?: boolean}) -> HTMLElement` — clears `host`, builds and appends `.buddy`, returns it.
  - `featureShapes(n: number) -> string` — the inline SVG for buddy `n`'s decoration. Exported for testing.
  - DOM contract used by every later task and test: `.buddy[data-n]` contains `.part[data-part-n]` containing `.cube[data-index]`; the face is `.face` on the top cube of the first part; the sign is `.sign` with its numeral as text.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-render.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

// Renders a buddy into a scratch element on the real page, so CSS applies.
async function draw(page, n, availableH = 520) {
  return page.evaluate(async ([n, availableH]) => {
    const { drawBuddy } = await import('/number-buddies/render.js');
    let host = document.getElementById('scratch');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scratch';
      host.style.cssText = `position:fixed;left:0;top:0;width:390px;height:${availableH}px`;
      document.body.append(host);
    }
    const el = drawBuddy(host, n, { availableH });
    return {
      cubes: el.querySelectorAll('.cube').length,
      parts: [...el.querySelectorAll('.part')].map(p => Number(p.dataset.partN)),
      faces: el.querySelectorAll('.face').length,
      features: el.querySelectorAll('.feature-shape').length,
      sign: el.querySelector('.sign').textContent,
      signBox: el.querySelector('.sign').getBoundingClientRect().width,
      cubeBox: el.querySelector('.cube').getBoundingClientRect().width,
      color: getComputedStyle(el.querySelector('.cube')).backgroundColor,
    };
  }, [n, availableH]);
}

test.beforeEach(async ({ page }) => { await page.goto('/number-buddies/index.html'); });

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-render.spec.mjs`
Expected: FAIL — `drawBuddy is not a function`.

- [ ] **Step 3: Write the renderer**

Replace `number-buddies/render.js`:

```js
import { COLORS, FEATURES, towerParts, cubeSize } from './blocks.js';

// The numeral sign is the most important thing on screen, so it is drawn at a
// fixed size and never shrinks with the cubes.
export const SIGN_SIZE = 72;
const GAP = 4;

const svg = (cls, body, viewBox = '0 0 100 100') =>
  `<svg class="${cls}" viewBox="${viewBox}" aria-hidden="true">${body}</svg>`;

const dots = (n, r, cy) => Array.from({ length: n }, (_, i) => {
  const x = 50 + (i - (n - 1) / 2) * (r * 2.6);
  return `<circle class="feature-shape" cx="${x}" cy="${cy}" r="${r}"/>`;
}).join('');

// Each buddy wears N of its own decoration, so the decoration is itself
// countable. Shapes are drawn in a 100x100 box and scaled with the cubes.
export function featureShapes(n) {
  switch (FEATURES[n]) {
    case 'eye':       // one big eye — a cyclops
      return svg('feature', `<circle class="feature-shape" cx="50" cy="50" r="26" fill="#fff" stroke="#3a2c22" stroke-width="5"/>`);
    case 'antennae':  // two bobbles
      return svg('feature', [0, 1].map(i => {
        const x = 34 + i * 32;
        return `<line x1="${x}" y1="46" x2="${x}" y2="16" stroke="#3a2c22" stroke-width="5"/>
                <circle class="feature-shape" cx="${x}" cy="12" r="10"/>`;
      }).join(''));
    case 'freckles':  // three
      return svg('feature', dots(3, 7, 50));
    case 'petals4':
      return svg('feature', Array.from({ length: 4 }, (_, i) =>
        `<ellipse class="feature-shape" cx="50" cy="24" rx="12" ry="22" transform="rotate(${i * 90} 50 50)"/>`).join(''));
    case 'star':      // one five-pointed star
      return svg('feature', `<polygon class="feature-shape" points="50,12 61,40 91,40 66,58 76,88 50,69 24,88 34,58 9,40 39,40"/>`);
    case 'spots':     // six ladybird spots
      return svg('feature', dots(3, 9, 32) + dots(3, 9, 68));
    case 'sparkles':  // seven
      return svg('feature', Array.from({ length: 7 }, (_, i) => {
        const x = 12 + (i % 4) * 25, y = i < 4 ? 30 : 68;
        return `<polygon class="feature-shape" points="${x},${y - 10} ${x + 4},${y - 4} ${x + 10},${y} ${x + 4},${y + 4} ${x},${y + 10} ${x - 4},${y + 4} ${x - 10},${y} ${x - 4},${y - 4}"/>`;
      }).join(''));
    case 'arms':      // eight little arms
      return svg('feature', Array.from({ length: 8 }, (_, i) =>
        `<rect class="feature-shape" x="46" y="6" width="8" height="26" rx="4" transform="rotate(${i * 45} 50 50)"/>`).join(''));
    case 'petals9':
      return svg('feature', Array.from({ length: 9 }, (_, i) =>
        `<ellipse class="feature-shape" cx="50" cy="22" rx="9" ry="20" transform="rotate(${i * 40} 50 50)"/>`).join(''));
    case 'stripes':   // ten, in a rainbow band
      return svg('feature', Array.from({ length: 10 }, (_, i) =>
        `<rect class="feature-shape" x="${i * 10}" y="0" width="10" height="100" fill="hsl(${i * 36} 85% 60%)"/>`).join(''));
    default:
      return '';
  }
}

const FACE = svg('face', `
  <ellipse cx="34" cy="40" rx="13" ry="14" fill="#fff" stroke="#3a2c22" stroke-width="4"/>
  <ellipse cx="66" cy="40" rx="13" ry="14" fill="#fff" stroke="#3a2c22" stroke-width="4"/>
  <circle cx="34" cy="42" r="6" fill="#3a2c22"/>
  <circle cx="66" cy="42" r="6" fill="#3a2c22"/>
  <path d="M30 66 Q50 86 70 66" fill="none" stroke="#3a2c22" stroke-width="6" stroke-linecap="round"/>
`);

// Builds a buddy into host and returns it. Clears whatever was there.
export function drawBuddy(host, n, { availableH = host.clientHeight || 520, faces = true } = {}) {
  host.textContent = '';
  const parts = towerParts(n);
  const tallest = Math.max(...parts);
  const size = cubeSize(availableH - SIGN_SIZE, tallest, { gap: GAP });

  const buddy = document.createElement('div');
  buddy.className = 'buddy';
  buddy.dataset.n = n;

  const sign = document.createElement('div');
  sign.className = 'sign';
  sign.textContent = String(n);
  sign.style.setProperty('--sign', `${SIGN_SIZE}px`);
  buddy.append(sign);

  const row = document.createElement('div');
  row.className = 'parts';
  for (const [pi, pn] of parts.entries()) {
    const part = document.createElement('div');
    part.className = 'part';
    part.dataset.partN = pn;
    for (let i = pn - 1; i >= 0; i--) {   // top cube first, so index 0 is the top
      const cube = document.createElement('div');
      cube.className = 'cube';
      cube.dataset.index = i;
      cube.style.cssText = `width:${size}px;height:${size}px;background:${COLORS[pn]}`;
      if (faces && pi === 0 && i === pn - 1) cube.innerHTML = FACE;
      part.append(cube);
    }
    part.insertAdjacentHTML('beforeend', `<div class="feature-holder" style="--size:${size}px">${featureShapes(pn)}</div>`);
    row.append(part);
  }
  buddy.append(row);
  host.append(buddy);
  return buddy;
}
```

- [ ] **Step 4: Add the styles**

Append to `number-buddies/style.css`:

```css
/* ---------- buddies ---------- */
.buddy { display: flex; flex-direction: column; align-items: center; }
.parts { display: flex; align-items: flex-end; gap: 10px; }
.part { position: relative; display: flex; flex-direction: column; gap: 4px; }

.cube {
  position: relative; border-radius: 10px;
  box-shadow: inset 0 6px 0 rgba(255, 255, 255, 0.28), inset 0 -7px 0 rgba(0, 0, 0, 0.13);
  transition: transform 140ms ease;
}
.cube[data-landing] { animation: land 260ms ease; }
@keyframes land {
  0% { transform: translateY(-26px) scaleY(1.12); }
  60% { transform: translateY(0) scaleY(0.86); }
  100% { transform: none; }
}

.cube svg.face { position: absolute; inset: 8%; width: 84%; height: 84%; }

/* The decoration sits over the tower and scales with the cubes. */
.feature-holder { position: absolute; inset: 0; pointer-events: none; display: grid; place-items: center; }
.feature-holder svg.feature { width: calc(var(--size) * 0.78); height: calc(var(--size) * 0.78); opacity: 0.92; }
.feature-shape { fill: rgba(58, 44, 34, 0.72); }

/* Fixed size, always. A One and a Ten carry the same sign. */
.sign {
  width: var(--sign, 72px); height: var(--sign, 72px); flex: none;
  margin-bottom: -10px; border-radius: 50%; background: #fff;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.16);
  display: grid; place-items: center;
  font-size: calc(var(--sign, 72px) * 0.5); font-weight: 800; color: #23201d;
  z-index: 2;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-render.spec.mjs`
Expected: PASS — 8 tests.

- [ ] **Step 6: Look at it**

Run: `npm run serve`, open `http://localhost:4173/number-buddies/`, and in the browser console:

```js
const { drawBuddy } = await import('/number-buddies/render.js');
const h = document.createElement('div');
h.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center';
document.body.append(h);
drawBuddy(h, 5);
```

Expected: a blue five-cube tower with a face on top, a star, and a white "5" sign above it. Confirm it looks like a wooden toy before moving on.

- [ ] **Step 7: Commit**

```bash
git add number-buddies/render.js number-buddies/style.css tests/e2e/nb-render.spec.mjs
git commit -m "Draw the buddies: cubes, faces, countable features and a fixed-size numeral sign"
```

---

### Task 6: Sound

Voice clip playback plus synthesised effects, behind an interface that knows nothing about which voice made a clip.

**Files:**
- Create: `number-buddies/audio.js` (replace the stub)
- Modify: `number-buddies/game.js` (wire the mute button, preload)
- Test: `tests/e2e/nb-audio.spec.mjs`

**Interfaces:**
- Consumes: `./voice/manifest.json`.
- Produces:
  - `initAudio() -> Promise<void>` — loads the clip manifest, resumes the audio context. Safe to call repeatedly.
  - `say(id: string) -> Promise<void>` — plays one clip; resolves when it ends. Unknown ids resolve immediately after a `console.warn`.
  - `sayAll(ids: string[]) -> Promise<void>` — plays clips in order.
  - `setMuted(m: boolean)`, `isMuted() -> boolean`
  - `thunk()`, `step(k: number)`, `clunk()`, `chime()` — synthesised, no files.
  - `window.__nb.spoken: string[]` — every clip id requested, in order. Tests assert on this rather than on sound.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-audio.spec.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-audio.spec.mjs`
Expected: FAIL — `a.initAudio is not a function`.

- [ ] **Step 3: Write the audio module**

Replace `number-buddies/audio.js`:

```js
// Voice clips are pre-generated files; effects are synthesised. Nothing here
// knows or cares which voice produced a clip — see tools/make-voice.mjs.
let ctx = null;
let muted = false;
let clips = null;              // id -> filename
const buffers = new Map();     // id -> AudioBuffer

// Every clip id the game asks for, in order. Tests assert on this instead of
// listening for sound.
const spoken = [];
window.__nb = window.__nb || {};
window.__nb.spoken = spoken;

export async function initAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = AC ? new AC() : null;
    } catch (err) {
      console.warn('audio unavailable', err);
    }
  }
  if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
  if (!clips) {
    try {
      clips = (await (await fetch('./voice/manifest.json')).json()).clips;
    } catch (err) {
      console.warn('voice manifest unavailable', err);
      clips = {};
    }
  }
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

async function buffer(id) {
  if (buffers.has(id)) return buffers.get(id);
  const bytes = await (await fetch(`./voice/${clips[id]}`)).arrayBuffer();
  const buf = await ctx.decodeAudioData(bytes);
  buffers.set(id, buf);
  return buf;
}

export async function say(id) {
  spoken.push(id);
  if (!clips || !clips[id]) { console.warn('no such clip:', id); return; }
  if (!ctx || muted) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = await buffer(id);
    src.connect(ctx.destination);
    await new Promise(resolve => { src.onended = resolve; src.start(); });
  } catch (err) {
    console.warn('clip failed', id, err);
  }
}

export async function sayAll(ids) {
  for (const id of ids) await say(id);
}

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (err) {
    console.warn('tone failed', err);
  }
}

export function thunk() { tone(180, 0.11, 'triangle', 0.22); }
export function step(k) { tone(392 * Math.pow(2, (k - 1) / 12), 0.14, 'sine', 0.16); }
export function clunk() { tone(120, 0.18, 'square', 0.16); tone(240, 0.12, 'triangle', 0.1, 0.04); }
export function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.14)); }
```

- [ ] **Step 4: Wire it into the shell**

In `number-buddies/game.js`, add the import at the top:

```js
import { initAudio, setMuted, say } from './audio.js';
```

Replace the mute handler and the tile handler with these:

```js
for (const btn of document.querySelectorAll('[data-mode]')) {
  btn.addEventListener('click', async () => {
    await initAudio();
    say(`mode-${btn.dataset.mode}`);
    go(btn.dataset.mode);
  });
}
$('btn-home').addEventListener('click', () => go('home'));
$('btn-mute').addEventListener('click', () => {
  state.muted = !state.muted;
  setMuted(state.muted);
  $('btn-mute').textContent = state.muted ? '🔇' : '🔊';
});
```

And change the last line so the audio module's `spoken` array survives:

```js
window.__nb = Object.assign(window.__nb || {}, { state, go, settings: { MAX_NUMBER, IDLE_NUDGE_MS, CHATTINESS } });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-audio.spec.mjs tests/e2e/nb-shell.spec.mjs`
Expected: PASS — 14 tests.

- [ ] **Step 6: Commit**

```bash
git add number-buddies/audio.js number-buddies/game.js tests/e2e/nb-audio.spec.mjs
git commit -m "Play the Number Buddies voice clips and sound effects"
```

---

### Task 7: Build mode

The main game. A target, a cube to tap, a rising count, a celebration, a kind response to overshoot, and a hint when she stalls.

**Files:**
- Create: `number-buddies/build.js`, `number-buddies/nudge.js`
- Modify: `number-buddies/game.js` (mount build mode), `number-buddies/index.html` (build screen markup), `number-buddies/style.css` (append), `number-buddies/sw.js` (add `./build.js` and `./nudge.js` to `FILES`)
- Test: `tests/e2e/nb-build.spec.mjs`

**Interfaces:**
- Consumes: `drawBuddy` from `render.js`; `makeTargetBag`, `COLORS` from `blocks.js`; `say`, `sayAll`, `thunk`, `step`, `chime` from `audio.js`; `MAX_NUMBER`, `IDLE_NUDGE_MS` from `game.js`.
- Produces:
  - `makeNudge(opts: {delay: number, onHint: (on?: boolean) => void, onSpeak: () => void}) -> { poke(): void, stop(): void }` — an idle clock. `poke()` restarts it on every touch. The first expiry calls `onHint(true)`, every later one calls `onSpeak()`. It repeats forever and never advances the game itself. Add mode uses this too (Task 8).
  - `mountBuild(host: HTMLElement, opts: {max: number, nudgeMs: number}) -> { start(): void, stop(): void, state: BuildState, setTarget(n: number): void, nextTarget(): void }`
  - `BuildState = { target: number, height: number, done: boolean }`
  - `window.__nb.build` — the returned object, for tests.
  - DOM: `#build-target` (ghost tower), `#build-tower` (hers), `#build-source` (the cube she taps), `#build-again`. The class `hint` marks whatever she should touch next.
  - Tests shorten the idle delay with `?nudge=250` on the URL rather than waiting eight seconds.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-build.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

async function openBuild(page, target = null) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build && window.__nb.build.state.target > 0);
  if (target) await page.evaluate(t => window.__nb.build.setTarget(t), target);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  return page.evaluate(() => window.__nb.build.state.target);
}

const tap = async page => {
  await page.click('#build-source');
  await page.waitForTimeout(120);
};

test('the game asks for a target and shows a ghost of it', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="build"]');
  await page.waitForFunction(() => window.__nb.build);
  const target = await page.evaluate(() => window.__nb.build.state.target);
  expect(target).toBeGreaterThanOrEqual(1);
  expect(target).toBeLessThanOrEqual(10);
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
  await page.click('#build-tower .cube[data-extra]');
  await page.waitForFunction(() => window.__nb.build.state.done);
  expect(await page.locator('#build-tower .cube').count()).toBe(3);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-3');
});

test('again offers a different target', async ({ page }) => {
  const first = await openBuild(page);
  await page.evaluate(() => window.__nb.build.setTarget(window.__nb.build.state.target));
  for (let k = 0; k < first; k++) await tap(page);
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
  await page.click('#build-source');
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
  await page.click('#build-source');
  await page.waitForFunction(() => window.__nb.build.state.done);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__nb.spoken)).not.toContain('nudge-tap');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-build.spec.mjs`
Expected: FAIL — `window.__nb.build` is undefined.

- [ ] **Step 3: Add the build screen markup**

In `number-buddies/index.html`, replace the empty build section:

```html
<section id="screen-build" class="play" hidden>
  <div class="ghost-slot"><div id="build-target"></div></div>
  <div class="tower-slot"><div id="build-tower"></div></div>
  <button id="build-source" aria-label="Add a block"></button>
  <button id="build-again" aria-label="Again" hidden>🔄</button>
</section>
```

- [ ] **Step 4: Write the idle nudge**

Create `number-buddies/nudge.js`. Add mode reuses this in Task 8.

```js
// She is five. The game must never stall and never scold: after a pause the
// thing to touch next glows, then a voice offers a hint. It repeats forever
// and never advances the game on her behalf.
export function makeNudge({ delay, onHint, onSpeak }) {
  let timer = null;
  let stage = 0;

  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stage += 1;
      if (stage === 1) onHint(true); else onSpeak();
      arm();
    }, delay);
  }

  return {
    poke() { stage = 0; onHint(false); arm(); },
    stop() { clearTimeout(timer); stage = 0; onHint(false); },
  };
}
```

- [ ] **Step 5: Write build mode**

Create `number-buddies/build.js`:

```js
import { COLORS, makeTargetBag } from './blocks.js';
import { drawBuddy } from './render.js';
import { say, sayAll, thunk, step, chime } from './audio.js';
import { makeNudge } from './nudge.js';

// She taps a cube, it lands on the tower, the count climbs. Reaching the
// target brings the buddy alive. Nothing here ever says "no": too many cubes
// is an observation plus an obvious way to undo it.
export function mountBuild(host, { max, nudgeMs }) {
  const $ = sel => host.querySelector(sel);
  const targetEl = $('#build-target');
  const towerEl = $('#build-tower');
  const sourceEl = $('#build-source');
  const againEl = $('#build-again');

  const bag = makeTargetBag(max);
  const state = { target: 0, height: 0, done: false };

  const nudge = makeNudge({
    delay: nudgeMs,
    onHint: (on = true) => sourceEl.classList.toggle('hint', on && !state.done),
    onSpeak: () => { if (!state.done) say('nudge-tap'); },
  });

  function paintTower() {
    towerEl.textContent = '';
    if (state.height === 0) return;
    const buddy = drawBuddy(towerEl, state.height, {
      availableH: towerEl.clientHeight || 380,
      faces: state.done,
    });
    // Cubes past the target are the ones to pop off; mark them so she can see
    // which, and so tapping one removes it.
    if (state.height > state.target) {
      const cubes = [...buddy.querySelectorAll('.cube')];
      cubes.slice(0, state.height - state.target).forEach(c => { c.dataset.extra = '1'; });
    }
    buddy.querySelectorAll('.cube').forEach(cube => {
      cube.addEventListener('click', e => {
        e.stopPropagation();
        if (cube.dataset.extra) removeCube();
      });
    });
    const top = buddy.querySelector('.cube');
    if (top) top.dataset.landing = '1';
  }

  function nextTarget() {
    state.target = bag.next();
    state.height = 0;
    state.done = false;
    againEl.hidden = true;
    sourceEl.hidden = false;
    drawBuddy(targetEl, state.target, { availableH: targetEl.clientHeight || 380, faces: false });
    targetEl.classList.add('ghost');
    paintTower();
    nudge.poke();
    say(`make-${state.target}`);
  }

  function setTarget(n) {
    state.target = n;
    state.height = 0;
    state.done = false;
    againEl.hidden = true;
    sourceEl.hidden = false;
    drawBuddy(targetEl, n, { availableH: targetEl.clientHeight || 380, faces: false });
    targetEl.classList.add('ghost');
    paintTower();
    nudge.poke();
  }

  async function celebrate() {
    state.done = true;
    nudge.stop();
    sourceEl.hidden = true;
    paintTower();
    chime();
    await sayAll([`is-${state.target}`, `cheer-${1 + Math.floor(Math.random() * 4)}`]);
    againEl.hidden = false;
  }

  async function addCube() {
    if (state.done) return;
    nudge.poke();
    state.height += 1;
    paintTower();
    thunk();
    if (state.height <= state.target) {
      step(state.height);
      await say(`count-${state.height}`);
      if (state.height === state.target) await celebrate();
    } else {
      await say(`over-${state.height}`);
    }
  }

  async function removeCube() {
    if (state.height === 0) return;
    nudge.poke();
    state.height -= 1;
    paintTower();
    thunk();
    if (state.height === state.target && !state.done) await celebrate();
  }

  sourceEl.addEventListener('click', addCube);
  againEl.addEventListener('click', nextTarget);

  return {
    state,
    setTarget,
    nextTarget,
    start() { nextTarget(); },
    stop() { nudge.stop(); state.height = 0; state.done = false; towerEl.textContent = ''; },
  };
}
```

- [ ] **Step 6: Mount it**

In `number-buddies/game.js`, add the import:

```js
import { mountBuild } from './build.js';
```

Insert these lines **immediately before** the existing `go('home');` call — `build` is a `const`, so `go` must not run before it exists:

```js
// Tests shorten the idle delay with ?nudge=250 rather than waiting eight seconds.
const nudgeMs = Number(new URLSearchParams(location.search).get('nudge')) || IDLE_NUDGE_MS;

const build = mountBuild($('screen-build'), { max: MAX_NUMBER, nudgeMs });
Object.assign(window.__nb, { build, nudgeMs });
```

Then change `go` so entering a mode starts it fresh and leaving it stops it:

```js
export function go(name) {
  if (state.screen === 'build' && name !== 'build') build.stop();
  state.screen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('btn-home').hidden = name === 'home';
  if (name === 'build') build.start();
}
```

- [ ] **Step 7: Style the build screen**

Append to `number-buddies/style.css`:

```css
/* ---------- build ---------- */
#screen-build { display: grid; grid-template-rows: 1fr 1fr auto; align-items: end; padding: 88px 16px 24px; gap: 12px; }
.ghost-slot, .tower-slot { display: grid; place-items: end center; min-height: 0; }
#build-target.ghost .cube { opacity: 0.26; box-shadow: none; }
#build-target.ghost .sign { opacity: 0.4; }
#build-target.ghost .feature-holder { display: none; }

#build-source {
  justify-self: center; width: 88px; height: 88px; border-radius: 16px;
  background: #8d6e52; box-shadow: 0 5px 0 #6d5540, inset 0 6px 0 rgba(255,255,255,0.22);
}
#build-source:active { transform: translateY(3px); box-shadow: 0 2px 0 #6d5540; }

.cube[data-extra] { animation: jiggle 700ms ease-in-out infinite; outline: 4px dashed rgba(58,44,34,0.5); outline-offset: 3px; }
@keyframes jiggle { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }

#build-again {
  position: fixed; bottom: max(24px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  width: 88px; height: 88px; border-radius: 50%; font-size: 40px; background: #fff; box-shadow: 0 4px 0 #d9cdb0;
}

/* Whatever she should touch next. */
.hint { animation: hint 900ms ease-in-out infinite; }
@keyframes hint {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.09); filter: brightness(1.22); }
}
#build-source.hint:active { animation: none; }
```

- [ ] **Step 8: Add the new files to the offline cache**

In `number-buddies/sw.js`, add `'./build.js',` and `'./nudge.js',` to the `FILES` array.

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-build.spec.mjs`
Expected: PASS — 14 tests.

Run: `npm test`
Expected: PASS — everything.

- [ ] **Step 10: Commit**

```bash
git add number-buddies tests/e2e/nb-build.spec.mjs
git commit -m "Add Build mode: count cubes onto a tower and bring the buddy alive"
```

---

### Task 8: Add mode

Two buddies, dragged together, recounted from one.

**Files:**
- Create: `number-buddies/add.js`
- Modify: `number-buddies/index.html` (add screen markup), `number-buddies/game.js` (mount), `number-buddies/style.css` (append), `number-buddies/sw.js` (`./add.js`)
- Test: `tests/e2e/nb-add.spec.mjs`

**Interfaces:**
- Consumes: `drawBuddy` from `render.js`; `makeAddBag` from `blocks.js`; `say`, `sayAll`, `clunk`, `step`, `chime` from `audio.js`; `makeNudge` from `nudge.js` (Task 7).
- Produces:
  - `mountAdd(host: HTMLElement, opts: {max: number, nudgeMs: number}) -> { start(), stop(), state, setPair(a, b), nextPair() }`
  - `state = { a: number, b: number, merged: boolean }`
  - `window.__nb.add`
  - DOM: `#add-a`, `#add-b`, `#add-plus`, `#add-result`, `#add-again`.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-add.spec.mjs`:

```js
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

test('dragging them together makes the sum', async ({ page }) => {
  await openAdd(page, 2, 3);
  await dragTogether(page);
  await page.waitForFunction(() => window.__nb.add.state.merged);
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
  await page.waitForFunction(() => window.__nb.add.state.merged);
  expect(await page.locator('#add-result .cube').count()).toBe(5);
});

test('a stalled drag hints rather than failing', async ({ page }) => {
  await openAdd(page, 2, 2);
  const box = await page.locator('#add-a').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__nb.add.state.merged)).toBe(false);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('nudge-drag');
});

test('again offers a new pair within the maximum', async ({ page }) => {
  await openAdd(page);
  await dragTogether(page);
  await page.waitForFunction(() => window.__nb.add.state.merged);
  await page.click('#add-again');
  await page.waitForFunction(() => !window.__nb.add.state.merged);
  const { a, b, max } = await page.evaluate(() => ({
    a: window.__nb.add.state.a, b: window.__nb.add.state.b, max: window.__nb.settings.MAX_NUMBER,
  }));
  expect(a).toBeGreaterThanOrEqual(1);
  expect(b).toBeGreaterThanOrEqual(1);
  expect(a + b).toBeLessThanOrEqual(max);
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
  await page.click('#add-a');
  await page.waitForFunction(() => window.__nb.add.state.merged);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__nb.spoken)).not.toContain('nudge-drag');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-add.spec.mjs`
Expected: FAIL — `window.__nb.add` is undefined.

- [ ] **Step 3: Add the markup**

In `number-buddies/index.html`, replace the empty add section:

```html
<section id="screen-add" class="play" hidden>
  <div class="add-row">
    <div id="add-a" class="draggable"></div>
    <div id="add-plus">+</div>
    <div id="add-b" class="draggable"></div>
  </div>
  <div id="add-result" hidden></div>
  <button id="add-again" aria-label="Again" hidden>🔄</button>
</section>
```

- [ ] **Step 4: Write add mode**

Create `number-buddies/add.js`:

```js
import { makeAddBag } from './blocks.js';
import { drawBuddy } from './render.js';
import { say, sayAll, clunk, step, chime } from './audio.js';
import { makeNudge } from './nudge.js';

const MERGE_TOLERANCE = 0.34;   // fraction of screen width; generous on purpose

// Two buddies clunk into one and the whole tower is recounted from one — the
// way the show does it, and the only version a five-year-old can follow.
export function mountAdd(host, { max, nudgeMs }) {
  const $ = sel => host.querySelector(sel);
  const aEl = $('#add-a');
  const bEl = $('#add-b');
  const plusEl = $('#add-plus');
  const resultEl = $('#add-result');
  const againEl = $('#add-again');

  const bag = makeAddBag(max);
  const state = { a: 0, b: 0, merged: false };
  let drag = null;

  const nudge = makeNudge({
    delay: nudgeMs,
    onHint: (on = true) => {
      const show = on && !state.merged;
      aEl.classList.toggle('hint', show);
      bEl.classList.toggle('hint', show);
    },
    onSpeak: () => { if (!state.merged) say('nudge-drag'); },
  });

  function paint() {
    aEl.hidden = bEl.hidden = plusEl.hidden = state.merged;
    resultEl.hidden = !state.merged;
    againEl.hidden = !state.merged;
    if (state.merged) {
      drawBuddy(resultEl, state.a + state.b, { availableH: host.clientHeight * 0.62 });
    } else {
      const h = host.clientHeight * 0.55;
      drawBuddy(aEl, state.a, { availableH: h });
      drawBuddy(bEl, state.b, { availableH: h });
      aEl.style.transform = bEl.style.transform = '';
    }
  }

  function setPair(a, b) {
    state.a = a; state.b = b; state.merged = false;
    paint();
    nudge.poke();
  }

  function nextPair() {
    const { a, b } = bag.next();
    setPair(a, b);
  }

  async function merge() {
    if (state.merged) return;
    state.merged = true;
    nudge.stop();
    clunk();
    paint();
    const total = state.a + state.b;
    await say('join');
    const cubes = [...resultEl.querySelectorAll('.cube')].reverse();   // bottom up
    for (let k = 1; k <= total; k++) {
      cubes[k - 1]?.classList.add('counting');
      step(k);
      await say(`count-${k}`);
    }
    chime();
    await sayAll([`is-${total}`, `cheer-${1 + Math.floor(Math.random() * 4)}`]);
  }

  // Drag either buddy toward the other. Releasing anywhere near the middle
  // counts as together; a tap counts too, after a hint.
  function onDown(el, e) {
    if (state.merged) return;
    drag = { el, startX: e.clientX, dx: 0 };
    el.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    drag.dx = e.clientX - drag.startX;
    drag.el.style.transform = `translateX(${drag.dx}px)`;
  }
  async function onUp() {
    if (!drag) return;
    const moved = Math.abs(drag.dx);
    const el = drag.el;
    drag = null;
    nudge.poke();
    if (moved >= host.clientWidth * MERGE_TOLERANCE) return merge();
    el.style.transform = '';
    if (moved < 12) return merge();          // a tap is a valid way to play
    await say('nudge-drag');                  // moved a little, not enough
  }

  for (const el of [aEl, bEl]) {
    el.addEventListener('pointerdown', e => onDown(el, e));
  }
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  againEl.addEventListener('click', nextPair);

  return {
    state, setPair, nextPair,
    start() { nextPair(); },
    stop() { nudge.stop(); state.merged = false; resultEl.textContent = ''; },
  };
}
```

- [ ] **Step 5: Mount it**

In `number-buddies/game.js`, import and mount alongside build:

```js
import { mountAdd } from './add.js';
```

```js
const add = mountAdd($('screen-add'), { max: MAX_NUMBER, nudgeMs });
Object.assign(window.__nb, { build, add, nudgeMs });
```

And extend `go`:

```js
export function go(name) {
  if (state.screen === 'build' && name !== 'build') build.stop();
  if (state.screen === 'add' && name !== 'add') add.stop();
  state.screen = name;
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $('btn-home').hidden = name === 'home';
  if (name === 'build') build.start();
  if (name === 'add') add.start();
}
```

- [ ] **Step 6: Style it**

Append to `number-buddies/style.css`:

```css
/* ---------- add ---------- */
#screen-add { display: grid; place-items: center; padding: 88px 16px 120px; }
.add-row { display: flex; align-items: flex-end; justify-content: center; gap: 18px; width: 100%; }
#add-plus { font-size: 44px; font-weight: 800; color: #5b4636; padding-bottom: 40px; }
.draggable { touch-action: none; transition: transform 160ms ease; }
#add-result { display: grid; place-items: center; }
.cube.counting { outline: 4px solid rgba(255, 255, 255, 0.9); outline-offset: -4px; }
#add-again {
  position: fixed; bottom: max(24px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  width: 88px; height: 88px; border-radius: 50%; font-size: 40px; background: #fff; box-shadow: 0 4px 0 #d9cdb0;
}
```

- [ ] **Step 7: Add add.js to the offline cache**

In `number-buddies/sw.js`, add `'./add.js',` to `FILES`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-add.spec.mjs`
Expected: PASS — 10 tests.

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add number-buddies tests/e2e/nb-add.spec.mjs
git commit -m "Add Add mode: push two buddies together and recount from one"
```

---

### Task 9: Play mode

A bin of cubes and no goals.

**Files:**
- Create: `number-buddies/play.js`
- Modify: `number-buddies/index.html`, `number-buddies/game.js`, `number-buddies/style.css`, `number-buddies/sw.js`
- Test: `tests/e2e/nb-play.spec.mjs`

**Interfaces:**
- Consumes: `drawBuddy` from `render.js`; `say`, `thunk`, `clunk` from `audio.js`.
- Produces:
  - `mountPlay(host: HTMLElement, opts: {max: number}) -> { start(), stop(), state, addTower(n): string, join(idA, idB), splitTop(id) }`
  - `state = { towers: Array<{id: string, n: number, x: number, y: number}> }`
  - `window.__nb.play`
  - DOM: `#play-board`, `#play-bin`, `#play-sweep`, and one `.tower[data-id]` per tower.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-play.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

async function openPlay(page) {
  await page.goto('/number-buddies/index.html');
  await page.click('[data-mode="play"]');
  await page.waitForFunction(() => window.__nb.play);
  await page.evaluate(() => { window.__nb.spoken.length = 0; });
}

test('the board starts empty with a bin of cubes', async ({ page }) => {
  await openPlay(page);
  expect(await page.locator('#play-board .tower').count()).toBe(0);
  await expect(page.locator('#play-bin')).toBeVisible();
});

test('taking a cube from the bin makes a one', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin');
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  expect(await page.locator('#play-board .tower .cube').count()).toBe(1);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-1');
});

test('joining two towers announces the new number', async ({ page }) => {
  await openPlay(page);
  const [a, b] = await page.evaluate(() => [window.__nb.play.addTower(2), window.__nb.play.addTower(3)]);
  await page.evaluate(([a, b]) => window.__nb.play.join(a, b), [a, b]);
  await expect(page.locator('#play-board .tower')).toHaveCount(1);
  expect(await page.locator('#play-board .tower .cube').count()).toBe(5);
  expect(await page.evaluate(() => window.__nb.spoken)).toContain('is-5');
});

test('splitting the top cube off leaves both halves', async ({ page }) => {
  await openPlay(page);
  const id = await page.evaluate(() => window.__nb.play.addTower(4));
  await page.evaluate(id => window.__nb.play.splitTop(id), id);
  await expect(page.locator('#play-board .tower')).toHaveCount(2);
  const sizes = await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n).sort());
  expect(sizes).toEqual([1, 3]);
});

test('splitting a one does nothing rather than making a zero', async ({ page }) => {
  await openPlay(page);
  const id = await page.evaluate(() => window.__nb.play.addTower(1));
  await page.evaluate(id => window.__nb.play.splitTop(id), id);
  expect(await page.evaluate(() => window.__nb.play.state.towers.map(t => t.n))).toEqual([1]);
});

test('joining never exceeds the maximum', async ({ page }) => {
  await openPlay(page);
  const joined = await page.evaluate(() => {
    const a = window.__nb.play.addTower(9);
    const b = window.__nb.play.addTower(9);
    window.__nb.play.join(a, b);
    return window.__nb.play.state.towers.map(t => t.n);
  });
  const max = await page.evaluate(() => window.__nb.settings.MAX_NUMBER);
  for (const n of joined) expect(n).toBeLessThanOrEqual(max);
  expect(joined.reduce((a, b) => a + b, 0)).toBe(18);
});

test('sweep clears the board', async ({ page }) => {
  await openPlay(page);
  await page.evaluate(() => { window.__nb.play.addTower(3); window.__nb.play.addTower(2); });
  await page.click('#play-sweep');
  await expect(page.locator('#play-board .tower')).toHaveCount(0);
});

test('there are no goals, prompts or targets in play mode', async ({ page }) => {
  await openPlay(page);
  await page.click('#play-bin');
  const spoken = await page.evaluate(() => window.__nb.spoken);
  expect(spoken.some(id => id.startsWith('make-'))).toBeFalsy();
  expect(spoken.some(id => id.startsWith('over-'))).toBeFalsy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/nb-play.spec.mjs`
Expected: FAIL — `window.__nb.play` is undefined.

- [ ] **Step 3: Add the markup**

In `number-buddies/index.html`, replace the empty play section:

```html
<section id="screen-play" class="play" hidden>
  <div id="play-board"></div>
  <button id="play-bin" aria-label="Take a block"></button>
  <button id="play-sweep" aria-label="Clear the board">🧹</button>
</section>
```

- [ ] **Step 4: Write play mode**

Create `number-buddies/play.js`:

```js
import { joinTowers, splitTower } from './blocks.js';
import { drawBuddy } from './render.js';
import { say, thunk, clunk } from './audio.js';

// No goals. She stacks, joins and splits, and every tower says its own number
// whenever it changes.
export function mountPlay(host, { max }) {
  const $ = sel => host.querySelector(sel);
  const board = $('#play-board');
  const bin = $('#play-bin');
  const sweep = $('#play-sweep');

  const state = { towers: [] };
  let seq = 0;
  let drag = null;

  function paint() {
    board.textContent = '';
    for (const t of state.towers) {
      const el = document.createElement('div');
      el.className = 'tower draggable';
      el.dataset.id = t.id;
      el.style.cssText = `left:${t.x}px; top:${t.y}px`;
      board.append(el);
      drawBuddy(el, t.n, { availableH: board.clientHeight * 0.6 });
      el.addEventListener('pointerdown', e => onDown(t, el, e));
      el.addEventListener('dblclick', () => splitTop(t.id));
    }
  }

  function addTower(n, x = null, y = null) {
    const id = `t${++seq}`;
    state.towers.push({
      id, n,
      x: x ?? 24 + (state.towers.length % 4) * 78,
      y: y ?? 24 + Math.floor(state.towers.length / 4) * 40,
    });
    paint();
    thunk();
    say(`is-${n}`);
    return id;
  }

  function join(idA, idB) {
    const a = state.towers.find(t => t.id === idA);
    const b = state.towers.find(t => t.id === idB);
    if (!a || !b || a === b) return;
    const total = joinTowers(a.n, b.n, max);
    if (total === null) return;               // stay inside the parent setting
    a.n = total;
    state.towers = state.towers.filter(t => t !== b);
    paint();
    clunk();
    say(`is-${a.n}`);
  }

  function splitTop(id) {
    const t = state.towers.find(x => x.id === id);
    if (!t) return;
    const halves = splitTower(t.n);
    if (!halves) return;                      // a One cannot be split
    const [kept, popped] = halves;
    t.n = kept;
    paint();
    addTower(popped, t.x + 86, t.y);
    say(`is-${kept}`);
  }

  function onDown(t, el, e) {
    drag = { t, el, ox: e.clientX - t.x, oy: e.clientY - t.y };
    el.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    drag.t.x = e.clientX - drag.ox;
    drag.t.y = e.clientY - drag.oy;
    drag.el.style.left = `${drag.t.x}px`;
    drag.el.style.top = `${drag.t.y}px`;
  }
  function onUp() {
    if (!drag) return;
    const me = drag.t;
    drag = null;
    // Dropping a tower onto another joins them.
    const near = state.towers.find(o => o !== me && Math.hypot(o.x - me.x, o.y - me.y) < 70);
    if (near) join(near.id, me.id); else paint();
  }

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  bin.addEventListener('click', () => addTower(1));
  sweep.addEventListener('click', () => { state.towers = []; paint(); });

  return {
    state, addTower, join, splitTop,
    start() { state.towers = []; seq = 0; paint(); },
    stop() { state.towers = []; paint(); },
  };
}
```

- [ ] **Step 5: Mount it**

In `number-buddies/game.js`:

```js
import { mountPlay } from './play.js';
```

```js
const play = mountPlay($('screen-play'), { max: MAX_NUMBER });
Object.assign(window.__nb, { build, add, play, nudgeMs });
```

```js
  if (state.screen === 'play' && name !== 'play') play.stop();
  ...
  if (name === 'play') play.start();
```

- [ ] **Step 6: Style it**

Append to `number-buddies/style.css`:

```css
/* ---------- play ---------- */
#screen-play { padding: 88px 0 0; }
#play-board { position: relative; height: calc(100% - 120px); overflow: hidden; }
.tower { position: absolute; touch-action: none; }
#play-bin {
  position: fixed; bottom: max(20px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  width: 88px; height: 88px; border-radius: 16px; background: #8d6e52;
  box-shadow: 0 5px 0 #6d5540, inset 0 6px 0 rgba(255,255,255,0.22);
}
#play-bin:active { transform: translateX(-50%) translateY(3px); box-shadow: 0 2px 0 #6d5540; }
#play-sweep {
  position: fixed; bottom: max(20px, env(safe-area-inset-bottom)); right: 16px;
  width: 64px; height: 64px; border-radius: 50%; font-size: 28px; background: #fff; box-shadow: 0 4px 0 #d9cdb0;
}
```

- [ ] **Step 7: Add play.js to the offline cache**

In `number-buddies/sw.js`, add `'./play.js',` to `FILES`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/nb-play.spec.mjs`
Expected: PASS — 8 tests.

- [ ] **Step 9: Commit**

```bash
git add number-buddies tests/e2e/nb-play.spec.mjs
git commit -m "Add Play mode: a bin of cubes and no goals"
```

---

### Task 10: Kidproofing, the twenty setting, and publish

The last mile: she cannot break it, she cannot get out of it, the parent setting really works, and it ships.

**Files:**
- Create: `tests/e2e/nb-kidproof.spec.mjs`
- Modify: `README.md`
- Test: `tests/e2e/nb-kidproof.spec.mjs`

**Interfaces:**
- Consumes: everything built so far. `window.__nb = { state, go, settings, build, add, play, spoken, nudgeMs }`.
- Produces: no new code — this task is tests, documentation and the publish run.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/nb-kidproof.spec.mjs`:

```js
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

test('nothing anywhere hard-codes ten in place of the parent setting', async ({ page, request }) => {
  // Every module that talks about a maximum must read MAX_NUMBER, so raising
  // the setting to 20 really does raise it everywhere.
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

test('a buddy above ten stands as a ten beside its remainder', async ({ page }) => {
  await page.goto('/number-buddies/index.html');
  const parts = await page.evaluate(async () => {
    const { drawBuddy } = await import('/number-buddies/render.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:520px';
    document.body.append(host);
    const el = drawBuddy(host, 13, { availableH: 520 });
    return {
      parts: [...el.querySelectorAll('.part')].map(p => Number(p.dataset.partN)),
      cubes: el.querySelectorAll('.cube').length,
      sign: el.querySelector('.sign').textContent,
    };
  });
  expect(parts.parts).toEqual([10, 3]);
  expect(parts.cubes).toBe(13);
  expect(parts.sign).toBe('13');
});
```

- [ ] **Step 2: Run tests to verify they fail (or reveal real bugs)**

Run: `npx playwright test tests/e2e/nb-kidproof.spec.mjs`
Expected: this is the one task whose tests may pass on first run — everything they check was built in Tasks 4–9. Any failure here is a real bug in an earlier task, not a missing feature. Fix the earlier module rather than weakening the test.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS — unit (`games`, `blocks`, `voice`, `geometry`) and every e2e spec, nail-salon included.

- [ ] **Step 4: Check the twenty setting really works**

In `number-buddies/game.js`, temporarily set `MAX_NUMBER = 20`.

Run: `npm run test:e2e`
Expected: PASS — the same suite, now exercising targets and sums up to twenty.

Then open `npm run serve` → `http://localhost:4173/number-buddies/`, play a round in Build, and confirm a target above ten draws as a ten-tower beside its remainder with one sign showing the whole number.

Set `MAX_NUMBER` back to `10` and re-run `npm run test:e2e` before continuing.

- [ ] **Step 5: Play it yourself before she does**

Run: `npm run serve`, and open it on the Mac and on the phone over wifi. Check by hand — these are the things tests cannot judge:

- Build: the count sounds right and the pitch climbs. The celebration lands. Six cubes on a five gets the kind message and the extra one is obviously the one to remove.
- Add: dragging feels forgiving, not fiddly. The recount starts at one.
- Play: cubes come out of the bin, join and split without frustration.
- Leave it alone for eight seconds in Build and in Add: the hint appears, then the voice.
- Mute works and stays muted across modes.
- The whole thing is readable at arm's length for someone who cannot read.

- [ ] **Step 6: Document it**

In `README.md`, under `## Games`, add:

```markdown
- `number-buddies/` — build a number out of cubes, push two buddies together to
  make a bigger one, or play freely with a bin of blocks. Every buddy has a face
  and wears N of its own decoration, so the character design is countable too.
  Parent settings (`MAX_NUMBER`, idle hint delay, chattiness) are at the top of
  `number-buddies/game.js`; colours and features are in `number-buddies/blocks.js`.
  The voice is pre-generated: edit the voice or the phrases in
  `tools/make-voice.mjs`, then run `npm run voice`. Giving each buddy its own
  voice is a change to the `VOICES` table there and nothing else.
```

Under `## Development`, add:

```
npm run voice     # regenerate the Number Buddies speech clips (macOS only)
```

And in `## Adding a game`, add a fourth step:

```markdown
4. Add the folder name to `GAMES` in `tools/games.mjs` so `npm run publish`
   and `npm run icons` know about it.
```

- [ ] **Step 7: Publish**

Run: `npm test`
Expected: PASS. Do not publish on a red suite.

Run: `npm run publish`
Expected: `cache bumped to number-buddies-vN`, a commit, a push, and the live URL printed.

Then on the phone: open `https://jamesmednick-jpg.github.io/kids-games/`, tap Number Buddies, Share → Add to Home Screen. Confirm it opens full screen, then turn wifi and data off and confirm it still plays with sound.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/nb-kidproof.spec.mjs README.md
git commit -m "Kidproof Number Buddies and document it"
```
