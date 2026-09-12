// Who owns this deployment. One constant, imported by the app AND by the
// rules generator, so the two can never disagree about who Matt is.
//
// Two things hang off it, with very different weight:
//
//   - The peek screen (peek.js). A convenience gate, not a security boundary
//     — see the comment there.
//   - "Request this movie" (utils/requestMovie.js). Here the email IS the
//     boundary: the database rules only let REQUESTER_EMAILS create a
//     request, because a request fills the disk on Matt's Mac mini. The
//     button is hidden from everyone else as a courtesy; the rules are what
//     stop them. Matt, plus whoever he has named (Seth, 2026-09-11).
//
// The .mjs extension is load-bearing: this package is not `type: module`, so
// a plain .js is CommonJS to Node and generate-hat-rules.mjs could not import
// it. Webpack reads .mjs happily, so the app is unaffected.
export const OWNER_EMAIL = 'mattgrosso@gmail.com';

// Who may ask the Mac mini for a download. Lowercase, exactly as Google
// reports the address; the rules generator lowercases the token's email
// before comparing, and so does mayRequest.
export const REQUESTER_EMAILS = [OWNER_EMAIL, 'hopper.seth@gmail.com'];

const normalize = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : null);

export function isOwner (email) {
  return normalize(email) === OWNER_EMAIL;
}

export function mayRequest (email) {
  const address = normalize(email);
  return address !== null && REQUESTER_EMAILS.includes(address);
}
