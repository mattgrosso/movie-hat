// Turning an email address into a database key.
//
// Membership is currently stored as `members/<pushKey>: "someone@example.com"`
// — a map whose VALUES are the emails. Firebase's rules language cannot
// search values, so "is my email in this hat's member list?" is unanswerable
// as the data stands, and no rule can be written against it.
//
// So membership also gets indexed BY the address:
//
//   hats/<title>/<key>/memberEmails/<memberKey>: true   → the rules read this
//   userHats/<memberKey>/<title>: <hatKey>              → "which hats are mine"
//
// The second one exists because the app finds your hats by downloading every
// hat and filtering client-side, which stops being possible the moment you
// can't read hats you don't belong to.
//
// The rules perform this SAME transformation on auth.token.email, generated
// from this file's character list by scripts/generate-hat-rules.mjs precisely
// so the two cannot drift apart. If you change the list, re-run it.
//
// The .mjs extension is load-bearing: this package is not `type: module`, so
// a plain .js here is CommonJS to Node and the backfill script cannot import
// it. Webpack reads .mjs happily, so the app is unaffected.

// Firebase forbids exactly these in a key. '@' is legal and kept, which makes
// the keys readable in the console.
export const UNSAFE_KEY_CHARACTERS = ['.', '$', '#', '[', ']', '/'];
export const KEY_REPLACEMENT_CHARACTER = '-';

/**
 * `Someone@Example.com` → `someone@example-com`.
 *
 * Lowercased, unlike Cinema Roll's equivalent: Movie Hat has never keyed
 * anything by email before, so there is no existing data to re-key, and
 * folding case here means a member added as "Matt@..." matches a token
 * carrying "matt@...".
 */
export function emailToMemberKey (email) {
  if (typeof email !== 'string' || !email) return null;

  return UNSAFE_KEY_CHARACTERS.reduce(
    (key, character) => key.split(character).join(KEY_REPLACEMENT_CHARACTER),
    email.trim().toLowerCase()
  );
}

/** Every member email on a hat, from either the list or the index. */
export function membersOf (hat) {
  const listed = Object.values(hat?.members || {}).filter((value) => typeof value === 'string');
  if (listed.length) return listed;

  // A hat created after the index landed may only have the index.
  return Object.keys(hat?.memberEmails || {});
}

/** The `memberEmails` map a hat should carry, derived from its member list. */
export function memberIndexFor (hat) {
  const index = {};
  membersOf(hat).forEach((email) => {
    const key = emailToMemberKey(email);
    if (key) index[key] = true;
  });
  return index;
}
