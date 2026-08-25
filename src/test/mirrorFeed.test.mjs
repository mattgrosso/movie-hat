import { describe, it, expect } from 'vitest';
import { buildMirrorFeed } from '../assets/javascript/mirrorFeed.js';

const NOW = 1787000000000;

const pick = (overrides = {}) => ({
  id: 12101,
  title: 'Soylent Green',
  poster_path: '/5nbkShkOEXUoKVhaX0XG41wyBkq.jpg',
  dateDrawn: NOW - 1000,
  ...overrides
});

describe('buildMirrorFeed', () => {
  it('publishes the most recently drawn movie', () => {
    const feed = buildMirrorFeed(
      [
        pick({ id: 1, title: 'Older', dateDrawn: 1000 }),
        pick({ id: 2, title: 'Newest', dateDrawn: 3000 }),
        pick({ id: 3, title: 'Middle', dateDrawn: 2000 })
      ],
      { now: NOW }
    );

    expect(feed.updatedAt).toBe(NOW);
    expect(feed.currentPick.title).toBe('Newest');
    expect(feed.currentPick.id).toBe(2);
  });

  it('accepts the keyed object the database stores, not just an array', () => {
    const feed = buildMirrorFeed(
      { 'drawn-3000': pick({ id: 2, title: 'Newest', dateDrawn: 3000 }), '-OxRNNic': pick({ id: 1, dateDrawn: 1000 }) },
      { now: NOW }
    );

    expect(feed.currentPick.title).toBe('Newest');
  });

  // The mirror gives the whole screen to this poster and builds its URL from
  // poster_path unconditionally.
  it('skips a pick with no poster rather than publishing a broken one', () => {
    const feed = buildMirrorFeed(
      [
        pick({ id: 1, title: 'Has a poster', dateDrawn: 1000 }),
        pick({ id: 2, title: 'No poster', dateDrawn: 3000, poster_path: null })
      ],
      { now: NOW }
    );

    expect(feed.currentPick.title).toBe('Has a poster');
  });

  it('ignores entries with no usable draw date', () => {
    const feed = buildMirrorFeed(
      [
        pick({ id: 1, title: 'Real', dateDrawn: 1000 }),
        pick({ id: 2, title: 'Undated', dateDrawn: undefined }),
        pick({ id: 3, title: 'Unparseable', dateDrawn: 'yesterday' })
      ],
      { now: NOW }
    );

    expect(feed.currentPick.title).toBe('Real');
  });

  it('ignores entries with no movie id — the mirror matches on it', () => {
    const feed = buildMirrorFeed(
      [pick({ id: null, title: 'Idless', dateDrawn: 3000 }), pick({ id: 7, title: 'Real', dateDrawn: 1000 })],
      { now: NOW }
    );

    expect(feed.currentPick.title).toBe('Real');
  });

  it('publishes a null pick rather than throwing on an empty history', () => {
    expect(buildMirrorFeed([], { now: NOW })).toEqual({ updatedAt: NOW, currentPick: null });
    expect(buildMirrorFeed(null, { now: NOW }).currentPick).toBe(null);
    expect(buildMirrorFeed(undefined, { now: NOW }).currentPick).toBe(null);
  });

  it('publishes a null pick when nothing in the history is usable', () => {
    const feed = buildMirrorFeed([pick({ poster_path: '' }), { nonsense: true }], { now: NOW });

    expect(feed.currentPick).toBe(null);
  });

  // This feed is public to anyone holding the URL. The history carries every
  // movie ever drawn, each with an overview, vote counts and who added it.
  it('publishes only the four fields the mirror needs', () => {
    const feed = buildMirrorFeed(
      [pick({ overview: 'a plot summary', vote_average: 6.9, addedBy: 'someone@example.com', timeStamp: 123 })],
      { now: NOW }
    );

    expect(Object.keys(feed.currentPick).sort()).toEqual(['dateDrawn', 'id', 'poster_path', 'title']);
  });

  it('tolerates a pick with no title', () => {
    const feed = buildMirrorFeed([pick({ title: undefined })], { now: NOW });

    expect(feed.currentPick.title).toBe('');
    expect(feed.currentPick.poster_path).toBeTruthy();
  });
});
