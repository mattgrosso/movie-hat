// Retention decides which backups get DELETED — the one place the safety
// net can cut itself.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pruneLocal, summarize } from '../../scripts/backup-hats.mjs';

const NOW = Date.parse('2026-08-17T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'movie-hat-retention-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const put = (...names) => names.forEach((name) => writeFileSync(join(dir, name), 'x'));

describe('pruneLocal', () => {
  it('keeps everything from the last 14 days', () => {
    put('hats-2026-08-16T01-00-00.json.gz', 'hats-2026-08-04T01-00-00.json.gz');
    const removed = pruneLocal(dir, NOW);
    expect(removed).toEqual([]);
    expect(readdirSync(dir).length).toBe(2);
  });

  it('removes old snapshots but keeps the first of each month forever', () => {
    put(
      'hats-2026-06-01T01-00-00.json.gz', // first of June — kept forever
      'hats-2026-06-15T01-00-00.json.gz', // old June stray — goes
      'hats-2026-08-16T01-00-00.json.gz' // recent — kept
    );
    const removed = pruneLocal(dir, NOW);
    expect(removed).toEqual(['hats-2026-06-15T01-00-00.json.gz']);
    expect(readdirSync(dir).sort()).toEqual([
      'hats-2026-06-01T01-00-00.json.gz',
      'hats-2026-08-16T01-00-00.json.gz'
    ]);
  });

  it('never touches files that are not snapshots', () => {
    put('notes.txt');
    writeFileSync(join(dir, `hats-${new Date(NOW - 30 * DAY).toISOString().slice(0, 10)}T01-00-00.json.gz`), 'x');
    pruneLocal(dir, NOW);
    expect(readdirSync(dir)).toContain('notes.txt');
  });
});

describe('summarize', () => {
  it('counts hats, waiting movies, and drawn movies across records', () => {
    const data = {
      hats: {
        'Family Hat': {
          key1: { movies: { a: {}, b: {} }, history: { c: {} } }
        },
        'Dev Hat': {
          key2: { movies: { d: {} } },
          key3: { history: { e: {}, f: {} } }
        }
      }
    };
    expect(summarize(data)).toEqual({ hats: 2, movies: 3, drawn: 3 });
  });

  it('reports zeros for an empty database instead of throwing', () => {
    expect(summarize(null)).toEqual({ hats: 0, movies: 0, drawn: 0 });
  });
});
