// Full backup of the Movie Hat database.
//
//   yarn backup-hats               # snapshot -> ~/movie-hat-backups/ + S3
//   yarn backup-hats --local-only  # skip the S3 upload
//   yarn backup-hats --quiet       # one line of output (for predeploy)
//   --skip-if-fresh[=hours]        # no-op if a snapshot newer than N hours
//                                  # (default 6) exists. Used by predeploy:
//                                  # every backup is a FULL read of the
//                                  # database, and full reads are billed
//                                  # RTDB egress — this exact pattern cost
//                                  # Cinema Roll $4-7/day before its
//                                  # predeploy learned to skip (see
//                                  # snapshotFreshness.mjs). Manual
//                                  # `yarn backup-hats` never skips.
//
// Why this exists (Matt, 2026-08-16): "these hats are used a lot. We
// definitely don't wanna lose anything. So if there's any kind of backup we
// can do, that's also really valuable." Written BEFORE any of the account
// migration or rules work, so there is always a known-good copy to go back
// to — the same reasoning behind Cinema Roll's scripts/backup-database.mjs,
// which this mirrors.
//
// Reads with a service account (see scripts/hatDatabase.mjs). It used to
// need no credentials at all — a plain unauthenticated GET returned every
// hat, which was the finding that started the lockdown. Closing the database
// broke this script, which is a good sign for the lockdown and a bad one for
// the backups, so it now gets in the way it always should have.
//
// Restore path: scripts/restore-hats.mjs.

import { writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { gzipSync } from 'zlib';
import { homedir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { adminGet } from './hatDatabase.mjs';
import { freshSnapshot } from './snapshotFreshness.mjs';

const BACKUP_DIR = join(homedir(), 'movie-hat-backups');
const S3_BUCKET = 'movie-hat-db-backups';
const AWS_PROFILE = 'personal-deploy';

const quiet = process.argv.includes('--quiet');
const localOnly = process.argv.includes('--local-only');
const log = (...args) => { if (!quiet) console.log(...args); };

const skipIfFreshArg = process.argv.find((arg) => arg === '--skip-if-fresh' || arg.startsWith('--skip-if-fresh='));
const skipIfFreshHours = skipIfFreshArg
  ? Number(skipIfFreshArg.split('=')[1] ?? 6) || 6
  : null;

function timestampName () {
  // 2026-08-16T14-30-05 — filesystem-safe and chronologically sortable.
  return new Date().toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
}

// Every snapshot from the last 14 days, plus the first snapshot of each month
// forever. Never removes the file just written.
export function pruneLocal (dir, now = Date.now()) {
  const files = readdirSync(dir)
    .filter((file) => /^hats-\d{4}-\d{2}-\d{2}T.*\.json\.gz$/.test(file))
    .sort();

  const monthlyKept = new Set();
  const seenMonths = new Set();
  for (const file of files) {
    const month = file.slice(5, 12); // YYYY-MM
    if (!seenMonths.has(month)) {
      seenMonths.add(month);
      monthlyKept.add(file);
    }
  }

  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const file of files) {
    const date = new Date(file.slice(5, 15));
    if (date.getTime() >= cutoff) continue;
    if (monthlyKept.has(file)) continue;
    unlinkSync(join(dir, file));
    removed.push(file);
  }
  return removed;
}

/** Counts worth seeing in the log, so a truncated backup is obvious. */
export function summarize (data) {
  const hats = Object.entries(data?.hats || {});
  let movies = 0;
  let drawn = 0;

  hats.forEach(([, byKey]) => {
    Object.values(byKey || {}).forEach((hat) => {
      movies += Object.keys(hat?.movies || {}).length;
      drawn += Object.keys(hat?.history || {}).length;
    });
  });

  return { hats: hats.length, movies, drawn };
}

async function main () {
  // The cost gate: a fresh-enough snapshot means no database read at all.
  if (skipIfFreshHours && existsSync(BACKUP_DIR)) {
    const fresh = freshSnapshot(readdirSync(BACKUP_DIR), skipIfFreshHours * 60 * 60 * 1000);
    if (fresh) {
      console.log(`hats backup: skipped — ${fresh} is under ${skipIfFreshHours}h old`);
      process.exit(0);
    }
  }

  log('Reading the whole database…');
  const data = await adminGet('/');
  if (!data || !data.hats) {
    throw new Error('no hats in the response — refusing to write an empty backup');
  }

  const counts = summarize(data);
  const gz = gzipSync(Buffer.from(JSON.stringify(data)));

  mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `hats-${timestampName()}.json.gz`;
  const localPath = join(BACKUP_DIR, name);
  writeFileSync(localPath, gz);

  const mb = (gz.length / 1024 / 1024).toFixed(2);
  log(`✔ local: ${localPath}`);
  log(`  ${mb} MB gz — ${counts.hats} hats, ${counts.movies} movies waiting, ${counts.drawn} drawn`);

  const removed = pruneLocal(BACKUP_DIR);
  if (removed.length) log(`  pruned ${removed.length} old snapshot(s) per retention`);

  if (!localOnly) {
    try {
      execFileSync('aws', ['s3', 'cp', localPath, `s3://${S3_BUCKET}/${name}`, '--profile', AWS_PROFILE], { stdio: 'pipe' });
      log(`✔ offsite: s3://${S3_BUCKET}/${name}`);
    } catch (error) {
      const detail = String(error.stderr || error.message).trim().split('\n').pop();
      console.error(`! S3 upload failed (the local snapshot still stands): ${detail}`);
      console.error(`  the bucket may need creating: aws s3 mb s3://${S3_BUCKET} --profile ${AWS_PROFILE}`);
    }
  }

  if (quiet) console.log(`hats backup: ${name} (${mb} MB, ${counts.hats} hats)`);
  process.exit(0);
}

// Only run when invoked as a script — the tests import pruneLocal and
// summarize from here, and an import must never trigger a database read.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error('Backup failed:', error.message);
    process.exit(1);
  });
}
