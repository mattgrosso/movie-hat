// The screens that load on demand (Request a movie, Access, Peek) are
// separate files fetched the first time someone opens one. When that fetch
// fails the tap did nothing at all: an iPhone on a dropping connection
// tapped Request a movie, Safari said "Unable to preload CSS for
// /css/RequestAMovie.<hash>.css", and the screen never appeared
// (2026-10-26). The file was being served fine.
//
// Two reasons it fails, two answers. Offline: stay put and say so. Online:
// most likely the page is from an older build whose files the last deploy
// deleted (each deploy syncs with --delete), so reload once straight into
// the screen. A flag in sessionStorage makes it once: if the reloaded page
// fails too, the message shows instead of another reload.

export const SCREEN_LOAD_MESSAGE = "Couldn't open that screen. Check your connection and try again.";

const FLAG = 'movieHat.screenLoadRetry';

// Safari: "Unable to preload CSS for …" (Vite's preload helper) and
// "Importing a module script failed." Chrome: "Failed to fetch dynamically
// imported module: …". Firefox: "error loading dynamically imported module".
// Shared with Sentry's ignore list (utils/sentryNoise.js).
export const SCREEN_LOAD_FAILURES = [
  /Unable to preload CSS for/,
  /Failed to fetch dynamically imported module/,
  /error loading dynamically imported module/,
  /Importing a module script failed/,
];

/** True when the error only says an on-demand screen's file didn't download. */
export function isScreenLoadFailure (error) {
  const text = String(error?.message ?? error ?? '');
  return SCREEN_LOAD_FAILURES.some((re) => re.test(text));
}

/**
 * router.onError and router.afterEach handlers. Everything the browser does
 * is passed in so the decision can be tested without one.
 */
export function screenLoadHandlers ({ isOnline, storage, reloadInto, showMessage }) {
  return {
    onError (error, to) {
      if (!isScreenLoadFailure(error)) return false;
      const path = to?.fullPath ?? '/';
      if (isOnline() && storage.getItem(FLAG) !== path) {
        storage.setItem(FLAG, path);
        reloadInto(path);
        return 'reloaded';
      }
      storage.removeItem(FLAG);
      showMessage(SCREEN_LOAD_MESSAGE);
      return 'shown';
    },
    // A screen that opened clears the flag, so a later failure gets its reload.
    afterEach () {
      storage.removeItem(FLAG);
    }
  };
}

/** The browser's side: reload the page with the hash already on the screen. */
export function browserScreenLoadHandlers (showMessage) {
  const storage = {
    getItem: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    setItem: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
    removeItem: (k) => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
  };
  return screenLoadHandlers({
    isOnline: () => navigator.onLine !== false,
    storage,
    // replaceState rather than setting location.hash: a hash change would
    // send the router after the screen again before the reload lands.
    reloadInto (path) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', `${pathname}${search}#${path}`);
      window.location.reload();
    },
    showMessage,
  });
}
