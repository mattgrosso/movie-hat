// Wrapped is all arithmetic over history, and arithmetic that quietly
// counts the wrong year (or divides by zero on an empty hat) would be
// embarrassing on exactly the one day a year anybody looks at it.
import { describe, it, expect } from 'vitest';
import { wrappedStats, waitInDays, isWrappedSeason, wrappedYear } from '../assets/javascript/wrapped.js';

const day = 24 * 60 * 60 * 1000;
const at = (iso) => Date.parse(iso);

const drawn = (overrides = {}) => ({
  title: 'A Movie',
  release_date: '1999-01-01',
  timeStamp: at('2026-01-01T00:00:00Z'),
  dateDrawn: at('2026-02-01T00:00:00Z'),
  addedBy: 'Matt',
  ...overrides
});

describe('isWrappedSeason / wrappedYear', () => {
  it('is season in December and January, not in between', () => {
    expect(isWrappedSeason(new Date('2026-12-05T12:00:00Z'))).toBe(true);
    expect(isWrappedSeason(new Date('2027-01-09T12:00:00Z'))).toBe(true);
    expect(isWrappedSeason(new Date('2026-08-17T12:00:00Z'))).toBe(false);
  });

  it('reports on the year that is ending, including from January', () => {
    expect(wrappedYear(new Date('2026-12-31T12:00:00Z'))).toBe(2026);
    expect(wrappedYear(new Date('2027-01-02T12:00:00Z'))).toBe(2026);
  });
});

describe('waitInDays', () => {
  it('measures hat time in whole days', () => {
    expect(waitInDays(drawn({
      timeStamp: at('2026-01-01T00:00:00Z'),
      dateDrawn: at('2026-01-11T00:00:00Z')
    }))).toBe(10);
  });

  it('is null when either end is missing, never NaN', () => {
    expect(waitInDays({ dateDrawn: Date.now() })).toBeNull();
    expect(waitInDays({ timeStamp: Date.now() })).toBeNull();
    expect(waitInDays(null)).toBeNull();
  });

  it('floors a backwards pair at zero rather than going negative', () => {
    expect(waitInDays(drawn({
      timeStamp: at('2026-02-01T00:00:00Z'),
      dateDrawn: at('2026-01-01T00:00:00Z')
    }))).toBe(0);
  });
});

describe('wrappedStats', () => {
  it('counts only the requested year', () => {
    const history = [
      drawn({ dateDrawn: at('2026-03-01T00:00:00Z') }),
      drawn({ dateDrawn: at('2025-03-01T00:00:00Z'), timeStamp: at('2025-01-01T00:00:00Z') })
    ];

    expect(wrappedStats(history, [], 2026).drawnCount).toBe(1);
    expect(wrappedStats(history, [], 2025).drawnCount).toBe(1);
    expect(wrappedStats(history, [], 2024).drawnCount).toBe(0);
  });

  it('counts movies added this year from BOTH the hat and history', () => {
    const history = [drawn({ timeStamp: at('2026-05-01T00:00:00Z') })];
    const inHat = [
      { title: 'Waiting', timeStamp: at('2026-06-01T00:00:00Z') },
      { title: 'Older', timeStamp: at('2024-06-01T00:00:00Z') }
    ];

    const stats = wrappedStats(history, inHat, 2026);
    expect(stats.addedCount).toBe(2);
    expect(stats.stillWaiting).toBe(2);
  });

  it('ranks who added the drawn movies, biggest first', () => {
    const history = [
      drawn({ addedBy: 'Carrie' }),
      drawn({ addedBy: 'Matt' }),
      drawn({ addedBy: 'Carrie' }),
      drawn({ addedBy: '' })
    ];

    expect(wrappedStats(history, [], 2026).addedBy).toEqual([
      { name: 'Carrie', count: 2 },
      { name: 'Matt', count: 1 }
    ]);
  });

  it('finds the busiest month and the longest wait', () => {
    const history = [
      drawn({ dateDrawn: at('2026-07-02T00:00:00Z') }),
      drawn({ dateDrawn: at('2026-07-20T00:00:00Z') }),
      drawn({
        title: 'The Patient One',
        dateDrawn: at('2026-09-01T00:00:00Z'),
        timeStamp: at('2026-09-01T00:00:00Z') - (500 * day)
      })
    ];

    const stats = wrappedStats(history, [], 2026);
    expect(stats.busiestMonth).toEqual({ name: 'July', count: 2 });
    expect(stats.longestWait.movie.title).toBe('The Patient One');
    expect(stats.longestWait.days).toBe(500);
    expect(stats.byMonth[6]).toBe(2);
  });

  it('picks the oldest and newest films by release date', () => {
    const history = [
      drawn({ title: 'Old', release_date: '1942-01-23' }),
      drawn({ title: 'New', release_date: '2025-11-05' }),
      drawn({ title: 'Middle', release_date: '1988-06-01' }),
      drawn({ title: 'Undated', release_date: '' })
    ];

    const stats = wrappedStats(history, [], 2026);
    expect(stats.oldestFilm.title).toBe('Old');
    expect(stats.newestFilm.title).toBe('New');
    expect(stats.averageReleaseYear).toBe(1985);
  });

  it('names the movie that has been waiting longest', () => {
    const inHat = [
      { title: 'Recent', timeStamp: at('2026-06-01T00:00:00Z') },
      { title: 'Ancient', timeStamp: at('2021-02-02T00:00:00Z') }
    ];

    expect(wrappedStats([], inHat, 2026).longestWaiting.title).toBe('Ancient');
  });

  it('returns a usable, empty report for a brand new hat', () => {
    const stats = wrappedStats([], [], 2026);

    expect(stats.hasData).toBe(false);
    expect(stats.drawnCount).toBe(0);
    expect(stats.busiestMonth).toBeNull();
    expect(stats.longestWait).toBeNull();
    expect(stats.averageWaitDays).toBeNull();
    expect(stats.averageReleaseYear).toBeNull();
    expect(stats.oldestFilm).toBeNull();
    expect(stats.addedBy).toEqual([]);
  });

  it('survives null inputs instead of throwing', () => {
    expect(() => wrappedStats(null, null, 2026)).not.toThrow();
  });
});
