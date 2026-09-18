// @vitest-environment jsdom
//
// jsdom because the store reads and writes localStorage (the remembered
// email) both at module init and in `setEmail` — the house convention from
// WhereToWatch.test.mjs.
// `loadSiteUser` — Movie Hat's half of the movie-request permission.
//
// The invariant worth a test of its own: Movie Hat READS the `siteUsers` row
// and does not create one. In the standalone Movie Requests app, signing in
// IS asking to be let in, so it writes a pending row for anyone who lacks
// one. Here, signing in is just using Movie Hat — most people who do are
// family members in a hat who have never heard of movie requests, and
// writing them a pending row each would fill Matt's waiting list with people
// who never asked for anything.
//
// The one exception is Matt's own bootstrap row, which is how he becomes an
// admin without opening the other app.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OWNER_EMAIL, REQUESTER_EMAILS } from '../assets/javascript/owner.mjs';

const dbGet = vi.fn();
const dbPut = vi.fn();

vi.mock('../store/db.js', () => ({
  dbGet: (...args) => dbGet(...args),
  dbPut: (...args) => dbPut(...args),
  dbPatch: vi.fn(),
  hatPath: (title, ...rest) => ['hats', title, ...rest].join('/'),
  resolveHatKey: vi.fn()
}));

const { default: store } = await import('../store/index.js');

const MATT = { uid: 'matt', email: OWNER_EMAIL, displayName: 'Matt' };
const FAMILY = { uid: 'carrie', email: 'carrie@example.com', displayName: 'Carrie' };
const APPROVED = { uid: 'friend', email: 'friend@example.com' };

beforeEach(() => {
  dbGet.mockReset();
  dbPut.mockReset();
  store.commit('setSiteUser', null);
  store.commit('setEmail', null);
});

describe('loadSiteUser', () => {
  it('writes nothing for a family member with no row', async () => {
    dbGet.mockResolvedValue(null);
    await store.dispatch('loadSiteUser', FAMILY);
    expect(dbGet).toHaveBeenCalledWith('siteUsers/carrie');
    expect(dbPut).not.toHaveBeenCalled();
    expect(store.state.siteUser).toBeNull();
    expect(store.state.siteUserResolved).toBe(true);
  });

  it('bootstraps Matt as an approved admin when he has no row', async () => {
    dbGet.mockResolvedValue(null);
    dbPut.mockResolvedValue(undefined);
    await store.dispatch('loadSiteUser', MATT);
    expect(dbPut).toHaveBeenCalledWith('siteUsers/matt', expect.objectContaining({
      status: 'approved',
      isAdmin: true,
      email: OWNER_EMAIL
    }));
    expect(store.state.siteUser).toMatchObject({ isAdmin: true });
  });

  it('leaves Matt\'s existing row alone', async () => {
    dbGet.mockResolvedValue({ email: OWNER_EMAIL, status: 'approved', isAdmin: true, requestedAt: 1 });
    await store.dispatch('loadSiteUser', MATT);
    expect(dbPut).not.toHaveBeenCalled();
  });

  it('adopts an approved row', async () => {
    dbGet.mockResolvedValue({ email: APPROVED.email, status: 'approved', isAdmin: false, requestedAt: 1 });
    await store.dispatch('loadSiteUser', APPROVED);
    expect(store.state.siteUser.status).toBe('approved');
  });

  it('survives a refused read — no row, no error, screens stay hidden', async () => {
    dbGet.mockRejectedValue(Object.assign(new Error('denied'), { status: 401 }));
    await store.dispatch('loadSiteUser', FAMILY);
    expect(store.state.siteUser).toBeNull();
    expect(store.state.siteUserResolved).toBe(true);
    expect(store.state.appError).toBeNull();
  });

  it('resolves to nothing when nobody is signed in', async () => {
    await store.dispatch('loadSiteUser', null);
    expect(dbGet).not.toHaveBeenCalled();
    expect(store.state.siteUserResolved).toBe(true);
  });
});

describe('the getters everything else asks', () => {
  it('lets the hard-coded three request with no row at all', () => {
    store.commit('setEmail', REQUESTER_EMAILS[1]);
    store.commit('setSiteUser', null);
    expect(store.getters.mayRequestMovies).toBe(true);
    // Being allowed to request is not being allowed to decide.
    expect(store.getters.mayApproveAccess).toBe(false);
  });

  it('lets an approved row request', () => {
    store.commit('setEmail', APPROVED.email);
    store.commit('setSiteUser', { email: APPROVED.email, status: 'approved', isAdmin: false });
    expect(store.getters.mayRequestMovies).toBe(true);
  });

  it('refuses a pending or denied row', () => {
    for (const status of ['pending', 'denied']) {
      store.commit('setEmail', APPROVED.email);
      store.commit('setSiteUser', { email: APPROVED.email, status, isAdmin: false });
      expect(store.getters.mayRequestMovies).toBe(false);
    }
  });

  it('shows a family member neither screen', () => {
    store.commit('setEmail', FAMILY.email);
    store.commit('setSiteUser', null);
    expect(store.getters.mayRequestMovies).toBe(false);
    expect(store.getters.mayApproveAccess).toBe(false);
  });

  it('gives Matt the waiting list before his row is read', () => {
    store.commit('setEmail', OWNER_EMAIL);
    store.commit('setSiteUser', null);
    expect(store.getters.mayApproveAccess).toBe(true);
  });

  it('gives it to an admin row that is not Matt', () => {
    store.commit('setEmail', APPROVED.email);
    store.commit('setSiteUser', { email: APPROVED.email, status: 'approved', isAdmin: true });
    expect(store.getters.mayApproveAccess).toBe(true);
  });
});
