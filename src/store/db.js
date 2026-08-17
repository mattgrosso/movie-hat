// Every read and write to the hats database goes through here.
//
// Why this exists (2026-08-16): the app signs you in with Google, but its
// data access was plain unauthenticated REST — `axios.get(...firebaseio.com
// /hats/....json)` — so the database has to be world-readable and
// world-writable for the app to work at all. Anyone with the URL can read,
// edit or empty any hat, including the ones shared with family.
//
// Closing that means the database rules have to require a signed-in user,
// and that can only happen once every request carries a token. This module
// is that step: same calls, same shapes, now with `?auth=<id token>`
// attached whenever there is a session.
//
// It is DELIBERATELY tolerant while the rules are still open: no session
// means the request goes out unauthenticated and works exactly as before.
// That is what makes this safe to ship on its own, ahead of the rules —
// nothing changes for anyone until the rules change.
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { emailToMemberKey } from './memberKey.mjs';

const DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';

// Firebase restores a persisted session ASYNCHRONOUSLY. For the first few
// hundred milliseconds after a page load, `currentUser` is null even for
// somebody who is perfectly signed in — and the app reads its hat during
// exactly that window, at start-up.
//
// This caused a real outage (2026-08-17): every request on load went out
// unauthenticated, the closed rules refused all of them, and the app showed
// an empty screen with no error. Waiting for the FIRST auth callback before
// deciding "nobody is signed in" is the fix.
let firstAuthResult = null;

function authReady () {
  if (!firstAuthResult) {
    firstAuthResult = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        getAuth(),
        (user) => { unsubscribe(); resolve(user || null); },
        () => resolve(null)
      );
    });
  }
  return firstAuthResult;
}

/**
 * The current user's ID token, or null when nobody is signed in.
 *
 * getIdToken() refreshes on its own when the hour-long token is close to
 * expiring, which is the main reason to ask for it per request rather than
 * holding one.
 */
export async function authToken () {
  try {
    // currentUser first (cheap, and correct once auth has settled); otherwise
    // wait for the session to be restored rather than assuming there is none.
    // authReady is only ever a "has auth settled yet" gate — the user always
    // comes from currentUser, because the cached first result goes stale the
    // moment somebody signs out or a different account signs in.
    let user = getAuth()?.currentUser;
    if (!user) {
      await authReady();
      user = getAuth()?.currentUser;
    }
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    // A token we can't get is the same as no token: let the request go and
    // let the database decide.
    console.warn('Could not get an auth token', error);
    return null;
  }
}

/** `hats/Dev Hat/key` → a full URL with the title escaped and the token on. */
export function buildUrl (path, token) {
  const clean = String(path || '').replace(/^\/+/, '');
  const url = `${DATABASE_URL}/${clean}.json`;
  return token ? `${url}?auth=${encodeURIComponent(token)}` : url;
}

async function request (path, options = {}) {
  const token = await authToken();
  const response = await fetch(buildUrl(path, token), options);

  if (!response.ok) {
    const error = new Error(`Movie Hat database responded ${response.status}`);
    error.status = response.status;
    // A silent 401 is what made the outage look like "nothing loads" rather
    // than "you are signed out".
    if (response.status === 401) {
      console.warn('Movie Hat refused the request — not signed in?', path);
    }
    throw error;
  }

  const text = await response.text();
  return text && text !== 'null' ? JSON.parse(text) : null;
}

export const dbGet = (path) => request(path);

export const dbPost = (path, body) => request(path, {
  method: 'POST',
  body: JSON.stringify(body)
});

export const dbPut = (path, body) => request(path, {
  method: 'PUT',
  body: JSON.stringify(body)
});

export const dbPatch = (path, body) => request(path, {
  method: 'PATCH',
  body: JSON.stringify(body)
});

export const dbDelete = (path) => request(path, { method: 'DELETE' });

/**
 * A hat's storage key, WITHOUT listing the title.
 *
 * The app used to find it by reading `hats/<title>` and taking the first key
 * underneath. Once the rules are on, that read is at a level nobody is
 * allowed to read — access is granted per hat, not per title — so the key
 * comes from your own index instead.
 *
 * Falls back to the old listing when the index has no answer, which keeps
 * this working today and for any hat created before the index existed.
 */
export async function resolveHatKey (title, email) {
  const memberKey = emailToMemberKey(email);

  if (memberKey) {
    try {
      const entry = await dbGet(`userHats/${memberKey}/${emailToMemberKey(title)}`);
      if (entry?.hatKey) return entry.hatKey;
    } catch {
      // Fall through to the listing below.
    }
  }

  // With the rules on, this title-level read is refused for everyone — it
  // exists for data from before the index did, and for the day the rules are
  // ever loosened again. Refusal means "no answer", never a crash: this
  // being unguarded was a silent-blank-screen bug for anyone whose index
  // lacked the remembered hat.
  try {
    const listed = await dbGet(hatPath(title));
    return listed ? Object.keys(listed)[0] : null;
  } catch {
    return null;
  }
}

/** Escapes a hat title for use in a path. Titles contain spaces and '&'. */
export const hatPath = (title, ...rest) =>
  ['hats', encodeURIComponent(title), ...rest.filter((part) => part != null)].join('/');
