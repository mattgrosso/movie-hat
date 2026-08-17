// Restore the Movie Hat database from a backup written by backup-hats.mjs.
//
//   yarn restore-hats                          # list the snapshots available
//   yarn restore-hats --file hats-….json.gz    # show what it WOULD change
//   yarn restore-hats --file hats-….json.gz --apply
//   yarn restore-hats --file … --apply --hat "Dev Hat"   # one hat only
//
// A backup nobody has ever restored from is not a backup. This is the other
// half of the safety net for the account migration and the rules lockdown
// (Matt, 2026-08-16: "these hats are used a lot. We definitely don't wanna
// lose anything").
//
// Safety, in order:
//   1. Nothing is written without --apply.
//   2. --apply takes a fresh backup of the CURRENT state first, so a restore
//      that turns out to be the wrong call is itself reversible.
//   3. A whole-database restore reports exactly which hats would be added,
//      changed or LOST, and refuses to run if it would drop hats unless
//      --allow-deletions is given.
//   4. --hat restores a single hat and touches nothing else, which is the
//      option to reach for first.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { homedir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { adminGet, adminSet } from './hatDatabase.mjs';

const BACKUP_DIR = join(homedir(), 'movie-hat-backups');

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const apply = args.includes('--apply');
const allowDeletions = args.includes('--allow-deletions');
const file = valueAfter('--file');
const onlyHat = valueAfter('--hat');

function listSnapshots () {
  if (!existsSync(BACKUP_DIR)) return [];
  return readdirSync(BACKUP_DIR).filter((name) => name.endsWith('.json.gz')).sort().reverse();
}

/** What restoring `backup` over `current` would do, hat by hat. */
export function diffHats (currentHats = {}, backupHats = {}) {
  const currentNames = new Set(Object.keys(currentHats));
  const backupNames = new Set(Object.keys(backupHats));

  const countMovies = (byKey) => Object.values(byKey || {})
    .reduce((total, hat) => total + Object.keys(hat?.movies || {}).length, 0);

  return {
    restored: [...backupNames].filter((name) => currentNames.has(name)),
    readded: [...backupNames].filter((name) => !currentNames.has(name)),
    // The dangerous column: hats that exist NOW and are not in the backup, so
    // a whole-database restore would erase them.
    lost: [...currentNames].filter((name) => !backupNames.has(name))
      .map((name) => ({ name, movies: countMovies(currentHats[name]) }))
  };
}

async function readCurrent () {
  return (await adminGet('hats')) || {};
}

async function main () {
  const snapshots = listSnapshots();

  if (!file) {
    if (!snapshots.length) {
      console.error(`No snapshots in ${BACKUP_DIR}. Run: yarn backup-hats`);
      process.exit(1);
    }
    console.log(`Snapshots in ${BACKUP_DIR} (newest first):\n`);
    snapshots.slice(0, 20).forEach((name) => console.log(`  ${name}`));
    console.log('\nRe-run with --file <name> to see what restoring it would change.');
    process.exit(0);
  }

  const path = file.includes('/') ? file : join(BACKUP_DIR, file);
  const backup = JSON.parse(gunzipSync(readFileSync(path)).toString());
  const backupHats = backup?.hats;
  if (!backupHats) throw new Error(`${path} contains no hats`);

  const currentHats = await readCurrent();

  if (onlyHat) {
    const replacement = backupHats[onlyHat];
    if (!replacement) throw new Error(`"${onlyHat}" is not in that backup`);

    const before = Object.values(currentHats[onlyHat] || {})
      .reduce((total, hat) => total + Object.keys(hat?.movies || {}).length, 0);
    const after = Object.values(replacement)
      .reduce((total, hat) => total + Object.keys(hat?.movies || {}).length, 0);

    console.log(`"${onlyHat}": ${before} movies now → ${after} from the backup`);

    if (!apply) {
      console.log('\nDry run. Re-run with --apply to restore just this hat.');
      process.exit(0);
    }

    console.log('Backing up the current state first…');
    execFileSync('node', [join(import.meta.dirname, 'backup-hats.mjs'), '--local-only', '--quiet'], { stdio: 'inherit' });

    await adminSet(`hats/${onlyHat}`, replacement);
    console.log(`✔ restored "${onlyHat}"`);
    process.exit(0);
  }

  const diff = diffHats(currentHats, backupHats);
  console.log(`Restoring ${path} over the live database would:`);
  console.log(`  overwrite  ${diff.restored.length} hat(s) that exist in both`);
  console.log(`  re-add     ${diff.readded.length} hat(s) missing from the database`);
  console.log(`  DELETE     ${diff.lost.length} hat(s) created since the backup`);
  diff.lost.forEach(({ name, movies }) => console.log(`      - "${name}" (${movies} movies)`));

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to restore.');
    process.exit(0);
  }

  if (diff.lost.length && !allowDeletions) {
    console.error('\nRefusing to run: that would delete hats created since the backup.');
    console.error('Restore one hat at a time with --hat "Name", or pass --allow-deletions if you really mean it.');
    process.exit(1);
  }

  console.log('Backing up the current state first…');
  execFileSync('node', [join(import.meta.dirname, 'backup-hats.mjs'), '--local-only', '--quiet'], { stdio: 'inherit' });

  await adminSet('hats', backupHats);
  console.log(`✔ restored ${Object.keys(backupHats).length} hats`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Restore failed:', error.message);
  process.exit(1);
});
