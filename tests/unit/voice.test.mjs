import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPhrases, VOICES, NARRATOR } from '../../tools/make-voice.mjs';
import { characterPitch, countPitch } from '../../number-buddies/blocks.js';

test('the narrator is Moira, tuned gentle', () => {
  assert.equal(NARRATOR.voice, 'Moira');
  assert.deepEqual([NARRATOR.pbas, NARRATOR.pmod, NARRATOR.rate], [52, 90, 145]);
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
