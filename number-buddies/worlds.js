// The four worlds. Platform positions are fractions of the board: x and w of
// its width, y the platform's top as a fraction of the height above the
// ground. Every world is available always — these are scenery, not levels.
export const WORLDS = [
  { id: 'meadow', name: 'Meadow', platforms: [{ x: 0.06, y: 0.20, w: 0.22 }, { x: 0.62, y: 0.36, w: 0.26 }, { x: 0.34, y: 0.56, w: 0.20 }] },
  { id: 'clouds', name: 'Clouds', platforms: [{ x: 0.05, y: 0.24, w: 0.30 }, { x: 0.55, y: 0.44, w: 0.36 }, { x: 0.22, y: 0.66, w: 0.30 }] },
  { id: 'rainbow', name: 'Rainbow', platforms: [{ x: 0.04, y: 0.28, w: 0.28 }, { x: 0.36, y: 0.48, w: 0.28 }, { x: 0.68, y: 0.28, w: 0.28 }, { x: 0.58, y: 0.70, w: 0.24 }] },
  { id: 'night', name: 'Night', platforms: [{ x: 0.08, y: 0.28, w: 0.26 }, { x: 0.58, y: 0.48, w: 0.30 }, { x: 0.28, y: 0.70, w: 0.24 }] },
  { id: 'castle', name: 'Castle', platforms: [{ x: 0.05, y: 0.26, w: 0.26 }, { x: 0.37, y: 0.44, w: 0.26 }, { x: 0.69, y: 0.26, w: 0.26 }, { x: 0.22, y: 0.68, w: 0.22 }, { x: 0.58, y: 0.70, w: 0.22 }] },
];

export const GROUND = 36;          // px; the grass / floor strip along the bottom
const PLATFORM_H = 24;             // px; how thick a platform looks

const SCENERY = {
  meadow: `<i class="sun"></i><i class="hill hill-a"></i><i class="hill hill-b"></i><i class="cloud-far" style="left:14%;top:12%"></i><i class="cloud-far" style="left:64%;top:22%;transform:scale(.7)"></i>`,
  clouds: `<i class="cloud-far" style="left:8%;top:10%;transform:scale(1.2)"></i><i class="cloud-far" style="left:60%;top:6%"></i><i class="cloud-far" style="left:30%;top:34%;transform:scale(.8)"></i><i class="cloud-far" style="left:70%;top:60%;transform:scale(.9)"></i><i class="sun sun-soft"></i>`,
  rainbow: `<i class="rainbow-arc"></i><i class="sun sun-low"></i><i class="cloud-far" style="left:6%;top:50%;transform:scale(.8)"></i>`,
  castle: `<i class="castle-keep"></i><i class="castle-tower" style="left:8%"></i><i class="castle-tower" style="right:8%"></i><i class="castle-tower castle-tower-tall"></i>` +
    ['12%,14%', '30%,8%', '48%,20%', '66%,10%', '84%,18%', '22%,40%', '76%,44%', '52%,60%'].map((p, i) => { const [l, t] = p.split(','); return `<i class="twinkle" style="left:${l};top:${t};animation-delay:${-i * 0.4}s"></i>`; }).join(''),
  night: `<i class="moon"></i><i class="star-dot" style="left:12%;top:10%"></i><i class="star-dot" style="left:30%;top:22%;transform:scale(.6)"></i><i class="star-dot" style="left:52%;top:8%"></i><i class="star-dot" style="left:78%;top:16%;transform:scale(.7)"></i><i class="star-dot" style="left:88%;top:40%"></i><i class="star-dot" style="left:20%;top:48%;transform:scale(.5)"></i><i class="star-dot" style="left:64%;top:36%;transform:scale(.6)"></i><i class="shooting-star"></i>`,
};

// Paints a world into the board and returns its platforms in board pixels,
// with `top` measured up from the ground.
export function drawWorld(board, world) {
  board.dataset.world = world.id;
  board.innerHTML = `<div class="scenery">${SCENERY[world.id] || ''}</div><div class="ground"></div>`;
  const W = board.clientWidth, H = board.clientHeight - GROUND;
  const platforms = world.platforms.map(p => ({ left: Math.round(p.x * W), top: Math.round(p.y * H), width: Math.round(p.w * W) }));
  for (const p of platforms) {
    const el = document.createElement('div');
    el.className = `platform ${world.id}`;
    el.style.cssText = `left:${p.left}px; bottom:${GROUND + p.top - PLATFORM_H}px; width:${p.width}px; height:${PLATFORM_H}px`;
    board.append(el);
  }
  return platforms;
}
