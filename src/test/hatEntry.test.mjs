import { describe, expect, it } from 'vitest';
import { afterDraw, hatWithAdded, slimHatMovie } from '../assets/javascript/hatEntry.js';

const choice = {
  id: 949,
  title: 'Heat',
  poster_path: '/heat.jpg',
  backdrop_path: '/b.jpg',
  overview: 'A heist.',
  release_date: '1995-12-15',
  original_language: 'en',
  vote_average: 7.9,
  vote_count: 7000,
  popularity: 80,
  streamers: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg' }] }
};

describe('slimHatMovie', () => {
  it('drops what only the search screen uses, keeps what the apps show', () => {
    const slim = slimHatMovie({ ...choice, dbKey: '-k', addedBy: 'Matt', note: 'yes' });
    expect(slim).toEqual({
      id: 949,
      title: 'Heat',
      poster_path: '/heat.jpg',
      backdrop_path: '/b.jpg',
      overview: 'A heist.',
      release_date: '1995-12-15',
      original_language: 'en',
      vote_average: 7.9,
      addedBy: 'Matt',
      note: 'yes'
    });
  });

  it('leaves the original alone', () => {
    slimHatMovie(choice);
    expect(choice.streamers).toBeDefined();
  });
});

describe('local hat updates', () => {
  it('adds the saved entry under its new key', () => {
    expect(hatWithAdded([{ dbKey: 'a' }], { id: 1 }, 'b')).toEqual([{ dbKey: 'a' }, { id: 1, dbKey: 'b' }]);
    expect(hatWithAdded(null, { id: 1 }, 'b')).toEqual([{ id: 1, dbKey: 'b' }]);
  });

  it('moves the drawn movie from the hat to history', () => {
    const next = afterDraw(
      { movies: [{ id: 1, dbKey: 'a' }, { id: 2, dbKey: 'b' }], history: [{ id: 0, dbKey: 'drawn-1' }] },
      { id: 1, dbKey: 'a' },
      'drawn-2',
      { id: 1, dateDrawn: 2 }
    );
    expect(next.movies).toEqual([{ id: 2, dbKey: 'b' }]);
    expect(next.history).toEqual([{ id: 0, dbKey: 'drawn-1' }, { id: 1, dateDrawn: 2, dbKey: 'drawn-2' }]);
  });
});
