// The search's pure half: what a result card gets, and the one ordering
// judgement this app makes over TMDb's own.
import { describe, it, expect } from 'vitest';
import { toResult, rankResults, releaseYear, posterUrl } from '../utils/tmdb.js';

const raw = (over = {}) => ({
  id: 27205,
  title: 'Inception',
  release_date: '2010-07-15',
  overview: 'A thief who steals corporate secrets…',
  poster_path: '/abc.jpg',
  popularity: 80,
  vote_count: 30000,
  ...over
});

describe('toResult', () => {
  it('keeps what a card shows', () => {
    expect(toResult(raw())).toMatchObject({ id: 27205, title: 'Inception', year: '2010' });
  });

  it('builds a poster URL, and copes without one', () => {
    expect(toResult(raw()).poster).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(toResult(raw({ poster_path: null })).poster).toBeNull();
  });

  it('falls back to the original title, then to something printable', () => {
    expect(toResult(raw({ title: null, original_title: 'Kokoro' })).title).toBe('Kokoro');
    expect(toResult(raw({ title: null, original_title: null })).title).toBe('Untitled');
  });

  it('has no year for a film with no release date', () => {
    expect(releaseYear({ release_date: '' })).toBeNull();
    expect(releaseYear({})).toBeNull();
  });

  it('never returns NaN for missing numbers', () => {
    const result = toResult({ id: 1, title: 'x' });
    expect(result.popularity).toBe(0);
    expect(result.votes).toBe(0);
  });
});

describe('rankResults', () => {
  const heat = toResult(raw({ id: 949, title: 'Heat', release_date: '1995-12-15' }));
  const heatShort = toResult(raw({ id: 2, title: 'Heat', release_date: '' }));
  const heatwave = toResult(raw({ id: 3, title: 'Heatwave', release_date: '1982-01-01' }));

  it('puts an exact title match first', () => {
    expect(rankResults([heatwave, heat], 'Heat')[0].id).toBe(949);
  });

  it('prefers a released film to an undated one when both match exactly', () => {
    expect(rankResults([heatShort, heat], 'heat').map((m) => m.id)).toEqual([949, 2]);
  });

  it('otherwise leaves TMDb\'s order alone', () => {
    const order = rankResults([heatwave, heatShort], 'nothing matches').map((m) => m.id);
    expect(order).toEqual([3, 2]);
  });

  it('is case- and space-insensitive about "exact"', () => {
    expect(rankResults([heatwave, heat], '  HEAT ')[0].id).toBe(949);
  });

  it('does not mutate what it is given', () => {
    const input = [heatwave, heat];
    rankResults(input, 'Heat');
    expect(input[0].id).toBe(3);
  });

  it('copes with nothing to rank', () => {
    expect(rankResults([], 'anything')).toEqual([]);
  });
});

describe('posterUrl', () => {
  it('takes a size', () => {
    expect(posterUrl('/a.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
  });
});
