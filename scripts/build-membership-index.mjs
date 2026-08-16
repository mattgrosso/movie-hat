// Builds the two indexes the locked-down rules need, from the membership
// that already exists.
//
//   yarn build-membership-index            # show exactly what would be written
//   yarn build-membership-index --apply
//
// Why (2026-08-16): membership is stored as `members/<pushKey>: "email"`, a
// map whose VALUES are the addresses. Firebase rules cannot search values, so
// "is my email in this hat's members?" — the entire basis of the lockdown —
// is unanswerable against the data as it stands.
//
// This writes, for every hat that has members:
//
//   hats/<title>/<key>/memberEmails/<memberKey>: true
//       The rules read this. Nothing else does.
//
//   userHats/<memberKey>/<safeTitle>: { title, hatKey }
//       "Which hats are mine", because the app currently answers that by
//       downloading every hat and filtering client-side — which is exactly
//       what stops working once you can't read hats you don't belong to.
//
// PURELY ADDITIVE. The existing `members` list is untouched and still what
// the UI renders. Running this twice is harmless.

import { execFileSync } from 'child_process';
import { emailToMemberKey, membersOf, memberIndexFor } from '../src/store/memberKey.mjs';

const DATABASE_URL = 'https://movie-hat-9c418-default-rtdb.firebaseio.com';
const apply = process.argv.includes('--apply');

/**
 * The complete set of writes, as a flat path→value map.
 * Exported so the shape can be tested without a database.
 */
export function buildIndexes (hats) {
  const updates = {};
  const summary = { hats: 0, members: 0, skipped: [] };

  Object.entries(hats || {}).forEach(([title, byKey]) => {
    Object.entries(byKey || {}).forEach(([hatKey, hat]) => {
      const emails = membersOf(hat);
      if (!emails.length) {
        // Nobody to grant access to. Left alone rather than guessed at — a
        // hat with content and no members needs a human to look at it.
        const content = Object.keys(hat?.movies || {}).length + Object.keys(hat?.history || {}).length;
        if (content) summary.skipped.push({ title, content });
        return;
      }

      const index = memberIndexFor(hat);
      updates[`hats/${title}/${hatKey}/memberEmails`] = index;
      summary.hats += 1;

      emails.forEach((email) => {
        const memberKey = emailToMemberKey(email);
        if (!memberKey) return;
        // A title can contain characters that are illegal in a key, so the
        // title rides in the value and the key is a safe form of it.
        const safeTitle = emailToMemberKey(title);
        updates[`userHats/${memberKey}/${safeTitle}`] = { title, hatKey };
        summary.members += 1;
      });
    });
  });

  return { updates, summary };
}

const response = await fetch(`${DATABASE_URL}/hats.json`);
if (!response.ok) {
  console.error(`database responded ${response.status}`);
  process.exit(1);
}

const hats = await response.json();
const { updates, summary } = buildIndexes(hats);
const memberEmailWrites = Object.keys(updates).filter((path) => path.endsWith('/memberEmails')).length;
const userHatWrites = Object.keys(updates).filter((path) => path.startsWith('userHats/')).length;

console.log(`${summary.hats} hats indexed, ${summary.members} memberships`);
console.log(`  ${memberEmailWrites} memberEmails maps`);
console.log(`  ${userHatWrites} userHats entries`);

if (summary.skipped.length) {
  console.log(`\n! ${summary.skipped.length} hat(s) have content but NO members — nobody would be able to read them:`);
  summary.skipped.forEach((hat) => console.log(`    ${JSON.stringify(hat.title)} (${hat.content} entries)`));
}

// A sample, so the shape is visible before it is written.
console.log('\nSample of what gets written:');
Object.entries(updates).slice(0, 4).forEach(([path, value]) => {
  console.log(`  ${path} = ${JSON.stringify(value)}`);
});

if (!apply) {
  console.log('\nNothing else is touched — the existing members list stays exactly as it is.');
  console.log('Dry run. Re-run with --apply to write it.');
  process.exit(0);
}

console.log('\nBacking up first…');
execFileSync('node', [new URL('./backup-hats.mjs', import.meta.url).pathname, '--quiet'], { stdio: 'inherit' });

// One atomic multi-path update: either the whole index lands or none of it.
const result = await fetch(`${DATABASE_URL}/.json`, {
  method: 'PATCH',
  body: JSON.stringify(updates)
});

if (!result.ok) {
  console.error(`\nFailed to write the index: ${result.status}`);
  process.exit(1);
}

console.log(`\n✔ wrote ${Object.keys(updates).length} paths.`);
process.exit(0);
