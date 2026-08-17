// The freshness gate is what keeps the predeploy backup from re-reading the
// whole database on every deploy — the exact pattern that ran up Cinema
// Roll's RTDB egress bill. If this misjudges "fresh", we either pay for
// redundant full reads or silently stop taking backups.
import { describe, it, expect } from 'vitest';
import { snapshotTime, freshSnapshot } from '../../scripts/snapshotFreshness.mjs';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-08-17T12:00:00Z');

describe('snapshotTime', () => {
  it('decodes the filesystem-safe timestamp back to UTC', () => {
    expect(snapshotTime('hats-2026-08-17T09-30-05.json.gz')).toBe(Date.parse('2026-08-17T09:30:05Z'));
  });

  it('rejects names that are not snapshots', () => {
    expect(snapshotTime('hats-latest.json.gz')).toBeNull();
    expect(snapshotTime('db-2026-08-17T09-30-05.json.gz')).toBeNull(); // Cinema Roll's prefix, not ours
    expect(snapshotTime('.DS_Store')).toBeNull();
  });
});

describe('freshSnapshot', () => {
  it('finds a snapshot younger than the window', () => {
    const files = ['hats-2026-08-17T07-00-00.json.gz', 'hats-2026-08-16T07-00-00.json.gz'];
    expect(freshSnapshot(files, 6 * HOUR, NOW)).toBe('hats-2026-08-17T07-00-00.json.gz');
  });

  it('returns null when everything is older than the window', () => {
    const files = ['hats-2026-08-17T05-59-00.json.gz'];
    expect(freshSnapshot(files, 6 * HOUR, NOW)).toBeNull();
  });

  it('ignores clock-skewed names from the future', () => {
    const files = ['hats-2026-08-18T00-00-00.json.gz'];
    expect(freshSnapshot(files, 6 * HOUR, NOW)).toBeNull();
  });

  it('returns null for an empty directory', () => {
    expect(freshSnapshot([], 6 * HOUR, NOW)).toBeNull();
  });
});
