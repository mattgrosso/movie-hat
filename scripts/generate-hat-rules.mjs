// Generates database.rules.json.
//
//   yarn generate-hat-rules
//
// NEVER hand-edit database.rules.json — edit this and re-run it.
//
// The rules have to turn `auth.token.email` into the same key
// `emailToMemberKey` produces, and the rules language has no regex: only
// String.replace, which replaces every occurrence. So the transform is a
// chain of replaces generated from the SAME character list the app uses,
// which is the only way the two can't drift apart. (Cinema Roll's
// generate-database-rules.mjs exists for exactly this reason.)
//
// What the rules say, in English:
//
//   - Nothing is readable or writable by default.
//   - A hat is readable only by someone listed in its `memberEmails` index.
//   - A hat is writable by a member, or by anyone CREATING one who puts
//     themselves in that index — otherwise you could make a hat you can't
//     then read.
//   - `userHats/<you>` is readable only by you. It is writable by any signed-in
//     user, because adding somebody to a hat means writing THEIR index. That
//     is the same power the invite flow has always had.
//
// Deploying: `firebase deploy --only database` against project
// movie-hat-9c418, or paste into the console's Rules tab. Supervised, with
// `yarn restore-hats` in reach — a bad rules deploy shows every user an empty
// app.

import { writeFileSync } from 'fs';
import { UNSAFE_KEY_CHARACTERS, KEY_REPLACEMENT_CHARACTER } from '../src/store/memberKey.mjs';

// auth.token.email → the member key, in the rules language.
const memberKeyExpression = UNSAFE_KEY_CHARACTERS.reduce(
  (expression, character) => `${expression}.replace('${character}', '${KEY_REPLACEMENT_CHARACTER}')`,
  "auth.token.email.toLowerCase()"
);

const signedIn = "auth != null && auth.token.email != null";
const isMember = `data.child('memberEmails').child(${memberKeyExpression}).exists()`;
const becomesMember = `newData.child('memberEmails').child(${memberKeyExpression}).exists()`;

const rules = {
  rules: {
    // Default deny. Everything below opens exactly one door.
    '.read': false,
    '.write': false,

    hats: {
      $title: {
        $hatKey: {
          '.read': `${signedIn} && ${isMember}`,
          // A member may write. So may someone creating a hat that doesn't
          // exist yet, provided they put themselves in the index — without
          // that clause you could create a hat you were unable to read.
          '.write': `${signedIn} && (${isMember} || (!data.exists() && ${becomesMember}))`,
          // A hat may never end up with nobody able to read it.
          '.validate': "!newData.exists() || newData.hasChild('memberEmails')"
        }
      }
    },

    // "Which hats are mine." Yours is yours to read; anyone signed in may add
    // to someone else's, because that is what adding a member to a hat does.
    userHats: {
      $memberKey: {
        '.read': `${signedIn} && $memberKey === ${memberKeyExpression}`,
        '.write': signedIn
      }
    }
  }
};

const path = new URL('../database.rules.json', import.meta.url).pathname;
writeFileSync(path, `${JSON.stringify(rules, null, 2)}\n`);

console.log(`Wrote ${path}`);
console.log('\nThe member-key transform the rules will apply:');
console.log(`  ${memberKeyExpression}`);
console.log('\nDeploy with:  firebase deploy --only database   (project movie-hat-9c418)');
console.log('Do it supervised — a bad rules deploy shows every user an empty app.');
