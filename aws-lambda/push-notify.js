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
// Both routes are gated on a verified Firebase ID token from THIS app's
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
const APP_URL = 'https://www.movie-hat.com';

const ALLOWED_ORIGINS = [
  'https://www.movie-hat.com',
  'https://movie-hat.com',
  'http://localhost:8080'
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

const buildPayload = ({ title, body, navigate = '/', tag, appBadge }) => {
  const notification = { title, body, navigate: `${APP_URL}${navigate}` };
  if (tag) notification.tag = tag;
  // Icon badge — declarative web push renders this on iOS without waking the
  // service worker; push-sw.js applies it elsewhere. Absent = unchanged.
  if (typeof appBadge === 'number') notification.app_badge = appBadge;
  return JSON.stringify({ web_push: 8030, notification });
};

/** Send to every subscription under one member; prune dead endpoints. */
const sendToMember = async (memberKey, payload) => {
  const subscriptions = await dbGet(`push/${memberKey}/subscriptions`);
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
        await dbDelete(`push/${memberKey}/subscriptions/${id}`).catch(() => {});
      } else {
        console.error(`Push to ${memberKey}/${id} failed:`, error.statusCode || error.message);
      }
    }
  }));
  return delivered;
};

// --- Handler ----------------------------------------------------------------

exports.handler = async (event) => {
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
      const payload = buildPayload({
        title: 'Movie Hat can reach you here',
        body: 'This is what a draw notification will look like.',
        tag: 'test'
      });
      const delivered = await sendToMember(myKey, payload);
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
