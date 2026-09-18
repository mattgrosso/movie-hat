// Who is allowed to be here.
//
// SHARED, BYTE-IDENTICAL, between movie-hat and movie-requests. Change one,
// copy it to the other, run both test suites.
//
// Movie Requests is public in the only sense that matters: anyone on the
// internet can open request.movie-hat.com and sign in with Google. Signing
// in buys you nothing. It writes one row —
//
//   siteUsers/<uid>: { email, displayName, status: 'pending', isAdmin: false,
//                      requestedAt }
//
// — and parks you on a screen that says Matt has been asked. Matt approves
// or denies from /#/admin, and `status: 'approved'` is what Movie Hat's
// database rules read before they will accept a request row.
//
// `siteUsers` is not a name invented here. It is the Around Table Round
// games' gate (camel-up/src/store/siteAccess.js), same field names, same
// pending/approved/denied, same isAdmin flag. That hub is a different
// Firebase project so the node cannot literally be shared — but anyone who
// has read one of these now knows the other, and the rules are the same
// shape too.
//
// Where the boundary actually lives: movie-hat's
// scripts/generate-hat-rules.mjs, pinned by its
// src/test/emulated/siteUsersRules.test.js. Nothing in this file is a
// security check — it decides which screen to show, and the database
// decides everything else.
//
// ONE DIFFERENCE BETWEEN THE TWO APPS, and it is the important one. In Movie
// Requests, signing in IS asking to be let in, so `useSiteAccess` writes a
// pending row for anybody who has none. In Movie Hat, signing in is just
// using Movie Hat — most of the people who do are family members in a hat
// who have never heard of any of this, and writing them a pending row would
// fill Matt's waiting list with people who never asked for anything. So
// Movie Hat only ever READS the row (store action `loadSiteUser`), with the
// single exception of Matt's own bootstrap. `askIfAbsent` below is that
// switch.
import { ref, computed } from 'vue';
import { mayRequest, isOwner } from '../assets/javascript/owner.mjs';

export const SITE_USER_STATUSES = ['pending', 'approved', 'denied'];

export const siteUserPath = (uid) => `siteUsers/${uid}`;

/**
 * The row a newcomer writes for themselves. The rules will only accept it
 * with status 'pending', isAdmin false and an `email` matching the token, so
 * those three are not negotiable here either.
 *
 * Matt is the exception, and it is the rules' exception rather than this
 * file's invention: his first sign-in writes him in approved and admin,
 * because bootstrapping the first admin needs some door and a Google-signed
 * address is the only thing available before any row exists.
 *
 * `requestedAt` is Firebase's server-timestamp sentinel, which the database
 * replaces with its own clock — so the rules can insist it is a number and
 * the admin screen can trust the ordering.
 */
export function buildSiteUser ({ email, displayName, photoURL }) {
  if (typeof email !== 'string' || !email) throw new Error('A site user needs a signed-in email');

  const bootstrap = isOwner(email);
  const row = {
    email,
    status: bootstrap ? 'approved' : 'pending',
    isAdmin: bootstrap,
    requestedAt: { '.sv': 'timestamp' }
  };
  // Optional, and only what Google already told us. They are here so the
  // admin screen shows a person rather than a hex uid.
  if (displayName) row.displayName = String(displayName).slice(0, 120);
  if (photoURL) row.photoURL = String(photoURL).slice(0, 500);
  return row;
}

/**
 * Where someone stands, as one word — the only thing the app routes on.
 *
 *   'listed'    One of REQUESTER_EMAILS, the three who predate this app.
 *               They are through on their email alone and need no row.
 *   'approved'  Somebody said yes.
 *   'pending'   Asked, waiting.
 *   'denied'    Somebody said no.
 *   'none'      Signed in, never asked. The app asks on their behalf.
 *   'signedOut' Nobody is signed in.
 *
 * Matt comes out 'approved' like any other approved row — he has one, and
 * `isAdmin` on it is what gets him the waiting list (see `mayApprove`).
 */
export function siteUserState ({ email, row } = {}) {
  if (!email) return 'signedOut';
  if (row && SITE_USER_STATUSES.includes(row.status)) return row.status;
  // No row yet. The three hard-coded addresses still work without one,
  // because the rules let them through on the token's email.
  if (mayRequest(email)) return 'listed';
  if (!row) return 'none';
  // A row with a status nothing recognises is not a key to anything.
  return 'pending';
}

/** May this person actually ask for a movie? */
export function mayRequestMovies (state) {
  return state === 'listed' || state === 'approved';
}

/**
 * May this person see the waiting list and decide? The flag on the row, not
 * a hard-coded name — which is what lets Matt hand it to somebody else. He
 * is allowed in before his own row exists so the very first sign-in on a new
 * device isn't a chicken-and-egg problem; the rules agree.
 */
export function mayApprove ({ row, email } = {}) {
  return row?.isAdmin === true || isOwner(email);
}

