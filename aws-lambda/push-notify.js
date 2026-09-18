// Push notification sender for Movie Hat (2026-08-28, Matt: "get a
// notification when somebody draws a movie from a hat that you're in").
// Deployed as Lambda `movie-hat-push`. Ported from Cinema Roll's
// aws-lambda/push-notify.js; one notification source and no schedule —
// everything here is event-driven from the drawer's own client:
//
//   POST /push/drawn - the drawer's app announces a saved draw
//                      (DrawMovie.vue). Fans out to every OTHER member of
//                      that hat who has a subscribed device.
//   POST /push/test  - a test notification to the caller's own devices.
//
// Plus a sweep, on an EventBridge schedule (`movie-hat-push-sweep`, every
// two minutes, 2026-09-11), which now does two things:
//
//   - A movie request whose download has finished tells the person who asked
//     for it. The Mac mini service that talks to Radarr stamps
//     `requests/<tmdbId>/importedAt` when the file lands; the sweep notifies
//     each such row once and stamps `notifiedAt`. A poll rather than a call
//     from the service, so the service needs no credentials for this Lambda
//     and the two can be deployed without knowing about each other.
//   - Somebody waiting to be let into Movie Requests
//     (request.movie-hat.com, 2026-09-18) tells every admin. Same shape:
//     `siteUsers/<uid>` rows with `status: 'pending'` and no `notifiedAt`.
//     That one goes to MOVIE HAT's subscriptions by preference — the waiting
//     list is a screen in this app now (/#/access), so an admin needs only
//     the one app installed.
//
// TWO APPS, TWO SETS OF SUBSCRIPTIONS. A push subscription belongs to one
// service worker on one origin, so Movie Hat's live at
// `push/<memberKey>/subscriptions` and Movie Requests' at
// `push/<memberKey>/requestsAppSubscriptions`. Sending to the wrong set is
// not a delivery failure — it delivers, to the wrong app, and on iOS a
// notification whose URL is outside the installed app's scope opens in an
// in-app browser instead of the app (report -P1kJdlGJpzL0at-54jt). So every
// message below names both the subscription set and the origin its
// `navigate` URL belongs to.
//
// Both HTTP routes are gated on a verified Firebase ID token from THIS app's
// project (movie-hat-9c418) - the audience/issuer checks below are what stop
// a valid token from any other Firebase project. /push/drawn additionally
// verifies the caller is a member of the hat they claim to be announcing
// from, so nobody can spray notifications into hats they can't read.
//
// Payloads are declarative web push (`web_push: 8030`); public/push-sw.js
// renders the same JSON on platforms that don't support that. Plain node
// crypto + fetch, web-push as the only dependency.
//
// Env vars: FIREBASE_SA (service-account JSON), VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT.

const crypto = require('crypto');
const webpush = require('web-push');

const FIREBASE_PROJECT_ID = 'movie-hat-9c418';
const DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';
const FIREBASE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
// The BARE domain, deliberately. One CloudFront distribution serves both
// movie-hat.com and www.movie-hat.com with no redirect between them, so they
// are two separate PWA scopes. Everyone installs from the bare one -- it is
// what the invite email in HatsList.vue tells people to visit, and every bug
// report ever filed came from it -- so a notification pointing at www lands
// OUTSIDE the installed app scope, and iOS answers that by opening the URL
// in an in-app browser instead of handing it to the app. That is report
// -P1kJdlGJpzL0at-54jt: "it brought me to the Movie Hat app, but then it
// seemed to open the like embedded Safari within the Movie Hat app".
const APP_URL = 'https://movie-hat.com';

// The standalone Movie Requests app. Its own origin, its own PWA scope, its
// own subscription set (see the header comment).
const REQUESTS_APP_URL = 'https://request.movie-hat.com';
const MOVIE_HAT_SUBSCRIPTIONS = 'subscriptions';
const REQUESTS_APP_SUBSCRIPTIONS = 'requestsAppSubscriptions';

const ALLOWED_ORIGINS = [
  'https://www.movie-hat.com',
  'https://movie-hat.com',
  'https://request.movie-hat.com',
  'http://localhost:8080',
  'http://localhost:8081'
];

// Mirrors src/store/memberKey.mjs — lowercased, Firebase-forbidden key
// characters replaced. The rules and the app both apply this same transform;
// drifting from it here would fan notifications out to nobody.
const UNSAFE_KEY_CHARACTERS = ['.', '$', '#', '[', ']', '/'];
const emailToMemberKey = (email) => {
  if (typeof email !== 'string' || !email) return null;
  return UNSAFE_KEY_CHARACTERS.reduce(
    (key, character) => key.split(character).join('-'),
    email.trim().toLowerCase()
  );
};

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:mattgrosso@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
});

