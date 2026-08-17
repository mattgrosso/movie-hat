// Pure helper for backup-hats.mjs's --skip-if-fresh flag: decide whether a
// recent-enough snapshot already exists, from filenames alone.
//
// Ported from Cinema Roll's scripts/snapshotFreshness.mjs, which exists
// because deploy-per-stopping-point there produced 36–56 full database
// downloads a day (~$4–7/day of RTDB egress, Aug 2026) before the predeploy
// backup learned to skip when a fresh snapshot already existed. Movie Hat's
// database is smaller, but the failure mode is identical — every full read
// is billed egress, so the predeploy backup must not re-read a database it
// snapshotted an hour ago.
//
// Snapshot names encode a UTC timestamp: hats-2026-08-17T13-44-45.json.gz
// (colons swapped for dashes to stay filesystem-safe).

export const SNAPSHOT_NAME_RE = /^hats-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json\.gz$/;

export function snapshotTime (filename) {
  const match = SNAPSHOT_NAME_RE.exec(filename);
  if (!match) return null;
  const [, date, hh, mm, ss] = match;
  const time = Date.parse(`${date}T${hh}:${mm}:${ss}Z`);
  return Number.isNaN(time) ? null : time;
}

// Returns the filename of the newest snapshot younger than maxAgeMs, or null.
export function freshSnapshot (filenames, maxAgeMs, now = Date.now()) {
  let newestName = null;
  let newestTime = -Infinity;
  for (const name of filenames) {
    const time = snapshotTime(name);
    if (time === null || time > now) continue; // ignore clock-skewed future names
    if (time > newestTime) {
      newestTime = time;
      newestName = name;
    }
  }
  return newestName !== null && now - newestTime <= maxAgeMs ? newestName : null;
}
