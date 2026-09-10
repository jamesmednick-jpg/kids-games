import { makeChallengeBag } from './blocks.js';
import { drawBuddy, GAP } from './render.js';
import { say, hasClip } from './audio.js';
import { makeNudge } from './nudge.js';
import { mountWorld } from './world.js';
import { GROUND } from './worlds.js';

// Add is a challenge on a little world: "Can you put One and One together,
// to make Two?" Two buddies stand apart on the ground with a ghost of the
// answer between them. She can carry them anywhere; when they touch — pushed
// together or dropped one on the other — they add up, and the sum is said
// plainly. Same physics as Play, so nothing new to learn.
export function mountAdd(host, { max, nudgeMs }) {
  const $ = sel => host.querySelector(sel);
  const board = $('#add-board');
  const targetEl = $('#add-target');
  const plusEl = $('#add-plus');
  const againEl = $('#add-again');

  const bag = makeChallengeBag(max);
  const pairId = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const state = { a: 0, b: 0, merged: false, get towers() { return world.state.towers; } };

  const world = mountWorld(host, board, {
    max, allowSplit: false, mergeOnTouch: true, confetti: true, announce: false,
    onMergeStart() { nudge.stop(); },
    onMerged(total, a, b) {
      state.merged = true;
      nudge.stop();
      targetEl.classList.add('matched');
      againEl.hidden = false;
      const sum = `sum-${pairId(a, b)}`;
      if (hasClip(sum)) say(sum);
    },
  });

  const nudge = makeNudge({
    delay: nudgeMs,
    onHint: (on = true) => world.towerEls().forEach(e => e.classList.toggle('hint', on && !state.merged)),
    onSpeak: () => { if (!state.merged) say('nudge-drag'); },
  });

  function setPair(a, b) {
    state.a = a; state.b = b; state.merged = false;
    againEl.hidden = true;
    // Rebuild the little world: ground, the two buddies apart, the ghost between.
    board.querySelectorAll('.tower').forEach(e => e.remove());
    world.open([]);
    const size = world.state.size;
    const W = board.clientWidth;
    world.addTower(a, Math.round(W * 0.16), 0);
    world.addTower(b, Math.round(W * 0.84 - size), 0);
    drawBuddy(targetEl, a + b, { size, faces: false });
    targetEl.classList.add('ghost');
    targetEl.classList.remove('matched');
    targetEl.style.bottom = `${GROUND}px`;
    plusEl.style.bottom = `${GROUND + size * 0.35}px`;
    nudge.poke();
  }

  function nextPair() {
    const { a, b } = bag.next();
    setPair(a, b);
    const ask = `add-${pairId(a, b)}`;
    say(hasClip(ask) ? ask : `make-${a + b}`);
  }

  againEl.addEventListener('click', nextPair);
  // Touching anything counts as activity: the hint waits for a real pause.
  board.addEventListener('pointerdown', () => { if (!state.merged) nudge.poke(); });
  board.addEventListener('pointerup', () => { if (!state.merged) nudge.poke(); });

  return {
    state, setPair, nextPair,
    join: world.join,
    start() { nextPair(); },
    stop() { nudge.stop(); world.close(); state.merged = false; },
  };
}