let activeOrigin = ALLOWED_ORIGINS[0];
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders(activeOrigin),
  body: JSON.stringify(body)
});

// --- Firebase ID token verification (Cinema Roll's, project id swapped) -----

let certCache = { keys: null, expiresAt: 0 };

const fetchCerts = async () => {
  if (certCache.keys && Date.now() < certCache.expiresAt) return certCache.keys;
  const res = await fetch(FIREBASE_CERT_URL);
  if (!res.ok) throw new Error(`Could not fetch Firebase certs: ${res.status}`);
  const keys = await res.json();
  const maxAge = Number((/max-age=(\d+)/.exec(res.headers.get('cache-control') || '') || [])[1] || 3600);
  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
};

const fromBase64Url = (value) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const verifyIdToken = async (authorization) => {
  const token = (authorization || '').replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(parts[0]).toString('utf8'));
    payload = JSON.parse(fromBase64Url(parts[1]).toString('utf8'));
  } catch {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;

  const certs = await fetchCerts();
  const cert = certs[header.kid];
  if (!cert) return null;

  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey(cert),
    fromBase64Url(parts[2])
  );
  if (!signatureValid) return null;

  // Audience and issuer checks are load-bearing — without them a valid token
  // from ANY Firebase project is accepted.
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) return null;
  if (payload.aud !== FIREBASE_PROJECT_ID) return null;
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
  if (!payload.sub) return null;

  return payload;
};

// --- Admin RTDB access via service-account OAuth (Cinema Roll's) ------------

let dbTokenCache = { token: null, expiresAt: 0 };

const toBase64Url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const getDbToken = async () => {
  if (dbTokenCache.token && Date.now() < dbTokenCache.expiresAt - 60000) {
    return dbTokenCache.token;
  }
  const sa = JSON.parse(process.env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = toBase64Url(Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })));
  const signature = toBase64Url(crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), sa.private_key));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${signature}`
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  dbTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return dbTokenCache.token;
};

const dbGet = async (path) => {
  const token = await getDbToken();
  const res = await fetch(`${DATABASE_URL}/${path}.json`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`RTDB GET ${path} failed: ${res.status}`);
  return res.json();
};

const dbDelete = async (path) => {
  const token = await getDbToken();
  const res = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`RTDB DELETE ${path} failed: ${res.status}`);
};

const dbSet = async (path, value) => {
  const token = await getDbToken();
  const res = await fetch(`${DATABASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
  if (!res.ok) throw new Error(`RTDB PUT ${path} failed: ${res.status}`);
};

// --- Sending ----------------------------------------------------------------

const buildPayload = ({ title, body, navigate = '/', tag, appBadge, appUrl = APP_URL }) => {
  const notification = { title, body, navigate: `${appUrl}${navigate}` };
  if (tag) notification.tag = tag;
  // Icon badge — declarative web push renders this on iOS without waking the
  // service worker; push-sw.js applies it elsewhere. Absent = unchanged.
  if (typeof appBadge === 'number') notification.app_badge = appBadge;
  return JSON.stringify({ web_push: 8030, notification });
};

/**
 * Send to every subscription under one member, in ONE app's set; prune dead
 * endpoints. `set` must match the origin the payload's navigate URL points
 * at — see the header comment.
 */
const sendToMember = async (memberKey, payload, set = MOVIE_HAT_SUBSCRIPTIONS) => {
  const subscriptions = await dbGet(`push/${memberKey}/${set}`);
  if (!subscriptions) return 0;
  let delivered = 0;
  await Promise.all(Object.entries(subscriptions).map(async ([id, sub]) => {
    if (!sub || !sub.endpoint || !sub.keys) return;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 24 * 3600, urgency: 'normal' }
      );
      delivered += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await dbDelete(`push/${memberKey}/${set}/${id}`).catch(() => {});
      } else {
        console.error(`Push to ${memberKey}/${id} failed:`, error.statusCode || error.message);
      }
    }
  }));
  return delivered;
};

// --- Download-finished sweep -----------------------------------------------

// A row imported longer ago than this is old news: it gets stamped, not
// announced. Guards the first deploy (rows imported before the sweep
// existed) and any long outage.
const IMPORT_NEWS_WINDOW_MS = 24 * 3600 * 1000;

/**
 * Tell each requester whose movie has finished downloading, once. Returns
 * counts for the log.
 */
