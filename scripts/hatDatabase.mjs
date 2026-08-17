// Admin access to the hats database, for the maintenance scripts.
//
// Until 2026-08-17 these scripts read and wrote over unauthenticated REST,
// which worked because the database was open to the entire internet. Closing
// that — the whole point of the lockdown — broke every one of them, backup
// included. This is how they get in now: a service account, which bypasses
// the rules the way Cinema Roll's own maintenance scripts do.
//
// Requires MOVIE_HAT_ADMIN_KEY_PATH in .env.local, pointing at a service
// account JSON from the Firebase console (Project settings → Service
// accounts → Generate new private key). Keep it OUT of the repo.

import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;

/** Minimal .env.local reader — no dependency for four lines of parsing. */
function loadEnvLocal () {
  if (!existsSync(ENV_PATH)) return;

  readFileSync(ENV_PATH, 'utf8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1).trim();
  });
}

/**
 * The admin database handle. Exits with an explanation rather than a stack
 * trace when the key is missing, because "database responded 401" is what
 * this replaced and it told nobody anything.
 */
export function hatDatabase () {
  loadEnvLocal();

  const keyPath = process.env.MOVIE_HAT_ADMIN_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    console.error('No service account key.\n');
    console.error('The hats database is closed now, so these scripts need admin credentials:');
    console.error('  1. Firebase console → movie-hat-9c418 → Project settings → Service accounts');
    console.error('  2. Generate new private key, save it OUTSIDE this repo');
    console.error('  3. Put the path in .env.local as MOVIE_HAT_ADMIN_KEY_PATH=/path/to/key.json');
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
      databaseURL: DATABASE_URL
    });
  }

  return getDatabase();
}

/** Read a path. Returns null for anything absent. */
export async function adminGet (path = '/') {
  const snapshot = await hatDatabase().ref(path).get();
  return snapshot.exists() ? snapshot.val() : null;
}

export function adminSet (path, value) {
  return hatDatabase().ref(path).set(value);
}

export function adminUpdate (updates) {
  return hatDatabase().ref('/').update(updates);
}

export function adminRemove (path) {
  return hatDatabase().ref(path).remove();
}
