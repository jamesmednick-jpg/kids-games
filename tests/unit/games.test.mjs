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
