import { dbGet, dbPatch } from '../store/db.js';
import { emailToMemberKey } from '../store/memberKey.mjs';

// The reply half of the bug button (2026-09-21, ported from Cinema Roll):
// `yarn resolve-bug-report <id> --understood ... --fixed ...` writes a
// plain-language notice under the reporter's member key at
// bugReportResolutions, and BugResolutionNotice.vue shows it once on their
// next launch. Keyed by email like everything else here, so a report filed
// signed-out (reporterEmail null) has nobody to reply to. The node is shared
// with Movie Requests, so each notice names its `app`. Rules: only the
// reporter can read their own; the only client write is flipping `seen`.

const NODE = 'bugReportResolutions';
const APP = 'movie-hat';

/** This app's unseen notices, oldest first. */
export function unseenResolutions (entries, app = APP) {
  return Object.entries(entries || {})
    .filter(([, value]) => value && !value.seen && (!value.app || value.app === app))
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.resolvedAt || 0) - (b.resolvedAt || 0));
}

export async function fetchUnseenResolutions (email) {
  const memberKey = emailToMemberKey(email);
  if (!memberKey) return [];
  try {
    return unseenResolutions(await dbGet(`${NODE}/${memberKey}`));
  } catch {
    // Offline or refused - the notice simply waits for another launch.
    return [];
  }
}

export async function markResolutionsSeen (email, ids) {
  const memberKey = emailToMemberKey(email);
  if (!memberKey || !ids?.length) return;
  const updates = {};
  ids.forEach((id) => { updates[`${memberKey}/${id}/seen`] = true; });
  try {
    await dbPatch(NODE, updates);
  } catch {
    // Marked on a later dismissal instead.
  }
}
