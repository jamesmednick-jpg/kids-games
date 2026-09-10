import { WORLDS, drawWorld } from './worlds.js';
import { mountWorld } from './world.js';
import { thunk } from './audio.js';

// Play is a world with gravity: pick a place, then stack, fling and add up
// with no goals at all. The dance on a merge, but no confetti — fireworks
// belong to Build and Add.
export function mountPlay(host, { max }) {
  const $ = sel => host.querySelector(sel);
  const picker = $('#play-picker');
  const board = $('#play-board');
  const bar = $('.play-bar');

  const world = mountWorld(host, board, { max, allowSplit: true, mergeOnTouch: false, confetti: false, announce: true });
  const state = world.state;
  state.world = null;

  picker.innerHTML = WORLDS.map(w =>
    `<button class="world-tile" data-world="${w.id}"><span class="preview ${w.id}"></span>${w.name}</button>`).join('');
  for (const b of picker.querySelectorAll('[data-world]')) {
    b.addEventListener('click', () => pickWorld(b.dataset.world));
  }

  function showPicker() {
    world.close();
    state.world = null;
    board.textContent = '';
    picker.hidden = false;
    board.hidden = true;
    bar.hidden = true;
  }

  function pickWorld(id) {
    const def = WORLDS.find(w => w.id === id) || WORLDS[0];
    state.world = def.id;
    picker.hidden = true;
    board.hidden = false;
    bar.hidden = false;
    board.textContent = '';
    const platforms = drawWorld(board, def);
    world.open(platforms);
    thunk();
  }

  $('#play-bin').addEventListener('click', () => {
    if (!state.world) pickWorld(WORLDS[0].id);
    world.addTower(1, board.clientWidth / 2 - state.size / 2 + (Math.random() - 0.5) * 80);
  });
  $('#play-sweep').addEventListener('click', () => { world.clear(); thunk(); });
  $('#play-worlds').addEventListener('click', showPicker);

  return {
    state,
    addTower(n, x, y) { if (!state.world) pickWorld(WORLDS[0].id); return world.addTower(n, x, y); },
    join: world.join,
    splitTop: world.splitTop,
    step: world.step,
    pickWorld,
    start() { showPicker(); },
    stop() { showPicker(); },
  };
}
