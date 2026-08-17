// Whether to volunteer the tutorial.
//
// Shown once, unasked, to somebody who belongs to no hats — which is
// exactly the moment the app used to drop a stranger onto a lone "Add New
// Hat" button with no explanation, and collect a hat called "Hatbbbbb" for
// its trouble. Anyone can replay it from the hat list afterwards.

const SEEN_KEY = 'movieHatTutorialSeen';

export function hasSeenTutorial (storage = window.localStorage) {
  try {
    return storage.getItem(SEEN_KEY) === 'true';
  } catch {
    // No storage (private mode, wiped): better to show the tour again than
    // to hide it forever.
    return false;
  }
}

export function markTutorialSeen (storage = window.localStorage) {
  try {
    storage.setItem(SEEN_KEY, 'true');
  } catch {
    // Nothing to do — it just gets offered again next time.
  }
}

/**
 * Should the app offer the tutorial right now, without being asked?
 * Only when someone has finished loading their hats, has none, and has
 * never seen it.
 */
export function shouldOfferTutorial ({ hatCount, seen }) {
  return hatCount === 0 && !seen;
}
