import { dbPost } from '../store/db.js';

// In-app bug reporting, the pattern shared by Cinema Roll, Meal Hat and
// Full Table: a small always-visible button, a plain textarea, a write-only
// database node, triage from the command line (`yarn fetch-bug-reports`).
//
// Reports go through the same REST layer as everything else, so a signed-in
// reporter's email rides along on the token. But the node also accepts
// SIGNED-OUT reports — deliberately, and unlike the other apps: the bug that
// prompted this button was a login failure, and a report box that requires
// logging in cannot hear about those.

/**
 * What was true when the report was filed, chosen for what would explain a
 * bug in THIS app: which hat, how much of it loaded, and — because the
 * report that prompted all this was a sign-in failure — the full auth
 * picture, remembered email and live session both.
 */
function buildAppStateSummary (store, route) {
  const state = store.state;

  return {
    route: route?.fullPath || window.location.hash,
    version: process.env.VUE_APP_VERSION || null,

    // The auth picture. `email` is what localStorage remembers; `signedIn`
    // is whether Firebase actually has a session. The 2026-08 login bugs
    // lived exactly in the gap between the two.
    signedIn: Boolean(state.authUser),
    authResolved: Boolean(state.authResolved),
    rememberedEmail: Boolean(state.email),

    hat: state.movieHatTitle,
    hatKey: state.dbKeyForHatTitle,
    hatSize: (state.movieHat || []).length,
    historySize: (state.history || []).length,
    memberCount: Object.values(state.members || {}).length,

    // The error banner the reporter is probably describing.
    appError: state.appError,

    online: navigator.onLine
  };
}

function buildReport (store, text, route) {
  return {
    createdAt: { '.sv': 'timestamp' },
    transcript: text,
    reporterEmail: store.state.email || null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio || 1,
    // Stringified, not a nested object: RTDB silently drops keys whose value
    // is an empty object, so a plain object here can lose fields unnoticed.
    appState: JSON.stringify(buildAppStateSummary(store, route))
  };
}

// Offline stash: a report typed with no signal waits in localStorage and
// goes out on the next launch or the next successful send.
const STASH_KEY = 'movieHatPendingBugReports';
const STASH_LIMIT = 10;

function readStash () {
  try {
    const parsed = JSON.parse(localStorage.getItem(STASH_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStash (reports) {
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(reports.slice(-STASH_LIMIT)));
  } catch {
    // Storage full or blocked. Nothing more a best-effort stash can do.
  }
}

/** Send anything stashed earlier. Returns how many went out. */
export async function flushStashedBugReports () {
  const stash = readStash();
  if (!stash.length || !navigator.onLine) return 0;

  let sent = 0;
  for (const report of stash) {
    try {
      // Re-stamped on the eventual write; clientCreatedAt still says when it
      // actually happened.
      await dbPost('bugReports', { ...report, createdAt: { '.sv': 'timestamp' } });
      sent += 1;
    } catch {
      // Still unreachable — keep the rest for next time.
      break;
    }
  }

  writeStash(stash.slice(sent));
  return sent;
}

/**
 * File a report.
 *
 * Resolves `{ queued: true }` when it reached only the stash, so the UI can
 * say "saved, will send later" instead of a misleading "sent". Throws only
 * when online and the write genuinely failed — the text stays with the
 * caller for a retry, and stashing it too would send a duplicate.
 */
export async function submitBugReport (store, transcript, route) {
  const text = (transcript || '').trim();
  if (!text) throw new Error('Describe what happened before sending.');

  const report = buildReport(store, text, route);

  try {
    await dbPost('bugReports', report);
    flushStashedBugReports().catch(() => {});
  } catch (error) {
    if (!navigator.onLine) {
      writeStash([...readStash(), { ...report, createdAt: null, clientCreatedAt: Date.now(), queuedOffline: true }]);
      return { queued: true };
    }
    throw error;
  }

  return { queued: false };
}
