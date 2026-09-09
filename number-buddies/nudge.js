// She is five. The game must never stall and never scold: after a pause the
// thing to touch next glows, then a voice offers a hint. It repeats forever
// and never advances the game on her behalf.
export function makeNudge({ delay, onHint, onSpeak }) {
  let timer = null;
  let stage = 0;

  function arm() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stage += 1;
      if (stage === 1) onHint(true); else onSpeak();
      arm();
    }, delay);
  }

  return {
    poke() { stage = 0; onHint(false); arm(); },
    stop() { clearTimeout(timer); stage = 0; onHint(false); },
  };
}
