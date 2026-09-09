import { makeAddBag } from './blocks.js';
import { drawBuddy, cubeSizeFor, celebrate as dance, popFace, stars, sparks, flash, clearFx } from './render.js';
import { say, sayAll, clunk, ding, sparkle, fanfare } from './audio.js';
import { makeNudge } from './nudge.js';
import { makeHold } from './hold.js';

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
  const hold = makeHold(host);
  let beckonTimer = null;

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
    for (const el of [aEl, bEl]) { el.classList.remove('merging', 'beckon'); el.style.transform = ''; }
  }

  // The other buddy jiggles toward the one she is bringing, with sparkles
  // crackling in the gap between them.
  function beckon(other, toward, on) {
    other.classList.toggle('beckon', on);
    other.style.setProperty('--toward', toward);
    clearInterval(beckonTimer);
    beckonTimer = null;
    if (!on) return;
    beckonTimer = setInterval(() => {
      const a = aEl.getBoundingClientRect(), b = bEl.getBoundingClientRect(), s = host.getBoundingClientRect();
      const midX = (a.left + a.width / 2 + b.left + b.width / 2) / 2 - s.left;
      const y = Math.max(a.bottom, b.bottom) - s.top - size;
      sparks(host, midX, y, 3, 26);
    }, 110);
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
    beckon(aEl, 0, false);
    beckon(bEl, 0, false);
    const row = rowEl.getBoundingClientRect();
    const centerX = row.left + row.width / 2;
    for (const el of [aEl, bEl]) {
      const r = el.getBoundingClientRect();
      el.style.transform = `translateX(${centerX - (r.left + r.width / 2)}px)`;
      el.classList.add('merging');
    }
    clunk();
    await wait(420);

    // 2. a flash and stars where they touch
    const screen = host.getBoundingClientRect();
    flash(host);
    stars(host, centerX - screen.left, row.bottom - screen.top - size * 1.5);
    sparkle();
    await wait(160);

    // 3. the sum, counted from one, glittering the whole time
    rowEl.hidden = true;
    resultEl.hidden = false;
    let buddy = drawBuddy(resultEl, total, { size, faces: false });
    const glitter = setInterval(() => {
      const r = buddy.getBoundingClientRect();
      sparks(host, r.left + r.width / 2 - screen.left + (Math.random() - 0.5) * r.width * 1.6,
        r.top - screen.top + Math.random() * r.height, 2, 8);
    }, 90);
    await say('join');
    const cubes = [...buddy.querySelectorAll('.cube')].reverse();   // bottom up
    for (let k = 1; k <= total; k++) {
      const cube = cubes[k - 1];
      if (cube) {
        cube.classList.add('lit');
        const r = cube.getBoundingClientRect();
        sparks(host, r.left + r.width / 2 - screen.left, r.top + r.height / 2 - screen.top, 6, size * 0.6);
      }
      ding(k);
      await say(`count-${k}`);
    }
    clearInterval(glitter);

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
    hold.grab(el, e);
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag) return;
    drag.dx = e.clientX - drag.startX;
    drag.el.style.transform = `translateX(${drag.dx}px)`;
    hold.move(e);
    // Close enough that the other one gets excited.
    const other = drag.el === aEl ? bEl : aEl;
    const towardOther = drag.el === aEl ? drag.dx > 0 : drag.dx < 0;
    const near = towardOther && Math.abs(drag.dx) > host.clientWidth * MERGE_TOLERANCE * 0.5;
    if (near !== other.classList.contains('beckon')) beckon(other, drag.el === aEl ? -1 : 1, near);
  }
  async function onUp() {
    if (!drag) return;
    const moved = Math.abs(drag.dx);
    const el = drag.el;
    drag = null;
    hold.release();
    beckon(el === aEl ? bEl : aEl, 0, false);
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
    stop() { nudge.stop(); hold.release(); beckon(aEl, 0, false); beckon(bEl, 0, false); state.merged = false; resultEl.textContent = ''; clearFx(host); },
  };
}
