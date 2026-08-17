// Mints a sign-in token for an automated-testing account, and gives it
// membership of the Dev Hat.
//
//   yarn mint-hat-token              # ensure the account + Dev Hat access, print a token
//   yarn mint-hat-token --revoke     # take its Dev Hat membership away again
//
// Why (Matt, 2026-08-17): "there's a dev hat you could use for testing. If
// you can figure out how." Since the lockdown, verifying anything that
// touches a hat needs a real signed-in member, and a Google popup is not
// something an automated browser can complete. The Admin SDK can mint a
// custom token for an account it creates, which the browser exchanges for a
// real session — the same trick Cinema Roll's mint-test-token uses.
//
// The account is a real Firebase Auth user in movie-hat-9c418 with an email,
// because the database rules key access off `auth.token.email`. A custom
// token alone has no email claim; one minted for a USER carries the email
// from that user's record.
//
// It is given membership of the DEV HAT only. It cannot read or write any
// other hat — the rules see to that, which is itself worth demonstrating.

import { getAuth } from 'firebase-admin/auth';
import { hatDatabase, adminGet, adminSet, adminRemove } from './hatDatabase.mjs';
import { emailToMemberKey } from '../src/store/memberKey.mjs';

const TESTER_EMAIL = 'movie-hat-tester@example.com';
const TESTER_UID = 'movie-hat-tester';
const HAT_TITLE = 'Dev Hat';

const revoke = process.argv.includes('--revoke');

hatDatabase(); // initializes the admin app (and explains itself if the key is missing)
const auth = getAuth();
const memberKey = emailToMemberKey(TESTER_EMAIL);
const safeTitle = emailToMemberKey(HAT_TITLE);

// The hat record to grant against.
const hats = await adminGet(`hats/${HAT_TITLE}`);
if (!hats) {
  console.error(`No hat called "${HAT_TITLE}".`);
  process.exit(1);
}
const hatKey = Object.keys(hats)[0];
const hat = hats[hatKey];

if (revoke) {
  await adminRemove(`hats/${HAT_TITLE}/${hatKey}/memberEmails/${memberKey}`);
  await adminRemove(`userHats/${memberKey}`);
  console.log(`Removed the tester from "${HAT_TITLE}".`);
  process.exit(0);
}

// A real user, so the ID token carries an email for the rules to read.
try {
  await auth.getUser(TESTER_UID);
} catch {
  await auth.createUser({ uid: TESTER_UID, email: TESTER_EMAIL, displayName: 'Movie Hat Tester' });
  console.log(`Created the tester account (${TESTER_EMAIL}).`);
}

// Membership of the Dev Hat, in both indexes, exactly as the app would.
const members = Array.isArray(hat.members) ? hat.members : Object.values(hat.members || {});
if (!members.includes(TESTER_EMAIL)) {
  await adminSet(`hats/${HAT_TITLE}/${hatKey}/members`, [...members, TESTER_EMAIL]);
}
await adminSet(`hats/${HAT_TITLE}/${hatKey}/memberEmails/${memberKey}`, true);
await adminSet(`userHats/${memberKey}/${safeTitle}`, { title: HAT_TITLE, hatKey });

const token = await auth.createCustomToken(TESTER_UID);

console.log(`\nTester: ${TESTER_EMAIL}`);
console.log(`Member of: "${HAT_TITLE}" (${Object.keys(hat.movies || {}).length} waiting)`);
console.log('\nCustom token (exchange with signInWithCustomToken, ~1h):\n');
console.log(token);
process.exit(0);
