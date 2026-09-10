import { joinTowers, splitTower } from './blocks.js';
import { drawBuddy, cubeSizeFor, GAP, popFace, stars, flash, sparks, clearFx, celebrate as party } from './render.js';
import { say, sayAll, sayNow, thunk, boing, ding, sparkle, fanfare } from './audio.js';
import { makeHold } from './hold.js';
import { GROUND } from './worlds.js';

// ===== Physics: edit these freely =====
export const PHYSICS = {
  GRAVITY: 2600,        // px per second per second
  MAX_FALL: 1900,       // px per second
  FLING: 1.0,           // how much of the finger's speed a let-go buddy keeps
  MAX_FLING: 900,       // px per second; a flick never sends a buddy ricocheting round the world
  MERGE_OVERLAP: 0.5,   // fraction of a cube two towers must overlap to add up
};
// ======================================

// The engine behind Play and Add: towers with gravity on a board with a
// ground and platforms. Pick one up, carry it anywhere, fling it, drop it on
// another to add them up. Play and Add differ only in the options.
export function mountWorld(host, board, {
  max,
  allowSplit = true,        // pull the top cube off to split
  mergeOnTouch = false,     // also add up when one is pushed into the other while held
  confetti = false,         // the full party on a merge (Build and Add), or just the dance (Play)
  announce = true,          // say "I'm N!" when a tower is added
  onMergeStart = null,      // (a, b) — the instant two buddies begin to add up
  onMerged = null,          // (total, a, b) — a chance to speak before "I'm N!"
} = {}) {
  const state = { towers: [], platforms: [], size: 0 };
  let seq = 0;
  let drag = null;
  let frame = null;
  let last = 0;
  let beckoning = null;
  let beckonTimer = null;
  const hold = makeHold(host);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const height = t => t.n * state.size + (t.n - 1) * GAP;
  const top = t => t.y + height(t);
  const el = t => board.querySelector(`.tower[data-id="${t.id}"]`);
  const size = () => state.size;

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
    e.dataset.n = t.n;
    drawBuddy(e, t.n, { size: size(), ...opts });
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
    const id = `t${++seq}`;
    const W = board.clientWidth;
    const t = {
      id, n,
      x: x ?? Math.max(0, Math.min(W - size(), W / 2 - size() / 2 + (Math.random() - 0.5) * 120)),
      y: y ?? (board.clientHeight - GROUND) * 0.7,
      vx: 0, vy: 0, held: false, resting: false,
    };
    state.towers.push(t);
    draw(t);
    if (t.y <= 0) { t.y = 0; land(t, 0, true); }
    else startFall(t);
    if (announce) say(`is-${n}`);
    return id;
  }

  function startFall(t, quiet = false) {
    t.resting = false;
    t.held = false;
    setPose(t);
    if (!quiet && t.y > size() * 1.2) sayNow(`fall-${1 + Math.floor(Math.random() * 2)}`);
  }

  function land(t, y, quiet = false) {
    t.y = y; t.vy = 0; t.vx = 0; t.resting = true;
    place(t); setPose(t);
    const e = el(t);
    if (e) { e.classList.remove('landed'); void e.offsetWidth; e.classList.add('landed'); }
    if (quiet) return;
    boing();
    const r = board.getBoundingClientRect();
    sparks(host, t.x + size() / 2 + (r.left - host.getBoundingClientRect().left), r.height - GROUND - y + (r.top - host.getBoundingClientRect().top), 8, size() * 0.6);
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

  // ---------- adding up: the show's signature beat ----------
  async function merge(base, faller) {
    const a = base.n, b = faller.n;
    const total = joinTowers(a, b, max);
    state.towers = state.towers.filter(t => t !== faller);
    el(faller)?.remove();
    if (total === null) return;
    beckon(null);
    base.resting = true; base.vx = base.vy = 0; base.merging = true;
    onMergeStart?.(a, b);
    const hr = host.getBoundingClientRect(), r = board.getBoundingClientRect();
    const cx = base.x + size() / 2 + (r.left - hr.left), cy = r.height - GROUND - top(base) + (r.top - hr.top);
    flash(host);
    stars(host, cx, cy);
    sparkle();
    await wait(160);
    base.n = total;
    let e = draw(base, { faces: false });
    const glitter = setInterval(() => sparks(host, cx + (Math.random() - 0.5) * size() * 1.6, r.height - GROUND - base.y - Math.random() * height(base) + (r.top - hr.top), 3, 10), 55);
    await say('join');
    const cubes = [...e.querySelectorAll('.cube')].reverse();
    for (let k = 1; k <= total; k++) {
      const cube = cubes[k - 1];
      if (cube) {
        cube.classList.add('lit');
        const cr = cube.getBoundingClientRect();
        sparks(host, cr.left + cr.width / 2 - hr.left, cr.top + cr.height / 2 - hr.top, 10, size() * 0.7);
      }
      ding(k);
      await say(`count-${k}`);
    }
    clearInterval(glitter);
    e = draw(base);
    const buddy = e.querySelector('.buddy');
    popFace(buddy);
    if (confetti) party(host, buddy, total);
    else buddy.classList.add('dance');
    e.querySelector('.arms')?.classList.add('wave');
    fanfare();
    base.merging = false;
    onMerged?.(total, a, b);
    await sayAll([`is-${total}`, `cheer-${1 + Math.floor(Math.random() * 4)}`]);
  }

  function join(idA, idB) {
    const a = state.towers.find(t => t.id === idA);
    const b = state.towers.find(t => t.id === idB);
    if (!a || !b || a === b) return;
    merge(a, b);
  }

  // ---------- "come here!" ----------
  function beckon(other, toward = 1) {
    if (beckoning && beckoning !== other) {
      el(beckoning)?.classList.remove('beckon');
    }
    clearInterval(beckonTimer); beckonTimer = null;
    beckoning = other;
    if (!other) return;
    const e = el(other);
    if (!e) return;
    e.classList.add('beckon');
    e.style.setProperty('--toward', toward);
    beckonTimer = setInterval(() => {
      if (!drag) return;
      const hr = host.getBoundingClientRect(), r = board.getBoundingClientRect();
      const midX = (drag.t.x + other.x + size()) / 2 + (r.left - hr.left);
      const y = r.height - GROUND - Math.min(drag.t.y, other.y) - size() * 0.6 + (r.top - hr.top);
      sparks(host, midX, y, 5, 34);
    }, 70);
  }

  // ---------- physics ----------
  const overlapX = (t, o) => Math.min(o.x + size(), t.x + size()) - Math.max(o.x, t.x);

  function step(dt) {
    const W = board.clientWidth;
    for (const t of state.towers) {
      if (t.held || t.resting || t.merging) continue;
      const prevY = t.y;
      t.vy = Math.max(-PHYSICS.MAX_FALL, t.vy - PHYSICS.GRAVITY * dt);
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < 0) { t.x = 0; t.vx = -t.vx * 0.4; }
      if (t.x > W - size()) { t.x = W - size(); t.vx = -t.vx * 0.4; }
      if (t.vy < 0) {
        const under = state.towers.find(o => o !== t && !o.held && !o.merging
          && overlapX(t, o) >= size() * PHYSICS.MERGE_OVERLAP && prevY >= top(o) - 1 && t.y <= top(o));
        if (under) {
          if (joinTowers(under.n, t.n, max) === null) {
            t.y = top(under) + 2; t.vy = 520; t.vx = (t.x + size() / 2 < under.x + size() / 2 ? -1 : 1) * 320;   // bounce off
            thunk();
          } else {
            t.y = top(under);
            merge(under, t);
          }
          continue;
        }
        const p = state.platforms.find(p => Math.min(p.left + p.width, t.x + size()) - Math.max(p.left, t.x) >= size() * 0.4
          && prevY >= p.top - 1 && t.y <= p.top);
        if (p) { land(t, p.top); continue; }
        if (t.y <= 0) { land(t, 0); continue; }
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
    if (allowSplit && cube && cube.dataset.index === '0' && t.n > 1) {
      const id = splitTop(t.id);
      t = state.towers.find(x => x.id === id);
      e = el(t);
      t.x = p.x - size() / 2; t.y = p.y - size() / 2;
    }
    t.held = true; t.resting = false; t.vx = t.vy = 0;
    drag = { t, ox: p.x - t.x, oy: p.y - t.y, trail: [{ x: p.x, y: p.y, at: performance.now() }] };
    place(t); setPose(t);
    hold.grab(e, ev);
    e.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }

  function touching(t, o) {
    return overlapX(t, o) >= size() * PHYSICS.MERGE_OVERLAP && t.y < top(o) + size() * 0.3 && o.y < top(t) + size() * 0.3;
  }

  function onMove(ev) {
    if (!drag) return;
    const p = boardPoint(ev);
    const t = drag.t;
    t.x = p.x - drag.ox;
    t.y = p.y - drag.oy;
    drag.trail.push({ x: p.x, y: p.y, at: performance.now() });
    if (drag.trail.length > 6) drag.trail.shift();
    place(t);
    hold.move(ev);
    // The nearest other buddy gets excited when this one comes close.
    const others = state.towers.filter(o => o !== t && !o.held && !o.merging);
    const near = others.find(o => Math.abs((o.x + size() / 2) - (t.x + size() / 2)) < board.clientWidth * 0.35);
    if (near !== beckoning) beckon(near, near && near.x < t.x ? 1 : -1);
    // In Add, pushing them into each other is enough.
    if (mergeOnTouch && near && touching(t, near) && joinTowers(near.n, t.n, max) !== null) {
      drag = null;
      hold.release();
      t.held = false;
      t.y = top(near);
      merge(near, t);
    }
  }

  function onUp() {
    if (!drag) return;
    const { t, trail } = drag;
    drag = null;
    hold.release();
    beckon(null);
    // Only the last tenth of a second counts: a buddy held still and let go
    // drops straight down; one let go mid-swing keeps flying.
    const now = performance.now();
    const recent = trail.filter(s => now - s.at <= 110);
    const stoppedFirst = now - trail[trail.length - 1].at > 50;
    const clamp = v => Math.max(-PHYSICS.MAX_FLING, Math.min(PHYSICS.MAX_FLING, v));
    if (!stoppedFirst && recent.length >= 2) {
      const a = recent[0], b = recent[recent.length - 1];
      const dt = Math.max(0.016, (b.at - a.at) / 1000);
      t.vx = clamp(((b.x - a.x) / dt) * PHYSICS.FLING);
      t.vy = clamp(((b.y - a.y) / dt) * PHYSICS.FLING);
    } else {
      t.vx = 0; t.vy = 0;
    }
    t.x = Math.max(0, Math.min(board.clientWidth - size(), t.x));
    t.y = Math.max(0, t.y);
    startFall(t, true);
    if (Math.abs(t.vx) > 200 || t.vy > 200 || t.y > size() * 1.2) sayNow(`fall-${1 + Math.floor(Math.random() * 2)}`);
  }

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);

  return {
    state, addTower, join, splitTop, step,
    towerEls: () => [...board.querySelectorAll('.tower')],
    // Opens the board for play: works out the cube size, takes the platforms, starts gravity.
    open(platforms = []) {
      state.platforms = platforms;
      state.size = cubeSizeFor((board.clientHeight - GROUND) * 0.75 || 420, max);
      state.towers = [];
      repaintAll();
      startLoop();
    },
    clear() { state.towers = []; repaintAll(); clearFx(host); },
    close() { stopLoop(); hold.release(); drag = null; beckon(null); state.towers = []; repaintAll(); clearFx(host); },
    get held() { return drag ? drag.t : null; },
  };
}
