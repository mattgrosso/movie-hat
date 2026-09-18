// The access gate's pure half. The half that actually enforces anything is
// the database rules, tested against a real emulator in
// movie-hat/src/test/emulated/siteUsersRules.test.js — these cases pin the
// row this app writes and the screen it decides to show.
import { describe, it, expect, vi } from 'vitest';
import {
  buildSiteUser, siteUserState, mayRequestMovies, mayApprove, siteUserMessage,
  pendingList, decidedList, siteUserPath, useSiteAccess, SITE_USER_POLL_INTERVAL_MS
} from '../utils/siteAccess.js';
import { OWNER_EMAIL, REQUESTER_EMAILS } from '../assets/javascript/owner.mjs';

const STRANGER = 'someone.new@gmail.com';

describe('buildSiteUser', () => {
  it('writes a stranger in as pending, not admin, under their own address', () => {
    const row = buildSiteUser({ email: STRANGER, displayName: 'A Stranger' });
    expect(row).toMatchObject({ email: STRANGER, status: 'pending', isAdmin: false, displayName: 'A Stranger' });
    expect(row.requestedAt).toEqual({ '.sv': 'timestamp' });
  });

  it('bootstraps Matt as an approved admin', () => {
    // The rules allow exactly this and only for his Google-verified address.
    expect(buildSiteUser({ email: OWNER_EMAIL })).toMatchObject({ status: 'approved', isAdmin: true });
  });

  it('refuses to build a row with no address', () => {
    expect(() => buildSiteUser({ email: '' })).toThrow();
  });

  it('caps the fields Google supplies, which this app does not control', () => {
    const row = buildSiteUser({ email: STRANGER, displayName: 'n'.repeat(500), photoURL: `https://x/${'p'.repeat(999)}` });
    expect(row.displayName).toHaveLength(120);
    expect(row.photoURL).toHaveLength(500);
  });

  it('leaves out what Google did not give', () => {
    expect(buildSiteUser({ email: STRANGER })).not.toHaveProperty('displayName');
  });
});

describe('siteUserState', () => {
  it('has nobody signed in until there is an email', () => {
    expect(siteUserState({})).toBe('signedOut');
  });

  it('reads the row\'s status', () => {
    for (const status of ['pending', 'approved', 'denied']) {
      expect(siteUserState({ email: STRANGER, row: { status } })).toBe(status);
    }
  });

  it('lets the three hard-coded addresses through with no row', () => {
    for (const email of REQUESTER_EMAILS) {
      expect(siteUserState({ email, row: null })).toBe('listed');
    }
  });

  it('calls a signed-in stranger with no row "none" — the app then asks', () => {
    expect(siteUserState({ email: STRANGER, row: null })).toBe('none');
  });

  it('treats an unrecognised status as pending, never as a way in', () => {
    const state = siteUserState({ email: STRANGER, row: { status: 'ADMIN' } });
    expect(state).toBe('pending');
    expect(mayRequestMovies(state)).toBe(false);
  });

  it('honours a row over the hard-coded list, so revoking Seth works', () => {
    expect(siteUserState({ email: REQUESTER_EMAILS[1], row: { status: 'denied' } })).toBe('denied');
  });
});

describe('who may do what', () => {
  it('lets only listed and approved people request', () => {
    expect(mayRequestMovies('approved')).toBe(true);
    expect(mayRequestMovies('listed')).toBe(true);
    for (const state of ['pending', 'denied', 'none', 'signedOut']) {
      expect(mayRequestMovies(state)).toBe(false);
    }
  });

  it('gives the waiting list to an admin row', () => {
    expect(mayApprove({ row: { isAdmin: true }, email: STRANGER })).toBe(true);
  });

  it('gives it to Matt before his row exists, and to nobody else', () => {
    expect(mayApprove({ row: null, email: OWNER_EMAIL })).toBe(true);
    expect(mayApprove({ row: { status: 'approved' }, email: STRANGER })).toBe(false);
    // Being allowed to request is not being allowed to decide.
    expect(mayApprove({ row: null, email: REQUESTER_EMAILS[1] })).toBe(false);
  });

  it('is not fooled by a truthy isAdmin that is not true', () => {
    expect(mayApprove({ row: { isAdmin: 'yes' }, email: STRANGER })).toBe(false);
  });
});

describe('siteUserMessage', () => {
  it('greets a waiting person by first name', () => {
    expect(siteUserMessage('pending', { displayName: 'Jane Doe' }).title).toContain('Jane');
  });

  it('manages without a name', () => {
    expect(siteUserMessage('pending', {}).title).toBe('Matt has been asked');
  });

  it('gives a denied person nothing to press', () => {
    expect(siteUserMessage('denied').body).toContain('nothing to press');
  });

  it('says nothing at all to somebody who is through', () => {
    expect(siteUserMessage('approved')).toBeNull();
  });
});

