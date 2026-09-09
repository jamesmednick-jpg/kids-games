# Kids Games

Small, ad-free web games for a phone. One folder per game, a launcher at the root.

## Play on a phone

The games are live at **https://jamesmednick-jpg.github.io/kids-games/**

1. Open that link in Safari on the phone.
2. Open a game, tap Share, then "Add to Home Screen".
3. The icon opens the game full screen. After that first visit it works with
   no wifi and no data at all, anywhere.

## Games
- `nail-salon/` — tap a finger to zoom in, then paint with a little polish brush that stays inside the lines, add glitter and stickers, drag rings onto the fingers, and save a photo at the end.
  Parent settings (caption, colors, stickers, skin tones) are at the top of `nail-salon/game.js`; ring styles are in `nail-salon/render.js`.
  After changing any file in the folder, run `npm run publish`. It bumps the
  service worker's cache name, commits and pushes; phones that already have
  the game only pick up an update when that name changes.
- `number-buddies/` — build a number out of cubes, push two buddies together to
  make a bigger one, or play freely with a bin of blocks. Every buddy has a face
  and wears N of its own decoration, so the character design is countable too.
  Parent settings (`MAX_NUMBER`, idle hint delay) are at the top of
  `number-buddies/game.js`; colours and features are in `number-buddies/blocks.js`.
  The voice is pre-generated: edit the voice or the phrases in
  `tools/make-voice.mjs`, then run `npm run voice` (needs a Mac). Giving each
  buddy its own voice is a change to the `VOICES` table there and nothing else.

## Adding a game
1. Create a new folder with its own `index.html`, `manifest.webmanifest`, and `sw.js` (copy from `nail-salon/`).
2. Add a tile to the root `index.html`.
3. Add the folder name to `GAMES` in `tools/games.mjs` so `npm run publish`
   and `npm run icons` know about it.

## Development
```
npm install
npx playwright install chromium
npm test          # unit + browser tests
npm run serve     # http://localhost:4173, and on a phone on the same wifi via your Mac's IP
npm run voice     # regenerate the Number Buddies speech clips (macOS only)
npm run icons -- number-buddies 🔢 "#ffd23f" "#43aa5a"   # redraw a game's icons
npm run publish   # bump the caches of changed games, commit and push to the live site
```

## Publishing
The site is served by GitHub Pages from the `main` branch of
`jamesmednick-jpg/kids-games`. `npm run publish` is the whole update flow.
