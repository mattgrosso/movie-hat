// The arithmetic behind the charts. A chart that lies is worse than no
// chart, and the running total in particular is easy to get subtly wrong.
import { describe, it, expect } from 'vitest';
import {
  hatSizeOverTime,
  inAndOutByYear,
  byReleaseDecade,
  waitTimes,
  byContributor,
  agesInHat,
  monthKey,
  monthLabel
} from '../assets/javascript/hatCharts.js';

const at = (iso) => Date.parse(iso);
const day = 24 * 60 * 60 * 1000;

describe('monthKey / monthLabel', () => {
  it('keys by month and sorts as a string', () => {
    expect(monthKey(at('2026-03-15T12:00:00Z'))).toMatch(/^2026-03$/);
    expect(['2026-10', '2026-03', '2025-12'].sort()).toEqual(['2025-12', '2026-03', '2026-10']);
  });

  it('labels compactly enough for a phone axis', () => {
    expect(monthLabel('2026-03')).toBe('Mar 26');
  });
});

describe('hatSizeOverTime', () => {
  it('runs a cumulative total, adding on entry and subtracting on the draw', () => {
    const history = [
      { timeStamp: at('2026-01-10T00:00:00Z'), dateDrawn: at('2026-03-05T00:00:00Z') }
    ];
    const inHat = [
      { timeStamp: at('2026-01-20T00:00:00Z') },
      { timeStamp: at('2026-02-02T00:00:00Z') }
    ];

    const { labels, values } = hatSizeOverTime(inHat, history);

    expect(labels).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(values).toEqual([2, 3, 2]);
  });

  it('fills quiet months so a flat stretch reads flat, not missing', () => {
    const inHat = [
      { timeStamp: at('2026-01-05T00:00:00Z') },
      { timeStamp: at('2026-04-05T00:00:00Z') }
    ];

    const { labels, values } = hatSizeOverTime(inHat, []);

    expect(labels).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(values).toEqual([1, 1, 1, 2]);
  });

  it('returns empty series for an empty hat rather than throwing', () => {
    expect(hatSizeOverTime([], [])).toEqual({ labels: [], values: [] });
    expect(hatSizeOverTime(null, null)).toEqual({ labels: [], values: [] });
  });
});

describe('inAndOutByYear', () => {
  it('counts additions and draws separately per year', () => {
    // Midday, deliberately: these are bucketed by LOCAL year, so a UTC
    // midnight on New Year's Day belongs to the year before in New York.
    const history = [
      { timeStamp: at('2024-05-01T12:00:00Z'), dateDrawn: at('2025-02-01T12:00:00Z') },
      { timeStamp: at('2025-06-01T12:00:00Z'), dateDrawn: at('2025-07-01T12:00:00Z') }
    ];
    const inHat = [{ timeStamp: at('2025-01-15T12:00:00Z') }];

    expect(inAndOutByYear(inHat, history)).toEqual({
      labels: ['2024', '2025'],
      added: [1, 2],
      drawn: [0, 2]
    });
  });
});

describe('byReleaseDecade', () => {
  it('buckets by decade and labels them readably', () => {
    const movies = [
      { release_date: '1975-06-20' },
      { release_date: '1979-01-01' },
      { release_date: '2001-11-16' },
      { release_date: '' },
      { release_date: 'nonsense' }
    ];

    expect(byReleaseDecade(movies, [])).toEqual({ labels: ['70s', '00s'], values: [2, 1] });
  });
});

describe('waitTimes / agesInHat', () => {
  it('buckets drawn movies by how long they waited', () => {
    const history = [
      { timeStamp: at('2026-01-01T00:00:00Z'), dateDrawn: at('2026-01-03T00:00:00Z') }, // 2 days
      { timeStamp: at('2026-01-01T00:00:00Z'), dateDrawn: at('2026-02-10T00:00:00Z') }, // ~40 days
      { timeStamp: at('2020-01-01T00:00:00Z'), dateDrawn: at('2026-01-01T00:00:00Z') } // years
    ];

    const { labels, values } = waitTimes(history);

    expect(labels[0]).toBe('< 1 wk');
    expect(values[0]).toBe(1);
    expect(values[2]).toBe(1); // 1-3 mo
    expect(values[values.length - 1]).toBe(1); // 2 yr+
  });

  it('ignores entries missing either end of the wait', () => {
    expect(waitTimes([{ dateDrawn: Date.now() }]).values.every((value) => value === 0)).toBe(true);
  });

  it('measures the still-waiting against now', () => {
    const now = at('2026-08-17T00:00:00Z');
    const inHat = [{ timeStamp: now - (3 * day) }, { timeStamp: now - (400 * day) }];

    const { values } = agesInHat(inHat, now);

    expect(values[0]).toBe(1); // under a week
    expect(values[5]).toBe(1); // 1-2 yr
  });
});

describe('byContributor', () => {
  it('ranks contributors and folds the tail into Others', () => {
    const movies = [
      ...Array(5).fill({ addedBy: 'Matt' }),
      ...Array(3).fill({ addedBy: 'Carrie' }),
      { addedBy: 'A' }, { addedBy: 'B' }, { addedBy: 'C' },
      { addedBy: 'D' }, { addedBy: 'E' }, { addedBy: 'F' },
      { addedBy: '' }
    ];

    const { labels, values } = byContributor(movies, [], 3);

    expect(labels).toEqual(['Matt', 'Carrie', 'A', 'Others']);
    expect(values).toEqual([5, 3, 1, 5]);
  });

  it('skips entries with nobody recorded', () => {
    expect(byContributor([{ title: 'x' }], [])).toEqual({ labels: [], values: [] });
  });
});
