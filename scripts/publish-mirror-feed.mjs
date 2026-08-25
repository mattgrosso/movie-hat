// Turn on, and republish, a hat's Magic Mirror feed from the command line.
//
//   yarn publish-mirror-feed                        (dry run, The Movie Hat)
//   yarn publish-mirror-feed --write
//   yarn publish-mirror-feed --hat "Horror" --write
//
// The app publishes this feed on its own — on every draw, and at most once
// every six hours on load. This script exists for the two cases the app
// cannot cover:
//
//   1. BOOTSTRAP. The mirror needs its URL before anybody has pressed "Turn
//      on the mirror feed" in the app, and the mirror is a wall display with
//      no keyboard. Running this once mints the secret and publishes the
//      first feed, so the URL can be pasted into the mirror's config.
//   2. REPAIR. If the feed goes stale because nobody has opened the app,
//      this refreshes it without anyone having to.
//
// Uses the admin service account, which bypasses rules — the same credentials
// every other maintenance script here uses (MOVIE_HAT_ADMIN_KEY_PATH).
import { randomBytes } from 'node:crypto';

import { adminGet, adminSet } from './hatDatabase.mjs';
import { buildMirrorFeed } from '../src/assets/javascript/mirrorFeed.js';

const DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';
const WRITE = process.argv.includes('--write');

const hatArgIndex = process.argv.indexOf('--hat');
const TITLE = hatArgIndex === -1 ? 'The Movie Hat' : process.argv[hatArgIndex + 1];

if (!TITLE) {
  console.error('--hat needs a hat title.');
  process.exit(1);
}

// A title can name more than one hat — the key is the identity — so say which
// one when that happens rather than guessing.
const byKey = await adminGet(`hats/${TITLE}`);

if (!byKey) {
  console.error(`No hat titled "${TITLE}".`);
  process.exit(1);
}

const hatKeys = Object.keys(byKey);

if (hatKeys.length > 1) {
  console.error(`"${TITLE}" names ${hatKeys.length} hats: ${hatKeys.join(', ')}.`);
  console.error('This script publishes one hat; disambiguate in the database first.');
  process.exit(1);
}

const hatKey = hatKeys[0];
const hat = byKey[hatKey];

// ── the secret ──────────────────────────────────────────────────────────────
// Reused if the hat already has one. Minting a fresh secret on every run would
// silently invalidate the URL already sitting in the mirror's config.
let secret = hat.mirrorFeedKey;

if (typeof secret === 'string' && secret.length >= 16) {
  console.log(`"${TITLE}" (${hatKey}): feed already on.`);
} else {
  secret = randomBytes(16).toString('hex');
  console.log(`"${TITLE}" (${hatKey}): minting a new feed key.`);
  if (WRITE) await adminSet(`hats/${TITLE}/${hatKey}/mirrorFeedKey`, secret);
}

// ── the feed ────────────────────────────────────────────────────────────────
const feed = buildMirrorFeed(hat.history);

if (feed.currentPick) {
  const drawn = new Date(feed.currentPick.dateDrawn).toDateString();
  console.log(`\nLatest pick: ${feed.currentPick.title} (drawn ${drawn})`);
} else {
  console.log('\nNothing has been drawn from this hat yet — publishing an empty pick.');
}

const url = `${DATABASE_URL}/mirrorFeed/${encodeURIComponent(TITLE)}/${hatKey}/${secret}.json`;

if (!WRITE) {
  console.log('\nDRY RUN — nothing written. Re-run with --write.');
  console.log(`Would publish to: ${url}`);
  process.exit(0);
}

await adminSet(`mirrorFeed/${TITLE}/${hatKey}/${secret}`, feed);

console.log(`\nPublished. Mirror feed URL:\n  ${url}`);
process.exit(0);