describe('the admin screen\'s lists', () => {
  const rows = {
    a: { email: 'a@x.com', displayName: 'Zoe', status: 'pending', requestedAt: 300 },
    b: { email: 'b@x.com', displayName: 'Adam', status: 'pending', requestedAt: 100 },
    c: { email: 'c@x.com', displayName: 'Bob', status: 'approved', requestedAt: 200 },
    d: { email: 'd@x.com', displayName: 'Al', status: 'denied', requestedAt: 400 }
  };

  it('puts the longest wait at the top', () => {
    expect(pendingList(rows).map((row) => row.uid)).toEqual(['b', 'a']);
  });

  it('keeps the uid, which is the only thing a decision can be written to', () => {
    expect(pendingList(rows)[0].uid).toBe('b');
  });

  it('lists the decided, approved first', () => {
    expect(decidedList(rows).map((row) => row.uid)).toEqual(['c', 'd']);
  });

  it('copes with an empty database', () => {
    expect(pendingList(null)).toEqual([]);
    expect(decidedList(undefined)).toEqual([]);
  });
});

describe('useSiteAccess', () => {
  const matt = { uid: 'matt', email: OWNER_EMAIL, displayName: 'Matt' };
  const stranger = { uid: 'newcomer', email: STRANGER, displayName: 'A Stranger' };

  const harness = (user, stored = {}) => {
    const db = { ...stored };
    const read = vi.fn(async (path) => db[path] ?? null);
    const write = vi.fn(async (path, value) => { db[path] = value; });
    const timers = [];
    const setTimer = vi.fn((fn, ms) => { timers.push({ fn, ms }); return timers.length; });
    const clearTimer = vi.fn();
    const access = useSiteAccess({ read, write, user: () => user, setTimer, clearTimer });
    return { access, read, write, db, timers };
  };

  it('asks on behalf of a signed-in stranger who has never asked', async () => {
    const { access, write, timers } = harness(stranger);
    await access.refresh();
    expect(write).toHaveBeenCalledWith(siteUserPath('newcomer'), expect.objectContaining({ status: 'pending' }));
    expect(access.state.value).toBe('pending');
    // And keeps looking, so an approval lands without anyone refreshing.
    expect(timers[0].ms).toBe(SITE_USER_POLL_INTERVAL_MS);
  });

  it('writes nothing when askIfAbsent is off — Movie Hat\'s mode', async () => {
    // Movie Hat reads this row but must never create one: signing in there
    // is just using Movie Hat, and a pending row per family member would
    // fill Matt's waiting list with people who never asked for anything.
    const read = vi.fn(async () => null);
    const write = vi.fn();
    const access = useSiteAccess({
      read, write, user: () => stranger, askIfAbsent: false, setTimer: vi.fn(), clearTimer: vi.fn()
    });
    await access.refresh();
    expect(write).not.toHaveBeenCalled();
    expect(access.state.value).toBe('none');
    expect(access.ready.value).toBe(true);
  });

  it('does not ask twice for somebody already waiting', async () => {
    const { access, write } = harness(stranger, {
      [siteUserPath('newcomer')]: { email: STRANGER, status: 'pending', isAdmin: false, requestedAt: 1 }
    });
    await access.refresh();
    expect(write).not.toHaveBeenCalled();
    expect(access.state.value).toBe('pending');
  });

  it('stops polling once the answer is in', async () => {
    const { access, timers } = harness(stranger, {
      [siteUserPath('newcomer')]: { email: STRANGER, status: 'approved', isAdmin: false, requestedAt: 1 }
    });
    await access.refresh();
    expect(access.state.value).toBe('approved');
    expect(timers).toHaveLength(0);
  });

  it('writes Matt in as an admin on his first sign-in', async () => {
    const { access, write } = harness(matt);
    await access.refresh();
    expect(write).toHaveBeenCalledWith(siteUserPath('matt'), expect.objectContaining({ isAdmin: true, status: 'approved' }));
    expect(access.isAdmin.value).toBe(true);
  });

  it('reports signedOut without touching the database', async () => {
    const { access, read, write } = harness(null);
    expect(await access.refresh()).toBe('signedOut');
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(access.ready.value).toBe(true);
  });

  it('keeps the last known answer when a read blips, rather than locking somebody out', async () => {
    const user = stranger;
    const read = vi.fn()
      .mockResolvedValueOnce({ email: STRANGER, status: 'approved', isAdmin: false, requestedAt: 1 })
      .mockRejectedValueOnce(new Error('offline'));
    const access = useSiteAccess({ read, write: vi.fn(), user: () => user, setTimer: vi.fn(), clearTimer: vi.fn() });
    await access.refresh();
    expect(access.state.value).toBe('approved');
    await access.refresh();
    expect(access.state.value).toBe('approved');
  });

  it('does not alarm one of the hard-coded three when their row write is refused', async () => {
    const seth = { uid: 'seth', email: REQUESTER_EMAILS[1] };
    const access = useSiteAccess({
      read: vi.fn(async () => null),
      write: vi.fn(async () => { throw new Error('permission denied'); }),
      user: () => seth,
      setTimer: vi.fn(),
      clearTimer: vi.fn()
    });
    await access.refresh();
    expect(access.state.value).toBe('listed');
    expect(access.error.value).toBeNull();
  });
});
