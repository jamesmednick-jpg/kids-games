import { joinTowers, splitTower } from './blocks.js';
import { drawBuddy, cubeSizeFor, GAP, popFace, stars, flash, sparks, clearFx } from './render.js';
import { say, sayAll, thunk, boing, ding, sparkle, fanfare } from './audio.js';
import { makeHold } from './hold.js';
import { WORLDS, GROUND, drawWorld } from './worlds.js';

// ===== Physics: edit these freely =====
const GRAVITY = 2600;        // px per second per second
const MAX_FALL = 1900;       // px per second
const FLING = 1.0;           // how much of the finger's speed a let-go buddy keeps
const MAX_FLING = 900;       // px per second; a flick never sends a buddy ricocheting round the world
const MERGE_OVERLAP = 0.5;   // fraction of a cube two towers must overlap to add up
// ======================================

// Play is a world with gravity. Let go and it falls; land it on a platform
// and it sits; drop it on another buddy and they add up.
export function mountPlay(host, { max }) {
  const $ = sel => host.querySelector(sel);
  const picker = $('#play-picker');
  const board = $('#play-board');
  const bar = $('.play-bar');
  const bin = $('#play-bin');
  const sweep = $('#play-sweep');
  const worldsBtn = $('#play-worlds');

  const state = { world: null, towers: [], platforms: [] };
  let seq = 0;
  let size = 0;
  let drag = null;
  let frame = null;
  let last = 0;
  const hold = makeHold(host);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const height = t => t.n * size + (t.n - 1) * GAP;
  const top = t => t.y + height(t);
  const el = t => board.querySelector(`.tower[data-id="${t.id}"]`);

  // ---------- the picker ----------
  picker.innerHTML = WORLDS.map(w =>
    `<button class="world-tile" data-world="${w.id}"><span class="preview ${w.id}"></span>${w.name}</button>`).join('');
  for (const b of picker.querySelectorAll('[data-world]')) {
    b.addEventListener('click', () => pickWorld(b.dataset.world));
  }

  function showPicker() {
    stopLoop();
    state.world = null;
    state.towers = [];
    board.textContent = '';
    picker.hidden = false;
    board.hidden = true;
    bar.hidden = true;
    clearFx(host);
  }

  function pickWorld(id) {
    const world = WORLDS.find(w => w.id === id) || WORLDS[0];
    state.world = world.id;
    state.towers = [];
    picker.hidden = true;
    board.hidden = false;
    bar.hidden = false;
    size = cubeSizeFor((board.clientHeight - GROUND) * 0.75 || 420, max);
    state.platforms = drawWorld(board, world);
    thunk();
    startLoop();
  }

  // ---------- drawing ----------
  function place(t) {
    const e = el(t);
    if (!e) return;
    e.style.left = `${t.x}px`;
    e.style.bottom = `${GROUND + t.y}px`;
  }

  function draw(t, opts = {}) {
    let e = el(t);
    if (!e) {
      e = document.createElement('div');
      e.className = 'tower draggable';
      e.dataset.id = t.id;
      board.append(e);
      e.addEventListener('pointerdown', ev => onDown(t, e, ev));
    }
    drawBuddy(e, t.n, { size, ...opts });
    place(t);
    setPose(t);
    return e;
  }

  function setPose(t) {
    const e = el(t);
    if (!e) return;
    const flying = !t.held && !t.resting;
    e.classList.toggle('falling', flying);
    const arms = e.querySelector('.arms');
    if (arms) arms.classList.toggle('up', flying || !!t.held);
  }

  function repaintAll() {
    for (const e of board.querySelectorAll('.tower')) e.remove();
    for (const t of state.towers) draw(t);
  }

  // ---------- towers ----------
  function addTower(n, x = null, y = null) {
    if (!state.world) pickWorld(WORLDS[0].id);
    const id = `t${++seq}`;
    const t = {
      id, n,
      x: x ?? Math.max(0, Math.min(board.clientWidth - size, board.clientWidth / 2 - size / 2 + (Math.random() - 0.5) * 120)),
      y: y ?? (board.clientHeight - GROUND) * 0.7,
      vx: 0, vy: 0, held: false, resting: false,
    };
    state.towers.push(t);
    draw(t);
    if (t.y <= 0) { t.y = 0; land(t, 0, null); }
    else startFall(t);
    say(`is-${n}`);
    return id;
  }

  function startFall(t, spoke = false) {
    t.resting = false;
    t.held = false;
    setPose(t);
    if (!spoke && t.y > size * 1.2) say(`fall-${1 + Math.floor(Math.random() * 2)}`);
  }

  function land(t, y, onto) {
    t.y = y; t.vy = 0; t.vx = 0; t.resting = true;
    place(t); setPose(t);
    const e = el(t);
    if (e) { e.classList.remove('landed'); void e.offsetWidth; e.classList.add('landed'); }
    boing();
    const r = board.getBoundingClientRect();
    sparks(host, t.x + size / 2, r.height - GROUND - y, 8, size * 0.6);
  }

  function splitTop(id) {
    const t = state.towers.find(x => x.id === id);
    if (!t) return null;
    const halves = splitTower(t.n);
    if (!halves) return null;
    const [kept, popped] = halves;
    t.n = kept;
    draw(t);
    const newId = `t${++seq}`;
    const one = { id: newId, n: popped, x: t.x, y: top(t) + GAP, vx: 0, vy: 0, held: false, resting: false };
    state.towers.push(one);
    draw(one);
    say(`is-${kept}`);
    return newId;
  }

  // ---------- adding up ----------
  async function merge(base, faller) {
    const total = joinTowers(base.n, faller.n, max);
    state.towers = state.towers.filter(t => t !== faller);
    el(faller)?.remove();
    if (total === null) return;
    base.resting = true; base.vx = base.vy = 0; base.merging = true;
    const r = board.getBoundingClientRect();
    const cx = base.x + size / 2, cy = r.height - GROUND - top(base);
    flash(host);
    stars(host, cx, cy);
    sparkle();
    await wait(160);
    base.n = total;
    let e = draw(base, { faces: false });
    const glitter = setInterval(() => sparks(host, cx + (Math.random() - 0.5) * size * 1.6, r.height - GROUND - base.y - Math.random() * height(base), 3, 10), 55);
    await say('join');
    const cubes = [...e.querySelectorAll('.cube')].reverse();
    for (let k = 1; k <= total; k++) {
      const cube = cubes[k - 1];
      if (cube) { cube.classList.add('lit'); const cr = cube.getBoundingClientRect(); sparks(host, cr.left + cr.width / 2 - r.left, cr.top + cr.height / 2 - r.top, 10, size * 0.7); }
      ding(k);
      await say(`count-${k}`);
    }
    clearInterval(glitter);
    e = draw(base);
    popFace(e.querySelector('.buddy'));
    e.querySelector('.buddy').classList.add('dance');      // the dance, but no confetti: fireworks belong to Build and Add
    e.querySelector('.arms')?.classList.add('wave');
    fanfare();
    base.merging = false;
    await sayAll([`is-${total}`, `cheer-${1 + Math.floor(Math.random() * 4)}`]);
  }

  function join(idA, idB) {
    const a = state.towers.find(t => t.id === idA);
    const b = state.towers.find(t => t.id === idB);
    if (!a || !b || a === b) return;
    merge(a, b);
  }

  // ---------- physics ----------
  function step(dt) {
    const W = board.clientWidth;
    for (const t of state.towers) {
      if (t.held || t.resting || t.merging) continue;
      const prevY = t.y;
      t.vy = Math.max(-MAX_FALL, t.vy - GRAVITY * dt);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < 0) { t.x = 0; t.vx = -t.vx * 0.4; }
      if (t.x > W - size) { t.x = W - size; t.vx = -t.vx * 0.4; }
      if (t.vy < 0) {
        // another buddy?
        const under = state.towers.find(o => o !== t && !o.held && !o.merging
          && Math.min(o.x + size, t.x + size) - Math.max(o.x, t.x) >= size * MERGE_OVERLAP
          && prevY >= top(o) - 1 && t.y <= top(o));
        if (under) {
          if (joinTowers(under.n, t.n, max) === null) {
            t.y = top(under) + 2; t.vy = 520; t.vx = (t.x + size / 2 < under.x + size / 2 ? -1 : 1) * 320;   // bounce off
            thunk();
          } else {
            t.y = top(under);
            merge(under, t);
          }
          continue;
        }
        // a platform?
        const p = state.platforms.find(p => Math.min(p.left + p.width, t.x + size) - Math.max(p.left, t.x) >= size * 0.4
          && prevY >= p.top - 1 && t.y <= p.top);
        if (p) { land(t, p.top, p); continue; }
        // the ground
        if (t.y <= 0) { land(t, 0, null); continue; }
      }
      place(t);
    }
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    frame = requestAnimationFrame(tick);
  }
  function startLoop() { stopLoop(); last = performance.now(); frame = requestAnimationFrame(tick); }
  function stopLoop() { cancelAnimationFrame(frame); frame = null; }

  // ---------- holding, flinging, splitting ----------
  function boardPoint(ev) {
    const r = board.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: r.bottom - GROUND - ev.clientY };
  }

  function onDown(t, e, ev) {
    if (t.merging) return;
    const p = boardPoint(ev);
    const cube = ev.target.closest('.cube');
    if (cube && cube.dataset.index === '0' && t.n > 1) {
      const id = splitTop(t.id);
      t = state.towers.find(x => x.id === id);
      e = el(t);
      t.x = p.x - size / 2; t.y = p.y - size / 2;
    }
    t.held = true; t.resting = false; t.vx = t.vy = 0;
    drag = { t, ox: p.x - t.x, oy: p.y - t.y, trail: [{ x: p.x, y: p.y, at: performance.now() }] };
    place(t); setPose(t);
    hold.grab(e, ev);
    e.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }
  function onMove(ev) {
    if (!drag) return;
    const p = boardPoint(ev);
    drag.t.x = p.x - drag.ox;
    drag.t.y = p.y - drag.oy;
    drag.trail.push({ x: p.x, y: p.y, at: performance.now() });
    if (drag.trail.length > 6) drag.trail.shift();
    place(drag.t);
    hold.move(ev);
  }
  function onUp() {
    if (!drag) return;
    const { t, trail } = drag;
    drag = null;
    hold.release();
    // The last few frames of finger speed carry the buddy on.
    const a = trail[0], b = trail[trail.length - 1];
    const dt = Math.max(0.016, (b.at - a.at) / 1000);
    t.vx = Math.max(-MAX_FLING, Math.min(MAX_FLING, ((b.x - a.x) / dt) * FLING));
    t.vy = Math.max(-MAX_FLING, Math.min(MAX_FLING, ((b.y - a.y) / dt) * FLING));
    t.x = Math.max(0, Math.min(board.clientWidth - size, t.x));
    t.y = Math.max(0, t.y);
    startFall(t);
    if (Math.abs(t.vx) > 200 || t.vy > 200) say(`fall-${1 + Math.floor(Math.random() * 2)}`);
  }

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  bin.addEventListener('click', () => addTower(1, board.clientWidth / 2 - size / 2 + (Math.random() - 0.5) * 80));
  sweep.addEventListener('click', () => { state.towers = []; repaintAll(); clearFx(host); thunk(); });
  worldsBtn.addEventListener('click', showPicker);

  return {
    state, addTower, join, splitTop, pickWorld, step,
    start() { seq = 0; showPicker(); },
    stop() { hold.release(); drag = null; showPicker(); },
  };
}