/**
 * What the waiting screen says. Deliberately plain about the one thing
 * people will wonder — whether anything more is required of them.
 */
export function siteUserMessage (state, { displayName } = {}) {
  const who = displayName ? displayName.split(' ')[0] : null;
  switch (state) {
    case 'pending':
      return {
        title: who ? `Thanks, ${who} — Matt has been asked` : 'Matt has been asked',
        body: 'Your request to use Movie Requests is waiting for Matt to approve it. Nothing else is needed from you; this page will let you in as soon as he does.'
      };
    case 'denied':
      return {
        title: 'Not this time',
        body: 'Matt hasn’t approved this account. If you think that’s a mistake, ask him directly — there’s nothing to press here.'
      };
    case 'none':
      return { title: 'Asking Matt…', body: 'One moment.' };
    default:
      return null;
  }
}

/** The waiting list, longest wait first — whoever has been patient longest. */
export function pendingList (rows) {
  return Object.entries(rows || {})
    .map(([uid, row]) => ({ uid, ...row }))
    .filter((row) => row.status === 'pending')
    .sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
}

/** Everyone already decided on, approved first, then by name. */
export function decidedList (rows) {
  const rank = { approved: 0, denied: 1 };
  return Object.entries(rows || {})
    .map(([uid, row]) => ({ uid, ...row }))
    .filter((row) => row.status === 'approved' || row.status === 'denied')
    .sort((a, b) => (rank[a.status] - rank[b.status]) ||
      String(a.displayName || a.email).localeCompare(String(b.displayName || b.email)));
}

// A pending row is waiting on a human, so the screen checks back at a human
// pace rather than a polling one. It also re-reads whenever the page comes
// back to the foreground (App.vue), which is how somebody who left the tab
// open learns they were let in.
export const SITE_USER_POLL_INTERVAL_MS = 20 * 1000;

/**
 * useSiteAccess({ read, write, user })
 *
 *   read(path)         → the value at `path`, or null
 *   write(path, value) → PUT `value` at `path`
 *   user               → the signed-in Firebase user (a ref/getter), or null
 *   askIfAbsent        → write a pending row for somebody who has none.
 *                        True in Movie Requests, where signing in IS the
 *                        ask; false anywhere signing in means something else
 *                        (see the header comment).
 *
 * Returns `state` (the word above), `row`, `ready` (the first read has
 * happened — until then the app shows nothing rather than flashing the wrong
 * screen), `isAdmin`, `message` and `refresh()`.
 *
 * Asking is automatic: a signed-in person with no row gets one written for
 * them. There is no "request access" button because there is no decision to
 * make — you either signed in to use this app or you closed the tab.
 */
export function useSiteAccess ({ read, write, user, askIfAbsent = true, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const row = ref(null);
  const ready = ref(false);
  const error = ref(null);

  let timer = null;
  let watching = null; // the uid being polled, so a stale tick can't land

  const account = () => (typeof user === 'function' ? user() : (user?.value ?? user)) || null;
  const email = computed(() => account()?.email || null);
  const state = computed(() => siteUserState({ email: email.value, row: row.value }));
  const isAdmin = computed(() => mayApprove({ row: row.value, email: email.value }));
  const message = computed(() => siteUserMessage(state.value, { displayName: account()?.displayName }));

  function stop () {
    if (timer) clearTimer(timer);
    timer = null;
    watching = null;
  }

  async function refresh () {
    const me = account();
    if (!me) {
      stop();
      row.value = null;
      ready.value = true;
      return 'signedOut';
    }

    try {
      row.value = await read(siteUserPath(me.uid));
    } catch (readError) {
      // Your own row is readable by you, so a failure here is a blip, not an
      // answer. Keep whatever we had and try again on the next tick.
      console.warn('Could not read the site user row', readError);
      ready.value = true;
      return state.value;
    }

    if (!row.value && askIfAbsent) {
      // Never asked. Ask now, on their behalf.
      try {
        const asked = buildSiteUser({
          email: me.email,
          displayName: me.displayName,
          photoURL: me.photoURL
        });
        await write(siteUserPath(me.uid), asked);
        row.value = { ...asked, requestedAt: Date.now() };
      } catch (writeError) {
        // The three hard-coded addresses do not need a row, so a refusal
        // here is only a problem for everybody else.
        if (!mayRequest(me.email)) {
          console.error('Could not ask for access', writeError);
          error.value = 'Couldn’t reach Matt just now. Reload and try again.';
        }
      }
    }

    ready.value = true;

    // Only a pending row is going to change under us.
    if (row.value?.status === 'pending') watch(me.uid);
    else stop();

    return state.value;
  }

  function watch (uid) {
    stop();
    watching = uid;
    timer = setTimer(() => {
      timer = null;
      if (watching !== uid) return undefined;
      return refresh();
    }, SITE_USER_POLL_INTERVAL_MS);
  }

  return { state, row, ready, error, isAdmin, message, refresh, stop };
}
