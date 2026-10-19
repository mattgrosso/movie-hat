// @vitest-environment jsdom
//
// Sentry N+1 on /hat-list (2026-10-18): the hats list reads every hat you
// belong to, and tapping one then read that same hat twice more — once from
// the tap, once when the hat screen mounted. The tap now hands over the
// list's copy and the mount reuses a hat loaded moments ago. Everyone else
// (after a draw, an edit) still calls getHat bare and gets a real read.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const dbGet = vi.fn();

vi.mock('../store/db.js', () => ({
  dbGet: (...args) => dbGet(...args),
  dbPut: vi.fn(),
  dbPatch: vi.fn(),
  hatPath: (title, ...rest) => ['hats', title, ...rest].join('/'),
  resolveHatKey: vi.fn()
}));

const { default: store } = await import('../store/index.js');

const HAT = {
  title: 'Family',
  subKey: 'hat1',
  members: ['a@example.com', 'b@example.com'],
  movies: { m1: { title: 'Heat' } },
  history: { h1: { title: 'Alien', drawDate: 1 } }
};

beforeEach(() => {
  vi.useFakeTimers();
  dbGet.mockReset();
  dbGet.mockResolvedValue({ ...HAT });
  // Stop the mirror-feed follow-up from reaching anything.
  store.state.mirrorFeedKey = null;
  store.commit('setHatLoaded', null);
  store.commit('setCurrentHat', { title: 'Family', hatKey: 'hat1' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getHat snapshot reuse', () => {
  it("opens a hat from the list's copy without reading it", async () => {
    await store.dispatch('getHat', { snapshot: HAT });
    expect(dbGet).not.toHaveBeenCalledWith('hats/Family/hat1');
    expect(store.state.movieHat.map((m) => m.title)).toEqual(['Heat']);
    expect(store.state.history.map((m) => m.title)).toEqual(['Alien']);
  });

  it('the hat screen mounting right after does not read it again', async () => {
    await store.dispatch('getHat', { snapshot: HAT });
    await store.dispatch('getHat', { reuseFresh: true });
    expect(dbGet).not.toHaveBeenCalledWith('hats/Family/hat1');
  });

  it('reads again once the copy is no longer fresh', async () => {
    await store.dispatch('getHat', { snapshot: HAT });
    vi.advanceTimersByTime(31 * 1000);
    await store.dispatch('getHat', { reuseFresh: true });
    expect(dbGet).toHaveBeenCalledWith('hats/Family/hat1');
  });

  it('a bare getHat (after a draw or an edit) always reads', async () => {
    await store.dispatch('getHat', { snapshot: HAT });
    await store.dispatch('getHat');
    expect(dbGet).toHaveBeenCalledWith('hats/Family/hat1');
  });

  it("ignores a snapshot of a different hat", async () => {
    await store.dispatch('getHat', { snapshot: { ...HAT, subKey: 'other' } });
    expect(dbGet).toHaveBeenCalledWith('hats/Family/hat1');
  });

  it('a fresh load of another hat does not stand in for this one', async () => {
    store.commit('setHatLoaded', { hatKey: 'other', at: Date.now() });
    await store.dispatch('getHat', { reuseFresh: true });
    expect(dbGet).toHaveBeenCalledWith('hats/Family/hat1');
  });
});
