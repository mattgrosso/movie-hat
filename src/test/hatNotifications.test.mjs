// The per-hat notification switch (2026-09-20, report -P20Hn9jIGLCIIRyydRL:
// "I should be able to turn on or off notifications per hat, not just for the
// whole app").
//
// What matters here is the SHAPE of what gets written, because two programs
// read it: the app (src/utils/push.js) and the Lambda that decides whether to
// send (aws-lambda/push-notify.js). They agree on `push/<memberKey>/mutedHats
// /<hatKey>` holding `true`, on absence meaning "notify me", and on un-muting
// deleting the row rather than writing `false` — a lingering `false` would be
// truthy to nobody, but it would make "never had an opinion" and "said yes"
// look different in the data for no reason.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbGet = vi.fn();
const dbPut = vi.fn();
const dbDelete = vi.fn();
let currentEmail = 'matt.grosso@example.com';

vi.mock('../store/db.js', () => ({
  dbGet: (...args) => dbGet(...args),
  dbPut: (...args) => dbPut(...args),
  dbDelete: (...args) => dbDelete(...args)
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: currentEmail ? { email: currentEmail } : null })
}));

const { mutedHatKeys, setHatNotifications } = await import('../utils/push.js');

// The email above has a dot in it on purpose: the path has to carry the
// member KEY, not the address.
const MEMBER_KEY = 'matt-grosso@example-com';

beforeEach(() => {
  currentEmail = 'matt.grosso@example.com';
  dbGet.mockReset();
  dbPut.mockReset();
  dbDelete.mockReset();
});

describe('mutedHatKeys', () => {
  it('reads the mute list under the member key', async () => {
    dbGet.mockResolvedValue({ '-NP5dbtXUMBZpHth_2BG': true });

    const muted = await mutedHatKeys();

    expect(dbGet).toHaveBeenCalledWith(`push/${MEMBER_KEY}/mutedHats`);
    expect(muted.has('-NP5dbtXUMBZpHth_2BG')).toBe(true);
  });

  it('treats a hat with no row as un-muted — the default is on', async () => {
    dbGet.mockResolvedValue(null);

    const muted = await mutedHatKeys();

    expect(muted.size).toBe(0);
  });

  it('ignores a falsy row rather than counting it as muted', async () => {
    dbGet.mockResolvedValue({ '-oldHat': false, '-mutedHat': true });

    const muted = await mutedHatKeys();

    expect(muted.has('-oldHat')).toBe(false);
    expect(muted.has('-mutedHat')).toBe(true);
  });

  it('answers "nothing is muted" when the read fails', async () => {
    dbGet.mockRejectedValue(new Error('offline'));

    await expect(mutedHatKeys()).resolves.toEqual(new Set());
  });

  it('answers "nothing is muted" when nobody is signed in', async () => {
    currentEmail = null;

    await expect(mutedHatKeys()).resolves.toEqual(new Set());
    expect(dbGet).not.toHaveBeenCalled();
  });
});

describe('setHatNotifications', () => {
  it('muting writes true at the hat', async () => {
    await setHatNotifications('-NP5dbtXUMBZpHth_2BG', false);

    expect(dbPut).toHaveBeenCalledWith(`push/${MEMBER_KEY}/mutedHats/-NP5dbtXUMBZpHth_2BG`, true);
    expect(dbDelete).not.toHaveBeenCalled();
  });

  it('un-muting deletes the row instead of writing false', async () => {
    await setHatNotifications('-NP5dbtXUMBZpHth_2BG', true);

    expect(dbDelete).toHaveBeenCalledWith(`push/${MEMBER_KEY}/mutedHats/-NP5dbtXUMBZpHth_2BG`);
    expect(dbPut).not.toHaveBeenCalled();
  });

  it('refuses to guess at a member or a hat', async () => {
    currentEmail = null;
    await expect(setHatNotifications('-NP5dbtXUMBZpHth_2BG', false)).rejects.toThrow('Sign in first.');

    currentEmail = 'matt.grosso@example.com';
    await expect(setHatNotifications(null, false)).rejects.toThrow('No hat to change.');

    expect(dbPut).not.toHaveBeenCalled();
    expect(dbDelete).not.toHaveBeenCalled();
  });
});
