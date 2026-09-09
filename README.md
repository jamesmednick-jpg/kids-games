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

## Adding a game
1. Create a new folder with its own `index.html`, `manifest.webmanifest`, and `sw.js` (copy from `nail-salon/`).
2. Add a tile to the root `index.html`.

## Development
```
npm install
npx playwright install chromium
npm test          # unit + browser tests
npm run serve     # http://localhost:4173, and on a phone on the same wifi via your Mac's IP
npm run publish   # bump the cache, commit and push to the live site
```

## Publishing
The site is served by GitHub Pages from the `main` branch of
`jamesmednick-jpg/kids-games`. `npm run publish` is the whole update flow.
