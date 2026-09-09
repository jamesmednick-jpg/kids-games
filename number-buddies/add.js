import { makeAddBag } from './blocks.js';
import { drawBuddy, cubeSizeFor } from './render.js';
import { say, sayAll, clunk, step, chime } from './audio.js';
import { makeNudge } from './nudge.js';

const MERGE_TOLERANCE = 0.30;   // fraction of screen width; generous on purpose
const TAP_TOLERANCE = 12;       // px; less than this is a tap, not a drag

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

  function paint() {
    rowEl.hidden = state.merged;
    resultEl.hidden = !state.merged;
    againEl.hidden = true;
    if (state.merged) {
      drawBuddy(resultEl, state.a + state.b, { size });
    } else {
      drawBuddy(aEl, state.a, { size });
      drawBuddy(bEl, state.b, { size });
      aEl.style.transform = bEl.style.transform = '';
    }
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
    againEl.hidden = false;
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
    stop() { nudge.stop(); state.merged = false; resultEl.textContent = ''; },
  };
}