const sweepFinishedRequests = async (now = Date.now()) => {
  const rows = (await dbGet('requests')) || {};
  const result = { rows: 0, announced: 0, stale: 0, unreachable: 0 };
  for (const [tmdbId, row] of Object.entries(rows)) {
    if (!row || typeof row.importedAt !== 'number' || row.notifiedAt) continue;
    result.rows += 1;

    if (now - row.importedAt > IMPORT_NEWS_WINDOW_MS) {
      await dbSet(`requests/${tmdbId}/notifiedAt`, now);
      result.stale += 1;
      continue;
    }

    const memberKey = emailToMemberKey(row.requestedBy);
    try {
      let delivered = 0;
      if (memberKey) {
        // Tell them in the app they ASKED FROM. A request made in Movie
        // Requests that announced itself through Movie Hat's subscriptions
        // would open the wrong app, and for anyone who only has Movie
        // Requests installed it would reach nobody at all.
        const fromRequestsApp = row.source === 'movie-requests';
        const set = fromRequestsApp ? REQUESTS_APP_SUBSCRIPTIONS : MOVIE_HAT_SUBSCRIPTIONS;
        const appUrl = fromRequestsApp ? REQUESTS_APP_URL : APP_URL;
        const badgePath = fromRequestsApp
          ? `push/${memberKey}/requestsAppBadge`
          : `push/${memberKey}/badge`;

        // Things that have happened since this person last opened that app.
        const unseen = (Number(await dbGet(badgePath)) || 0) + 1;
        const movieTitle = row.radarrTitle || row.title || 'Your movie';
        const payload = buildPayload({
          title: `${movieTitle} is ready to watch`,
          body: 'Your request finished downloading. Tap to see it.',
          tag: `imported-${tmdbId}`,
          appBadge: unseen,
          appUrl
        });
        delivered = await sendToMember(memberKey, payload, set);
        if (delivered > 0) await dbSet(badgePath, unseen);
      }
      // Stamped either way: no subscribed device means there is nobody to
      // tell, not something to retry every two minutes.
      await dbSet(`requests/${tmdbId}/notifiedAt`, now);
      if (delivered > 0) result.announced += 1;
      else result.unreachable += 1;
    } catch (error) {
      console.error(`Finished-download push for ${tmdbId} failed:`, error.message);
    }
  }
  return result;
};

// --- "Somebody wants in" sweep ----------------------------------------------

// A request older than this is not news any more: it gets stamped, not
// announced. Guards the first deploy (rows that predate this sweep) and any
// long outage — nobody wants nine notifications about people who asked last
// week.
const ACCESS_NEWS_WINDOW_MS = 7 * 24 * 3600 * 1000;

/** Every admin's member key, from the siteUsers roster. */
const siteAdmins = async () => {
  const rows = (await dbGet('siteUsers')) || {};
  return Object.values(rows)
    .filter((row) => row && row.isAdmin === true && row.email)
    .map((row) => emailToMemberKey(row.email))
    .filter(Boolean);
};

/**
 * Tell the admins about each person waiting to be let into Movie Requests,
 * once. The row is stamped `notifiedAt` either way — no subscribed device
 * means there is nobody to tell, not something to retry every two minutes.
 */
const sweepAccessRequests = async (now = Date.now()) => {
  const rows = (await dbGet('siteUsers')) || {};
  const result = { rows: 0, announced: 0, stale: 0, unreachable: 0 };

  const waiting = Object.entries(rows).filter(([, row]) =>
    row && row.status === 'pending' && !row.notifiedAt);
  if (!waiting.length) return result;

  const admins = await siteAdmins();

  for (const [uid, row] of waiting) {
    result.rows += 1;

    if (row.requestedAt && now - row.requestedAt > ACCESS_NEWS_WINDOW_MS) {
      await dbSet(`siteUsers/${uid}/notifiedAt`, now);
      result.stale += 1;
      continue;
    }

    try {
      const who = row.displayName || row.email;

      // MOVIE HAT FIRST (Matt, 2026-09-18: "it can all live in that single
      // app instead of having a second icon on my home screen"). The waiting
      // list is a screen in Movie Hat now, so an admin with Movie Hat
      // installed is told there and taps straight into /#/access.
      //
      // The standalone app's subscriptions are the fallback, for an admin
      // who only ever installed that one. Fallback rather than both: two
      // notifications about the same person, opening two different apps, is
      // worse than either on its own.
      const inMovieHat = buildPayload({
        title: `${who} wants movie requests`,
        body: 'Tap to let them in, or not.',
        navigate: '/#/access',
        tag: `access-${uid}`,
        appUrl: APP_URL
      });
      const inRequestsApp = buildPayload({
        title: `${who} wants movie requests`,
        body: 'Tap to let them in, or not.',
        navigate: '/#/admin',
        tag: `access-${uid}`,
        appUrl: REQUESTS_APP_URL
      });

      let delivered = 0;
      for (const memberKey of admins) {
        const toMovieHat = await sendToMember(memberKey, inMovieHat, MOVIE_HAT_SUBSCRIPTIONS);
        delivered += toMovieHat;
        if (toMovieHat === 0) {
          delivered += await sendToMember(memberKey, inRequestsApp, REQUESTS_APP_SUBSCRIPTIONS);
        }
      }

      await dbSet(`siteUsers/${uid}/notifiedAt`, now);
      if (delivered > 0) result.announced += 1;
      else result.unreachable += 1;
    } catch (error) {
      console.error(`Access-request push for ${uid} failed:`, error.message);
    }
  }
  return result;
};

