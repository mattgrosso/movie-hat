// Who owns this deployment. One constant, imported by the app AND by the
// rules generator, so the two can never disagree about who Matt is.
//
// Two things hang off it, with very different weight:
//
//   - The peek screen (peek.js). A convenience gate, not a security boundary
//     — see the comment there.
//   - "Request this movie" (utils/requestMovie.js). Here the email IS the
//     boundary: the database rules only let this address create a request,
//     because a request fills the disk on Matt's Mac mini. The button is
//     hidden from everyone else as a courtesy; the rules are what stop them.
//
// The .mjs extension is load-bearing: this package is not `type: module`, so
// a plain .js is CommonJS to Node and generate-hat-rules.mjs could not import
// it. Webpack reads .mjs happily, so the app is unaffected.
export const OWNER_EMAIL = 'mattgrosso@gmail.com';

export function isOwner (email) {
  return typeof email === 'string' && email.trim().toLowerCase() === OWNER_EMAIL;
}
