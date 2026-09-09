import { COLORS, makeTargetBag, towerParts } from './blocks.js';
import { drawBuddy, cubeSizeFor } from './render.js';
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
  const OVERSHOOT = 2;          // how far past the target she can go; clips exist this far
  let size = 0;                 // one cube size for the whole screen, from the tallest buddy

  const nudge = makeNudge({
    delay: nudgeMs,
    onHint: (on = true) => sourceEl.classList.toggle('hint', on && !state.done),
    onSpeak: () => { if (!state.done) say('nudge-tap'); },
  });

  // The cube she taps is the colour of the number she is about to make.
  function paintSource() {
    const next = Math.min(state.height + 1, max);
    sourceEl.style.background = COLORS[towerParts(next).at(-1)];
  }

  function paintTower() {
    towerEl.textContent = '';
    paintSource();
    if (state.height === 0) return;
    const buddy = drawBuddy(towerEl, state.height, { size, faces: state.done });
    // Cubes past the target are the ones to pop off; mark them so she can see
    // which, and so tapping one removes it.
    if (state.height > state.target) {
      [...buddy.querySelectorAll('.cube')].slice(0, state.height - state.target)
        .forEach(c => { c.dataset.extra = '1'; });
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

  function paintTarget() {
    drawBuddy(targetEl, state.target, { size, faces: false });
    targetEl.classList.add('ghost');
  }

  function reset(target) {
    size = cubeSizeFor(targetEl.parentElement.clientHeight || 420, max);
    state.target = target;
    state.height = 0;
    state.done = false;
    againEl.hidden = true;
    sourceEl.hidden = false;
    paintTarget();
    paintTower();
    nudge.poke();
  }

  function nextTarget() {
    reset(bag.next());
    say(`make-${state.target}`);
  }

  function setTarget(n) { reset(n); }

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
    if (state.height >= state.target + OVERSHOOT) { thunk(); return; }
    nudge.poke();
    state.height += 1;
    paintTower();
    thunk();
    if (state.height <= state.target) {
      step(state.height);
      await say(`count-${state.height}`);
      if (state.height === state.target && !state.done) await celebrate();
    } else {
      await say(`over-${state.height}`);
    }
  }

  async function removeCube() {
    if (state.height === 0 || state.done) return;
    nudge.poke();
    state.height -= 1;
    paintTower();
    thunk();
    if (state.height === state.target) await celebrate();
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
