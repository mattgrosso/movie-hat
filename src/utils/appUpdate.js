// Shared machinery for applying a detected app update. Ported from Cinema
// Roll's utils/appUpdate.js, which distilled two of its bug reports:
//
//  - July 2026: an unconditional reload-on-update yanked the page out from
//    under whatever the user was doing. So: never reload at an unsafe
//    moment.
//  - August 2026: "why show that to them at all... just refresh the app
//    automatically when the banner would be presented. The banner could
//    still be a fallback." So: automatic, but only at a provably quiet
//    moment, with the banner for the cases that never get one.

// Waits until no service worker install is in flight, so a reload lands on
// the NEW app instead of a mixed old/new state. Capped; failures never
// block the reload itself.
export async function waitForNewWorker (timeoutMs = 15000) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (!registration) return;
    await registration.update().catch(() => {});
    const deadline = Date.now() + timeoutMs;
    while ((registration.installing || registration.waiting) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } catch {
    // Any surprise here must never eat the reload itself.
  }
}

export async function reloadForUpdate () {
  await waitForNewWorker();
  window.location.reload();
}

// Screens whose entire state is in memory, so a reload silently throws work
// away rather than just re-rendering:
//  - /pick-a-movie holds the TMDB search results (`movieChoices`, store-only,
//    never persisted) plus the note field for the movie just added. A reload
//    here loses the search and drops the user back at an empty hat screen.
//  - /tutorial holds the step you're on. A reload restarts it at step one.
// Everything else recovers itself: the hat re-reads from Firebase, and the
// drawn movie is stashed in localStorage as `lastDrawnMovie` precisely so a
// relaunch on that screen still has something to show.
const IN_MEMORY_ROUTES = ['/pick-a-movie', '/tutorial'];

// Is RIGHT NOW a safe moment to reload out from under the user?
// Injectable for tests. Unsafe whenever:
//  - a text input is focused (typing a search or a note),
//  - a Bootstrap modal is open (mid new-hat / delete / leave flow),
//  - the drawn-movie reveal is playing (the hat animation),
//  - the bug-report panel is open (see `reporting` below),
//  - we're on a screen that only exists in memory (see above).
export function isSafeMomentForReload ({
  activeElement = document.activeElement,
  bodyClassList = document.body.classList,
  revealing = Boolean(document.querySelector('.drawing-hat')),
  // The bug-report panel is hand-rolled rather than a Bootstrap modal (so it
  // can never freeze the app), which means it does NOT set `modal-open` and
  // the check above cannot see it. Its own class has to be asked for. A
  // focused-textarea check is not enough on a phone: dismiss the keyboard to
  // re-read what you typed and the textarea blurs, leaving an unsent report
  // sitting in memory looking exactly like an idle page.
  reporting = Boolean(document.querySelector('.bug-report-backdrop')),
  routePath = ''
} = {}) {
  const tag = activeElement?.tagName || '';
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return false;
  if (bodyClassList.contains('modal-open')) return false;
  if (revealing) return false;
  if (reporting) return false;
  if (IN_MEMORY_ROUTES.some((route) => routePath.startsWith(route))) return false;
  return true;
}

// One auto-attempt per detected target bundle, ever — if the reload doesn't
// actually get us onto the new version (stuck worker, cache oddity), the
// banner takes over rather than reloading in a loop.
const ATTEMPT_KEY = 'auto-update-attempted-for';

export function shouldAutoAttempt (targetBundle, storage = window.sessionStorage) {
  try {
    if (storage.getItem(ATTEMPT_KEY) === targetBundle) return false;
    storage.setItem(ATTEMPT_KEY, targetBundle);
    return true;
  } catch {
    return true; // storage unavailable: still better to try once than never
  }
}
