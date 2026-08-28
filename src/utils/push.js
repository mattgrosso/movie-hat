// Push notifications (2026-08-28, Matt: "get a notification when somebody
// draws a movie from a hat that you're in"). Ported from Cinema Roll's
// utils/push.js, adapted to this app's REST data layer.
//
// One notification source, event-driven only: a draw. The drawer's client
// announces to the movie-hat-push Lambda right after the draw saves
// (DrawMovie.vue), and the Lambda fans out to every OTHER member of that hat
// who has a device subscribed. No digests, no schedules — a hat with no
// draws is silent.
//
// Subscriptions live at `push/<memberKey>/subscriptions/<id>` (their owner's
// alone to read/write — see generate-hat-rules.mjs; the Lambda reads them
// with admin credentials). Opting in IS having a subscription: no separate
// prefs flag, and unsubscribing this device removes its row.
//
// iOS ground rules, learned on Cinema Roll: the Push API only exists inside
// a Home-Screen-installed app, and permission may only be requested from a
// real user tap.

import { getAuth } from 'firebase/auth';
import { dbGet, dbPut, dbDelete } from '../store/db.js';
import { emailToMemberKey } from '../store/memberKey.mjs';

export function pushApiConfigured () {
  return Boolean(process.env.VUE_APP_PUSH_API_URL && process.env.VUE_APP_VAPID_PUBLIC_KEY);
}

export function pushSupport () {
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return {
    supported,
    standalone,
    needsInstall: isIOS && !standalone,
    permission: ('Notification' in window) ? Notification.permission : 'unsupported'
  };
}

// djb2 over the endpoint — stable id per device, so re-subscribing updates
// in place instead of accumulating rows.
export function subscriptionId (endpoint) {
  let hash = 5381;
  for (let i = 0; i < endpoint.length; i++) {
    hash = ((hash << 5) + hash + endpoint.charCodeAt(i)) >>> 0;
  }
  return `sub-${hash.toString(36)}`;
}

function urlBase64ToUint8Array (base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function myMemberKey () {
  const email = getAuth().currentUser?.email;
  return emailToMemberKey(email);
}

function subscriptionRecord (subscription, now = Date.now()) {
  const json = subscription.toJSON();
  return {
    id: subscriptionId(json.endpoint),
    endpoint: json.endpoint,
    keys: json.keys,
    ua: navigator.userAgent,
    createdAt: now,
    lastSeenAt: now
  };
}

/** Is THIS device currently subscribed? (Async browser question.) */
export async function deviceSubscribed () {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    return Boolean(subscription) && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/** MUST be called from a user tap. Throws human-readable messages. */
export async function subscribeThisDevice () {
  const support = pushSupport();
  if (!support.supported) {
    throw new Error(support.needsInstall
      ? 'Add Movie Hat to your Home Screen first — iOS only allows notifications for installed apps.'
      : 'This browser does not support push notifications.');
  }
  const memberKey = myMemberKey();
  if (!memberKey) throw new Error('Sign in first.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for Movie Hat in this browser\'s settings.');
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error('No service worker registered — push only works on the deployed app.');
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.VUE_APP_VAPID_PUBLIC_KEY)
  });

  const record = subscriptionRecord(subscription);
  await dbPut(`push/${memberKey}/subscriptions/${record.id}`, record);
  return record;
}

export async function unsubscribeThisDevice () {
  const memberKey = myMemberKey();
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    const id = subscriptionId(subscription.endpoint);
    await subscription.unsubscribe().catch(() => {});
    if (memberKey) await dbDelete(`push/${memberKey}/subscriptions/${id}`);
  }
}

/**
 * Self-heal on app open: re-save this device's subscription if permission is
 * already granted (repairs rotated endpoints, refreshes lastSeenAt). Never
 * prompts; no-op for devices that never opted in.
 */
export async function refreshSubscriptionIfGranted () {
  try {
    const support = pushSupport();
    if (!support.supported || support.permission !== 'granted') return;
    const memberKey = myMemberKey();
    if (!memberKey) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    const record = subscriptionRecord(subscription);
    const existing = await dbGet(`push/${memberKey}/subscriptions/${record.id}`);
    if (existing?.createdAt) record.createdAt = existing.createdAt;
    await dbPut(`push/${memberKey}/subscriptions/${record.id}`, record);
  } catch {
    // Best-effort by design — the next app open tries again.
  }
}

async function postToPushApi (route, payload) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not signed in.');
  const idToken = await user.getIdToken();
  const response = await fetch(`${process.env.VUE_APP_PUSH_API_URL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Push API ${route} failed: ${response.status}`);
  return response.json();
}

/** The bell's long-press/test path — a notification to your own devices. */
export function sendTestNotification () {
  return postToPushApi('/push/test', {});
}

/**
 * Fire-and-forget announce after a draw saves (DrawMovie.vue). The Lambda
 * decides who hears about it (the hat's OTHER members with subscriptions);
 * this never throws — a failed announcement must not taint a saved draw.
 */
export async function announceDraw ({ title, hatKey, movieTitle }) {
  if (!pushApiConfigured()) return;
  try {
    await postToPushApi('/push/drawn', { title, hatKey, movieTitle });
  } catch (error) {
    console.warn('Draw push announcement failed (non-fatal):', error?.message);
  }
}
