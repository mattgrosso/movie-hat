// The current hat, kept on the phone so opening Movie Hat draws it at once.
//
// Bug report (2026-10-22, Matt): "Loading my hat has been really slow the
// last couple of days." Every open waited for Firebase to restore the
// session, then downloaded the whole hat (about 209 KB for his: 229 movies
// and 644 past draws) before the hat screen had anything to show - and on a
// day of deploys, an open that finds an update reloads and does it twice.
// Now the last copy read is shown the moment the store exists, and getHat's
// read replaces it quietly when it lands.
//
// One hat, one account: the copy names the email and the hat key it was read
// for, and is only ever shown when BOTH match what this phone remembers. A
// different account signing in, or signing out, throws it away.

export const HAT_CACHE_KEY = 'movieHat.hatCache';

/** The saved copy for this email and hat, or null. Junk counts as nothing. */
export function readHatCache (storage, { email, hatKey } = {}) {
  if (!storage || !email || !hatKey) return null;
  try {
    const saved = JSON.parse(storage.getItem(HAT_CACHE_KEY));
    if (!saved || saved.email !== email || saved.hatKey !== hatKey) return null;
    if (!Array.isArray(saved.movies) || !Array.isArray(saved.history)) return null;
    return saved;
  } catch {
    return null;
  }
}

/** Which account the saved copy belongs to, or null. */
export function hatCacheEmail (storage) {
  try {
    return JSON.parse(storage.getItem(HAT_CACHE_KEY))?.email || null;
  } catch {
    return null;
  }
}

/**
 * Save the hat as the store holds it. A full phone (quota) just means no
 * copy: the next open reads from the database as it always did.
 */
export function writeHatCache (storage, { email, hatKey, title, movies, history, members, mirrorFeedKey }) {
  if (!storage || !email || !hatKey || !Array.isArray(movies) || !Array.isArray(history)) return false;
  try {
    storage.setItem(HAT_CACHE_KEY, JSON.stringify({
      email, hatKey, title, movies, history, members: members ?? null, mirrorFeedKey: mirrorFeedKey ?? null, savedAt: Date.now()
    }));
    return true;
  } catch {
    try { storage.removeItem(HAT_CACHE_KEY); } catch { /* nothing to do */ }
    return false;
  }
}

export function clearHatCache (storage) {
  try { storage?.removeItem(HAT_CACHE_KEY); } catch { /* nothing to do */ }
}