// --- Handler ----------------------------------------------------------------

exports.handler = async (event) => {
  // The EventBridge schedule, not a browser: no token, no CORS, no body.
  if (event?.source === 'aws.events') {
    // Independent of each other: a failure in one must not silence the
    // other, so they are settled rather than awaited in sequence.
    const [imported, access] = await Promise.allSettled([
      sweepFinishedRequests(),
      sweepAccessRequests()
    ]);
    const result = {
      imported: imported.status === 'fulfilled' ? imported.value : { error: imported.reason?.message },
      access: access.status === 'fulfilled' ? access.value : { error: access.reason?.message }
    };
    if (imported.status === 'rejected') console.error('Finished-download sweep failed:', imported.reason);
    if (access.status === 'rejected') console.error('Access-request sweep failed:', access.reason);
    if (result.imported?.rows || result.access?.rows) console.log('Sweep:', JSON.stringify(result));
    return result;
  }

  activeOrigin = event.headers?.origin || event.headers?.Origin || ALLOWED_ORIGINS[0];
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || '';

  if (method === 'OPTIONS') return response(204, {});
  if (method !== 'POST') return response(405, { error: 'POST only' });

  const auth = await verifyIdToken(event.headers?.authorization || event.headers?.Authorization);
  if (!auth || !auth.email) return response(401, { error: 'Invalid or missing token' });

  const myKey = emailToMemberKey(auth.email);
  if (!myKey) return response(401, { error: 'Token has no email' });

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { error: 'Invalid JSON' });
  }

  try {
    if (path.endsWith('/push/test')) {
      // Whichever app asked is the one to answer in — the origin decides
      // both the subscription set and the URL the notification opens.
      const fromRequestsApp = activeOrigin === REQUESTS_APP_URL;
      const payload = buildPayload({
        title: fromRequestsApp ? 'Movie Requests can reach you here' : 'Movie Hat can reach you here',
        body: fromRequestsApp
          ? 'This is what a "your movie is ready" notification will look like.'
          : 'This is what a draw notification will look like.',
        tag: 'test',
        appUrl: fromRequestsApp ? REQUESTS_APP_URL : APP_URL
      });
      const delivered = await sendToMember(
        myKey,
        payload,
        fromRequestsApp ? REQUESTS_APP_SUBSCRIPTIONS : MOVIE_HAT_SUBSCRIPTIONS
      );
      return response(200, { delivered });
    }

    if (path.endsWith('/push/drawn')) {
      const { title, hatKey, movieTitle } = body;
      if (!title || !hatKey || typeof movieTitle !== 'string') {
        return response(400, { error: 'title, hatKey and movieTitle required' });
      }

      // Membership check: only someone IN the hat may announce a draw from
      // it. memberEmails is the same index the database rules gate on.
      const memberEmails = await dbGet(
        `hats/${encodeURIComponent(title)}/${encodeURIComponent(hatKey)}/memberEmails`
      );
      if (!memberEmails || !memberEmails[myKey]) {
        return response(403, { error: 'Not a member of that hat' });
      }

      // "mattgrosso drew Heat" — members are known by email; the local part
      // is the closest thing to a name the data has.
      const drawerName = auth.email.split('@')[0];

      const others = Object.keys(memberEmails).filter((key) => key !== myKey);
      let notified = 0;
      await Promise.all(others.map(async (memberKey) => {
        try {
          // Per-member icon badge: draws this member hasn't seen yet,
          // tracked at push/<memberKey>/badge. The app resets it to 0 on
          // open (utils/push.js clearBadge), so the count is "since you
          // last looked", which is what a badge means.
          const unseen = (Number(await dbGet(`push/${memberKey}/badge`)) || 0) + 1;
          const payload = buildPayload({
            title: `${drawerName} drew ${movieTitle}`,
            body: `From ${title}. Tap to see the pick.`,
            tag: `drawn-${hatKey}`,
            appBadge: unseen
          });
          const delivered = await sendToMember(memberKey, payload);
          if (delivered > 0) await dbSet(`push/${memberKey}/badge`, unseen);
          notified += delivered;
        } catch (error) {
          console.error(`Draw push to ${memberKey} failed:`, error.message);
        }
      }));
      return response(200, { notified });
    }

    return response(404, { error: 'Unknown route' });
  } catch (error) {
    console.error('movie-hat-push error:', error);
    return response(500, { error: 'Internal error' });
  }
};
