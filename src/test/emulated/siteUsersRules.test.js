// Emulator-backed tests for `siteUsers` and what an approved row unlocks —
// the approval gate behind the standalone Movie Requests app
// (request.movie-hat.com, 2026-09-18).
//
// This node IS the permission. Anyone on the internet can sign into that app
// with Google, so the only thing between a stranger and Matt's disk is the
// rule that says a newcomer may write themselves a 'pending' row and may
// never change its status afterwards. That is worth a test that talks to
// real Firebase rather than a unit test that believes a mock.
//
// The shape mirrors the Around Table Round hub's siteUsers (see
// scripts/generate-hat-rules.mjs), so these cases read as the same gate.
//
// Run with: yarn test:emulated   (NOT yarn test:run — it needs the emulator)
import {
  describe, it, expect, beforeAll, afterAll, beforeEach,
} from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { ref, get, set, update } from 'firebase/database';
import { OWNER_EMAIL, REQUESTER_EMAILS } from '../../assets/javascript/owner.mjs';

const MATT = { uid: 'matt', email: OWNER_EMAIL };
// One of the hard-coded three, who could request before this node existed.
const SETH = { uid: 'seth', email: REQUESTER_EMAILS[1] };
// Somebody new, of the kind the standalone app is for.
const NEWCOMER = { uid: 'newcomer', email: 'someone.new@gmail.com' };
const OTHER = { uid: 'other', email: 'other.person@gmail.com' };

let testEnv;

const as = ({ uid, email }) => testEnv.authenticatedContext(uid, { email, email_verified: true }).database();

const row = (person, status, isAdmin = false) => ({
  email: person.email,
  displayName: person.uid,
  status,
  isAdmin,
  requestedAt: Date.now(),
});

/** Plant a row with the rules off — the state Matt's decisions start from. */
const seed = (person, status, isAdmin = false) => testEnv.withSecurityRulesDisabled(async (admin) => {
  await set(ref(admin.database(), `siteUsers/${person.uid}`), row(person, status, isAdmin));
});

const requestRow = (email, source = 'movie-requests') => ({
  tmdbId: 27205,
  title: 'Inception',
  status: 'pending',
  source,
  requestedBy: email,
  createdAt: Date.now(),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'movie-hat-9c418',
    database: {
      rules: readFileSync('database.rules.json', 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});

afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => { await testEnv.clearDatabase(); });

describe('siteUsers: asking to be let in', () => {
  it('lets a newcomer write themselves one pending row', async () => {
    await assertSucceeds(set(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), row(NEWCOMER, 'pending')));
  });

  it('refuses a newcomer who writes themselves in as approved', async () => {
    await assertFails(set(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), row(NEWCOMER, 'approved')));
  });

  it('refuses a newcomer who writes themselves in as an admin', async () => {
    await assertFails(set(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), row(NEWCOMER, 'pending', true)));
  });

  it('refuses a row that names an address other than the token\'s', async () => {
    await assertFails(set(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), row(OTHER, 'pending')));
  });

  it('refuses writing a row under somebody else\'s uid', async () => {
    await assertFails(set(ref(as(NEWCOMER), `siteUsers/${OTHER.uid}`), row(NEWCOMER, 'pending')));
  });

  it('refuses self-approval, and self-promotion, after the fact', async () => {
    await seed(NEWCOMER, 'pending');
    await assertFails(update(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), { status: 'approved' }));
    await assertFails(update(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), { isAdmin: true }));
    // Nor by deleting the row and starting over.
    await assertFails(set(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), null));
  });

  it('lets you keep your own details fresh, status untouched', async () => {
    await seed(NEWCOMER, 'pending');
    await assertSucceeds(update(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`), { displayName: 'A New Name' }));
  });

  it('lets you read your own row, and nobody else\'s', async () => {
    await seed(NEWCOMER, 'pending');
    await assertSucceeds(get(ref(as(NEWCOMER), `siteUsers/${NEWCOMER.uid}`)));
    await assertFails(get(ref(as(OTHER), `siteUsers/${NEWCOMER.uid}`)));
  });

  it('gives the waiting list to admins, and to Matt before he has a row', async () => {
    await assertSucceeds(get(ref(as(MATT), 'siteUsers')));
    await assertFails(get(ref(as(NEWCOMER), 'siteUsers')));
    // Being allowed to REQUEST is not being allowed to decide.
    await assertFails(get(ref(as(SETH), 'siteUsers')));

    await seed(OTHER, 'approved', true);
    await assertSucceeds(get(ref(as(OTHER), 'siteUsers')));
  });

  it('lets Matt bootstrap himself as an approved admin on first sign-in', async () => {
    await assertSucceeds(set(ref(as(MATT), `siteUsers/${MATT.uid}`), row(MATT, 'approved', true)));
  });

  it('refuses that same bootstrap to anybody else', async () => {
    await assertFails(set(ref(as(OTHER), `siteUsers/${OTHER.uid}`), row(OTHER, 'approved', true)));
  });

  it('lets an admin approve and deny', async () => {
    await seed(MATT, 'approved', true);
    await seed(NEWCOMER, 'pending');
    await assertSucceeds(update(ref(as(MATT), `siteUsers/${NEWCOMER.uid}`), { status: 'approved' }));
    await assertSucceeds(update(ref(as(MATT), `siteUsers/${NEWCOMER.uid}`), { status: 'denied' }));
  });
});

describe('siteUsers: what an approved row unlocks', () => {
  it('refuses a request from somebody with no row at all', async () => {
    await assertFails(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
  });

  it('refuses a request from somebody still pending', async () => {
    await seed(NEWCOMER, 'pending');
    await assertFails(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
  });

  it('refuses a request from somebody denied', async () => {
    await seed(NEWCOMER, 'denied');
    await assertFails(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
  });

  it('lets an approved person request, and read the node', async () => {
    await seed(NEWCOMER, 'approved');
    await assertSucceeds(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
    await assertSucceeds(get(ref(as(NEWCOMER), 'requests')));
  });

  it('still lets the hard-coded three through with no row', async () => {
    await assertSucceeds(set(ref(as(SETH), 'requests/27205'), requestRow(SETH.email, 'movie-hat')));
  });

  it('keeps the duplicate check: one row per TMDb id', async () => {
    await seed(NEWCOMER, 'approved');
    await seed(OTHER, 'approved');
    await assertSucceeds(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
    await assertFails(set(ref(as(OTHER), 'requests/27205'), requestRow(OTHER.email)));
  });

  it('refuses an approved person writing a request under another address', async () => {
    await seed(NEWCOMER, 'approved');
    await assertFails(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(OTHER.email)));
  });

  it('stops working the moment the row is revoked', async () => {
    await seed(NEWCOMER, 'approved');
    await assertSucceeds(set(ref(as(NEWCOMER), 'requests/27205'), requestRow(NEWCOMER.email)));
    await seed(NEWCOMER, 'denied');
    await assertFails(set(ref(as(NEWCOMER), 'requests/1234'), { ...requestRow(NEWCOMER.email), tmdbId: 1234 }));
  });
});
