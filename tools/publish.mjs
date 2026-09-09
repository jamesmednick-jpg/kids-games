// Publish the games to GitHub Pages.
//
// Bumps the service worker cache name of every game with uncommitted changes:
// phones that already installed a game keep serving the old cached copy until
// that name changes, so skipping this step means an update nobody ever sees.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { GAMES, bumpCache } from './games.mjs';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const status = git('status', '--porcelain');
if (!status) {
  // Nothing new to commit, but commits made by hand may still be waiting.
  const unpushed = git('log', '--oneline', '@{u}..HEAD');
  if (!unpushed) {
    console.log('Nothing to publish.');
    process.exit(0);
  }
  git('push');
  console.log(`Pushed ${unpushed.split('\n').length} commit(s). GitHub Pages rebuilds in about a minute:`);
  console.log('  https://jamesmednick-jpg.github.io/kids-games/');
  process.exit(0);
}

const bumped = [];
for (const game of GAMES) {
  if (!status.split('\n').some(line => line.slice(3).startsWith(game + '/'))) continue;
  const path = `${ROOT}${game}/sw.js`;
  const { text, version } = bumpCache(await readFile(path, 'utf8'), game);
  await writeFile(path, text);
  bumped.push(`${game} v${version}`);
  console.log(`cache bumped to ${game}-v${version}`);
}
if (!bumped.length) console.log('No game files changed; publishing without a cache bump.');

git('add', '-A');
git('commit', '-m', process.argv[2] || `Update ${bumped.join(', ') || 'the site'}`);
git('push');
console.log('\nPushed. GitHub Pages rebuilds in about a minute:');
console.log('  https://jamesmednick-jpg.github.io/kids-games/');
console.log('\nOn her phone the new version arrives the second time she opens a game.');
