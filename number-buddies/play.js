import { joinTowers, splitTower } from './blocks.js';
import { drawBuddy, cubeSizeFor } from './render.js';
import { say, thunk, clunk } from './audio.js';

// No goals. She stacks, joins and splits, and every tower says its own number
// whenever it changes. Towers sit on the board by their bottom-left corner,
// so a tower grows upward like real blocks on a table.
export function mountPlay(host, { max }) {
  const $ = sel => host.querySelector(sel);
  const board = $('#play-board');
  const bin = $('#play-bin');
  const sweep = $('#play-sweep');

  const state = { towers: [] };
  let seq = 0;
  let size = 0;
  let drag = null;

  const towerEl = t => board.querySelector(`.tower[data-id="${t.id}"]`);

  function place(t, el) {
    el.style.left = `${t.x}px`;
    el.style.bottom = `${t.y}px`;
  }

  function paint() {
    board.textContent = '';
    for (const t of state.towers) {
      const el = document.createElement('div');
      el.className = 'tower draggable';
      el.dataset.id = t.id;
      place(t, el);
      board.append(el);
      drawBuddy(el, t.n, { size });
      el.addEventListener('pointerdown', e => onDown(t, el, e));
    }
  }

  function addTower(n, x = null, y = null) {
    const id = `t${++seq}`;
    const i = state.towers.length;
    state.towers.push({
      id, n,
      x: x ?? 16 + (i % 4) * size * 1.7,
      y: y ?? 16 + Math.floor(i / 4) * size * 2.2,
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
    if (total === null) { paint(); return; }   // stay inside the parent setting
    a.n = total;
    state.towers = state.towers.filter(t => t !== b);
    paint();
    clunk();
    say(`is-${a.n}`);
  }

  function splitTop(id) {
    const t = state.towers.find(x => x.id === id);
    if (!t) return null;
    const halves = splitTower(t.n);
    if (!halves) return null;                  // a One cannot be split
    const [kept, popped] = halves;
    t.n = kept;
    paint();
    const newId = addTower(popped, t.x + size * 1.3, t.y + size * kept);
    say(`is-${kept}`);
    return newId;
  }

  // Pulling the top cube off a tower splits it and carries the cube away;
  // grabbing anywhere else carries the whole tower.
  function onDown(t, el, e) {
    const rect = board.getBoundingClientRect();
    const topCube = e.target.closest('.cube');
    if (topCube && topCube.dataset.index === '0' && t.n > 1) {
      const newId = splitTop(t.id);
      t = state.towers.find(x => x.id === newId);
      el = towerEl(t);
      t.x = e.clientX - rect.left - size / 2;
      t.y = rect.bottom - e.clientY - size / 2;
      place(t, el);
    }
    drag = { t, el, ox: e.clientX - rect.left - t.x, oy: (rect.bottom - e.clientY) - t.y };
    el.classList.add('lifted');
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag) return;
    const rect = board.getBoundingClientRect();
    drag.t.x = e.clientX - rect.left - drag.ox;
    drag.t.y = (rect.bottom - e.clientY) - drag.oy;
    place(drag.t, drag.el);
  }
  function onUp() {
    if (!drag) return;
    const me = drag.t;
    drag.el.classList.remove('lifted');
    drag = null;
    // Keep it on the table.
    me.x = Math.max(0, Math.min(board.clientWidth - size, me.x));
    me.y = Math.max(0, me.y);
    // Dropping a tower on or against another joins them.
    const near = state.towers.find(o => o !== me
      && Math.abs(o.x - me.x) < size
      && me.y < o.y + o.n * size + size && o.y < me.y + me.n * size + size);
    if (near) join(near.id, me.id); else paint();
  }

  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  bin.addEventListener('click', () => addTower(1));
  sweep.addEventListener('click', () => { state.towers = []; paint(); thunk(); });

  return {
    state, addTower, join, splitTop,
    start() { size = cubeSizeFor(board.clientHeight || 420, max); state.towers = []; seq = 0; paint(); },
    stop() { state.towers = []; paint(); },
  };
}
