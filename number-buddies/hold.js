import { sparks } from './render.js';

// Picking a buddy up. The held buddy lifts, leans into the direction it is
// being dragged, trails sparkles, and wobbles as it settles when let go.
// Add and Play share this; the modes decide what a drop means.
export function makeHold(screen) {
  let cur = null;
  let decay = null;

  function setLean(v) { cur.lean = v; cur.el.style.setProperty('--lean', `${v.toFixed(1)}deg`); }

  return {
    grab(el, e) {
      cur = { el, lean: 0, lastX: e.clientX, lastT: performance.now(), lastSpark: 0 };
      el.classList.remove('settle');
      el.classList.add('held');
      setLean(0);
      // Lean fades back toward upright when the drag pauses.
      clearInterval(decay);
      decay = setInterval(() => { if (cur) setLean(cur.lean * 0.8); }, 60);
    },
    move(e) {
      if (!cur) return;
      const now = performance.now();
      const vx = (e.clientX - cur.lastX) / Math.max(1, now - cur.lastT);   // px per ms
      setLean(Math.max(-14, Math.min(14, cur.lean * 0.5 + vx * 22)));
      cur.lastX = e.clientX; cur.lastT = now;
      if (now - cur.lastSpark > 60) {
        const s = screen.getBoundingClientRect();
        sparks(screen, e.clientX - s.left, e.clientY - s.top, 3, 16);
        cur.lastSpark = now;
      }
    },
    release() {
      if (!cur) return null;
      const el = cur.el;
      cur = null;
      clearInterval(decay);
      el.classList.remove('held');
      el.style.setProperty('--lean', '0deg');
      el.classList.add('settle');
      setTimeout(() => el.classList.remove('settle'), 650);
      return el;
    },
    get active() { return cur; },
  };
}
