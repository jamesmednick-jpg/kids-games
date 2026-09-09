import { makeAddBag } from './blocks.js';
import { drawBuddy, cubeSizeFor, celebrate as dance, popFace, stars, clearFx } from './render.js';
import { say, sayAll, clunk, step, sparkle, fanfare } from './audio.js';
import { makeNudge } from './nudge.js';

const MERGE_TOLERANCE = 0.30;   // fraction of screen width; generous on purpose
const TAP_TOLERANCE = 12;       // px; less than this is a tap, not a drag
const wait = ms => new Promise(r => setTimeout(r, ms));

// Two buddies clunk into one and the whole tower is recounted from one — the
// way the show does it, and the only version a five-year-old can follow.
export function mountAdd(host, { max, nudgeMs }) {
  const $ = sel => host.querySelector(sel);
  const aEl = $('#add-a');
  const bEl = $('#add-b');
  const plusEl = $('#add-plus');
  const rowEl = $('.add-row');
  const resultEl = $('#add-result');
  const againEl = $('#add-again');

  const bag = makeAddBag(max);
  const state = { a: 0, b: 0, merged: false };
  let size = 0;                 // one cube size for both buddies and their sum
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

  // Draws the two buddies apart. The merged tower is drawn by merge() itself,
  // beat by beat.
  function paint() {
    rowEl.hidden = false;
    resultEl.hidden = true;
    resultEl.textContent = '';
    againEl.hidden = true;
    clearFx(host);
    drawBuddy(aEl, state.a, { size });
    drawBuddy(bEl, state.b, { size });
    for (const el of [aEl, bEl]) { el.classList.remove('merging'); el.style.transform = ''; }
  }

  function setPair(a, b) {
    size = cubeSizeFor(rowEl.clientHeight || resultEl.clientHeight || 420, max);
    state.a = a; state.b = b; state.merged = false;
    paint();
    nudge.poke();
  }

  function nextPair() {
    const { a, b } = bag.next();
    setPair(a, b);
  }

  // The show's signature beat, in four moves: the buddies slide into the
  // middle and squash together; stars burst where they meet; the faceless sum
  // is counted from one, each cube lighting up in turn; and on the last count
  // the face pops on and the new buddy dances.
  async function merge() {
    if (state.merged) return;
    state.merged = true;
    nudge.stop();
    const total = state.a + state.b;

    // 1. together
    const row = rowEl.getBoundingClientRect();
    const centerX = row.left + row.width / 2;
    for (const el of [aEl, bEl]) {
      const r = el.getBoundingClientRect();
      el.style.transform = `translateX(${centerX - (r.left + r.width / 2)}px)`;
      el.classList.add('merging');
    }
    clunk();
    await wait(420);

    // 2. stars where they touch
    const screen = host.getBoundingClientRect();
    stars(host, centerX - screen.left, row.bottom - screen.top - size * 1.5);
    sparkle();
    await wait(160);

    // 3. the sum, counted from one
    rowEl.hidden = true;
    resultEl.hidden = false;
    let buddy = drawBuddy(resultEl, total, { size, faces: false });
    await say('join');
    const cubes = [...buddy.querySelectorAll('.cube')].reverse();   // bottom up
    for (let k = 1; k <= total; k++) {
      cubes[k - 1]?.classList.add('lit');
      step(k);
      await say(`count-${k}`);
    }

    // 4. alive
    buddy = drawBuddy(resultEl, total, { size });
    popFace(buddy);
    dance(host, buddy, total);
    fanfare();
    againEl.hidden = false;
    await sayAll([`is-${total}`, `cheer-${1 + Math.floor(Math.random() * 4)}`]);
  }

  // Drag either buddy toward the other. Releasing anywhere near the middle
  // counts as together; a plain tap counts too.
  function onDown(el, e) {
    if (state.merged) return;
    drag = { el, startX: e.clientX, dx: 0 };
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
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
    if (moved < TAP_TOLERANCE) return merge();   // a tap is a valid way to play
    await say('nudge-drag');                      // moved a little, not enough
  }

  for (const el of [aEl, bEl]) el.addEventListener('pointerdown', e => onDown(el, e));
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  againEl.addEventListener('click', nextPair);

  return {
    state, setPair, nextPair,
    start() { nextPair(); },
    stop() { nudge.stop(); state.merged = false; resultEl.textContent = ''; clearFx(host); },
  };
}
