// Publish the games to GitHub Pages.
//
// Bumps the service worker cache name of every game that changed: phones
// that already installed a game keep serving the old cached copy until that
// name changes, so skipping this step means an update nobody ever sees.
// "Changed" means uncommitted edits, or commits not yet pushed.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { GAMES, bumpCache } from './games.mjs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const dirty = git('status', '--porcelain').split('\n').filter(Boolean).map(l => l.slice(3));
const unpushed = git('diff', '--name-only', '@{u}..HEAD').split('\n').filter(Boolean);
const changed = [...dirty, ...unpushed];
if (!changed.length) {
  console.log('Nothing to publish.');
  process.exit(0);
}

const bumped = [];
for (const game of GAMES) {
  if (!changed.some(f => f.startsWith(game + '/'))) continue;
  const path = `${ROOT}${game}/sw.js`;
  const { text, version } = bumpCache(await readFile(path, 'utf8'), game);
  await writeFile(path, text);
  bumped.push(`${game} v${version}`);
  console.log(`cache bumped to ${game}-v${version}`);
}
if (!bumped.length) console.log('No game files changed; publishing without a cache bump.');

if (git('status', '--porcelain')) {
  git('add', '-A');
  git('commit', '-m', process.argv[2] || `Update ${bumped.join(', ') || 'the site'}`);
}
git('push');
console.log('\nPushed. GitHub Pages rebuilds in about a minute:');
console.log('  https://jamesmednick-jpg.github.io/kids-games/');
console.log('\nOn her phone the new version arrives the second time she opens a game.');
