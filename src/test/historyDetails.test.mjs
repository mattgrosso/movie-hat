import { describe, it, expect } from 'vitest';
import { historyDetailRows, formatWhen, formatRuntime } from '../assets/javascript/historyDetails.js';

const ADDED = Date.UTC(2026, 7, 1, 18, 30);   // Aug 1
const DRAWN = Date.UTC(2026, 7, 15, 20, 0);   // Aug 15

describe('historyDetailRows (report -P1St_2nnAa1mVCCx1lE: details behind each poster)', () => {
  it('says who added it and when, when it was drawn, and how long it waited', () => {
    const rows = historyDetailRows(
      { title: 'Heat', addedBy: 'Matt', timeStamp: ADDED, dateDrawn: DRAWN, release_date: '1995-12-15', vote_average: 8.3, note: 'a classic' },
      { rank: '3rd' }
    );
    expect(rows[0]).toEqual({ label: 'Added', value: `by Matt, ${formatWhen(ADDED)}` });
    expect(rows[1]).toEqual({ label: 'Drawn', value: `${formatWhen(DRAWN)} · 3rd draw` });
    expect(rows[2]).toEqual({ label: 'In the hat', value: '14 days' });
    expect(rows).toContainEqual({ label: 'Note', value: 'a classic' });
    expect(rows).toContainEqual({ label: 'Released', value: 'Dec 15, 1995' });
    expect(rows).toContainEqual({ label: 'TMDB', value: '8.3 / 10' });
  });

  it('copes with the older records that never stored a timestamp or an adder', () => {
    expect(historyDetailRows({ title: 'Old', dateDrawn: DRAWN }, { rank: '1st' }))
      .toEqual([{ label: 'Drawn', value: `${formatWhen(DRAWN)} · 1st draw` }]);
    expect(historyDetailRows({ title: 'Older', addedBy: 'Seth' })).toEqual([{ label: 'Added', value: 'by Seth' }]);
    expect(historyDetailRows({ title: 'Bare' })).toEqual([]);
  });

  it('reads a timestamp stored as a numeric string', () => {
    const rows = historyDetailRows({ timeStamp: String(ADDED), dateDrawn: DRAWN });
    expect(rows[0]).toEqual({ label: 'Added', value: formatWhen(ADDED) });
  });

  it('counts a same-day draw as 0 days and a single day without an s', () => {
    expect(historyDetailRows({ timeStamp: ADDED, dateDrawn: ADDED + 1000 })).toContainEqual({ label: 'In the hat', value: '0 days' });
    expect(historyDetailRows({ timeStamp: ADDED, dateDrawn: ADDED + 24 * 3600 * 1000 })).toContainEqual({ label: 'In the hat', value: '1 day' });
  });

  it('leaves out a zero or missing TMDB rating', () => {
    expect(historyDetailRows({ vote_average: 0 })).toEqual([]);
    expect(historyDetailRows({ vote_average: 'nope' })).toEqual([]);
  });
});

// Matt, 2026-09-17: "let's add run time to the info."
//
// Runtime is the one fact on this panel that is NOT on the stored record.
// All 2604 saved movies carry TMDB's SEARCH fields (backdrop_path, id,
// overview, popularity, poster_path, release_date, timeStamp, title,
// vote_average, vote_count) and search does not return runtime - verified
// against the 2026-09-17 backup. So it is fetched and passed in, and every
// row below has to cope with it being absent.
describe('runtime', () => {
  it('reads like a listings page', () => {
    expect(formatRuntime(86)).toBe('1h 26m');
    expect(formatRuntime(47)).toBe('47m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(60)).toBe('1h');
  });

  it('has nothing to say about a runtime TMDB does not have', () => {
    expect(formatRuntime(0)).toBe(null);
    expect(formatRuntime(null)).toBe(null);
    expect(formatRuntime(undefined)).toBe(null);
    expect(formatRuntime('not a number')).toBe(null);
  });

  it('adds a Runtime row when one was looked up, and none when it was not', () => {
    const movie = { title: 'Mars Express', vote_average: 7.5 };
    const withRuntime = historyDetailRows(movie, { runtime: 86 });
    expect(withRuntime.find((r) => r.label === 'Runtime')?.value).toBe('1h 26m');

    // The panel opens before the lookup returns; no row rather than a blank.
    const pending = historyDetailRows(movie, { runtime: null });
    expect(pending.some((r) => r.label === 'Runtime')).toBe(false);
    expect(historyDetailRows(movie).some((r) => r.label === 'Runtime')).toBe(false);
  });

  it('sits between Released and TMDB', () => {
    const rows = historyDetailRows(
      { title: 'Mars Express', release_date: '2023-11-22', vote_average: 7.5 },
      { runtime: 86 }
    ).map((r) => r.label);
    expect(rows).toEqual(['Released', 'Runtime', 'TMDB']);
  });
});
