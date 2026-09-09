// Tiny synthesized sounds. No audio files.
let ctx = null;
let muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch (err) {
    console.warn('audio unavailable', err);
    ctx = null;
  }
}

export function setMuted(m) { muted = !!m; }
export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (err) {
    console.warn('tone failed', err);
  }
}

export function pop() { tone(620, 0.08, 'triangle', 0.15); }
export function tinkle() { tone(1400 + Math.random() * 1600, 0.12, 'sine', 0.05); }
export function chime() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.18, i * 0.14)); }
