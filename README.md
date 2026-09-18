# movie-hat

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```
Vite's dev server, on the old Vue CLI port 8080 and bound to every
interface (so the phone on the LAN can reach it). It restarts itself when
`.env` changes.

### Compiles and minifies for production
```
yarn build
```
`yarn build` never bumps the version — it builds whatever `VUE_APP_VERSION`
`.env` holds, so check builds are free. `yarn deploy` runs
`scripts/bump-and-build.mjs`, which bumps first and rolls the bump back if
the build fails.

### Previews the production build
```
yarn preview
```

### Lints and fixes files
```
yarn lint
```

### Build configuration
Vite (`vite.config.mjs`), since 2026-09-14 — it replaced Vue CLI 5/webpack
(`vue.config.js`, `babel.config.js`). That file explains each choice, but the
three worth knowing:

- Every `process.env.VUE_APP_*` / `process.env.BASE_URL` read in `src/` is
  statically replaced via Vite's `define`, exactly as webpack's DefinePlugin
  did, so the house modules stay byte-identical to Cinema Roll's.
- The entry bundle is deliberately named `js/app.<hex hash>.js`, because
  `App.vue`'s update check matches that pattern off `index.html`.
- `vite-plugin-pwa` generates `service-worker.js` (that exact name — every
  installed phone checks it for updates) and pulls in `public/push-sw.js`
  via `importScripts`. `public/manifest.json` is a committed static file: it
  is what `@vue/cli-plugin-pwa` used to generate, byte-for-byte, and the
  `<head>` tags that plugin injected are now hand-written in `index.html`
  (at the repo root, not `public/`).

## Movie requests (Radarr on the Mac mini)

The drawn-movie screen has a **Request** button, shown only to the people
in `REQUESTER_EMAILS` (`src/assets/javascript/owner.mjs` — Matt, Seth and
Brian; the rules enforce the same list, so nobody else can create
a row even by hand). To add someone, add their address to that list, then
`yarn generate-hat-rules && firebase deploy --only database`. It writes
one row to this project's Realtime Database and a Node service on the Mac
mini (not in this repo) does the rest. Cinema Roll will write to the same node through
its Movie Hat sign-in, so the service only watches one place.

**Since 2026-09-18 that list is no longer the only way in.** The standalone
**Movie Requests** app (`~/code/movie-requests`, request.movie-hat.com) signs
into this project and writes to this same `requests` node, and the people it
lets in are named in the database rather than in `owner.mjs` — see
"Who else may request" below. Nothing about Movie Hat's own button changed;
`REQUESTER_EMAILS` still works exactly as it did, with no row needed.

### Both of that app's screens live here too

Matt's ask, the same day: "it can all live in that single app instead of
having a second icon on my home screen." So Movie Hat carries them:

| screen | route | who sees it |
| --- | --- | --- |
| **Request a movie** (`RequestAMovie.vue`) | `/request` | `mayRequestMovies` |
| **Who gets in** (`AccessRequests.vue`) | `/access` | `mayApproveAccess` |

Both are header pills, both lazy-loaded like `/peek`, and both are bounced by
a `router.beforeEach` guard in `main.js` if the URL is typed by somebody who
may not open them. The guard waits on `siteUserResolved` first — the
permission arrives asynchronously after sign-in, so without that wait a
refresh on `/request` bounces you home.

`/request` is **not** the drawn-movie Request button. That one sits beside a
movie already in a hat; this one searches all of TMDb, so a film nobody has
ever put in a hat can be asked for.

`store.getters.mayRequestMovies` and `mayApproveAccess` are the single source
for "who may do this" — the button, the pills, the screens and the guard all
ask them, so they cannot disagree.

**Movie Hat reads the `siteUsers` row; it does not create one.** In Movie
Requests, signing in IS asking to be let in. Here, signing in is just using
Movie Hat, and most people who do are family members in a hat who have never
heard of movie requests — writing each of them a pending row would fill the
waiting list with people who never asked for anything. The only exception is
Matt's own bootstrap row (`loadSiteUser`), which is how he becomes an admin
without opening the other app. `src/test/siteUserLoad.test.mjs` pins that.

The client side is `src/utils/requestMovie.js` (shared with Cinema Roll —
keep the two copies identical) and `src/components/RequestMovieButton.vue`.
The button polls the row over REST: every 2.5s for the first three minutes,
then every 30s for as long as the row is `pending`/`processing` — the
service holds a request while someone is watching Plex, which can be a whole
film. Polling pauses while the page is hidden and reads at once when it
comes back to the foreground.
The rules live in `scripts/generate-hat-rules.mjs` under `requests`.

### The row

```
requests/<tmdbId>: {
  tmdbId:      number   integer TMDb id, same as the key (the KEY is the id of record)
  title:       string
  status:      'pending' | 'processing' | 'added' | 'exists' | 'error'
  source:      'movie-hat' | 'cinema-roll'
  requestedBy: string   the signed-in email (rules check it matches the token)
  createdAt:   number   server timestamp, ms

  // Written by the service only:
  radarrId:    number
  radarrTitle: string
  year:        number
  processingAt: number  ms, when the service picked the row up
  processedAt: number   ms, when Radarr answered
  importedAt:  number   ms, when the downloaded file landed in the library
  error:       string   why it failed, shown to the user in the button's tooltip

  // Written by the push Lambda only:
  notifiedAt:      number   ms, when the requester was told the download finished
  ownerNotifiedAt: number   ms, when the admins were told the request exists
}
```

Only requesters' accounts can read or create rows. A row can only be created
with `status: 'pending'`, and only when no row exists for that id or the
existing one is `'error'` (that is the retry).

### Who else may request (`siteUsers`)

`requests` accepts a write from one of `REQUESTER_EMAILS` **or** from anyone
whose `siteUsers/<uid>` row says `status: 'approved'`. That node is the gate
behind the standalone Movie Requests app:

```
siteUsers/<uid>: {
  email:       string   the signed-in address (rules check it matches the token)
  displayName: string   optional, whatever Google reported
  photoURL:    string   optional
  status:      'pending' | 'approved' | 'denied'
  isAdmin:     boolean  may list the roster and decide
  requestedAt: number   server timestamp, ms
  decidedAt:   number   ms, when an admin answered
  notifiedAt:  number   ms, when the admins were told (push Lambda only)
}
```

A stranger may create their OWN row, once, as `pending` and not admin, and
may afterwards only edit fields that are not `status` or `isAdmin`. An admin
may write anything. Matt's first sign-in may write himself in approved and
admin — bootstrapping the first admin needs some door, and his
Google-verified address is the only thing available before any row exists.

The node name, fields and `isAdmin` flag are the Around Table Round games'
`siteUsers` (`camel-up/src/store/siteAccess.js`), reused deliberately; that
hub is a different Firebase project so the node itself is not shared.

`src/test/emulated/siteUsersRules.test.js` is where this is actually pinned —
twenty cases against a real emulator. Run them with `yarn test:emulated`.
The rules refuse everything else, which is what makes the key a duplicate
check. Clients cannot delete rows.

### What the service must do

1. Watch `requests` with the Admin SDK (a service account for
   `movie-hat-9c418`; it bypasses the rules) — `orderByChild('status').equalTo('pending')`
   with a `child_added` listener picks up new rows and, on restart, any it
   missed.
2. Set `status: 'processing'` first, so two service instances don't both act.
3. Look the movie up in Radarr by TMDb id. If it's already there, set
   `status: 'exists'`; otherwise add it (monitored, search on add) and set
   `status: 'added'`. Either way write `radarrId`, `radarrTitle`, `year`,
   `processedAt`.
4. On any failure set `status: 'error'` and a short human `error`. The
   button offers a retry, which overwrites the row with a fresh `'pending'`.
5. `requestedBy` is always one of `REQUESTER_EMAILS`; the rules see to it.
6. When the file is imported, set `importedAt`. That is what the
   finished-download notification keys on.

### "Somebody asked for a movie" notifications

2026-09-18, Matt: "I just want to be notified that somebody made a request
and that the system is acting on it." The same sweep announces each new
`requests` row to every admin once, then stamps `ownerNotifiedAt`.

Purely informational — there is nothing to approve, so the notification
carries no action and simply opens `/#/request`, which is why that screen
shows an admin **everyone's** requests rather than only their own.

Two things keep it from being noise. An admin is never told about their own
request (Matt pressing the button and then being notified that Matt pressed
the button is how people learn to turn notifications off). And a row created
more than `REQUEST_NEWS_WINDOW_MS` ago is stamped without announcing, which
is what stopped the first run telling him about every request ever made — it
announced one, stamped eleven, skipped one.

The body is written from the row's status at sweep time, not at creation, so
it says what the Mac mini has actually done: waiting for Plex to be free,
Radarr picking it up, downloading, already in the library, or the error.

### "Your movie is ready" notifications

`aws-lambda/push-notify.js` also runs on an EventBridge schedule
(`movie-hat-push-sweep`, every two minutes). Each sweep does two things; the
second, "somebody wants into Movie Requests", is described in that repo's
README. The first reads `requests`,
and any row with an `importedAt` and no `notifiedAt` gets one push to
whoever `requestedBy` names ("Little Miss Sunshine is ready to watch"), then
a `notifiedAt` stamp. A row imported more than a day ago is stamped without
a notification, so a redeploy or an outage never announces a backlog.

The notification goes to the subscriptions of the app the row's `source`
names — `push/<memberKey>/subscriptions` for Movie Hat, and
`push/<memberKey>/requestsAppSubscriptions` for Movie Requests. The
"somebody wants in" notification is the other way round: it tries **Movie
Hat first** and only falls back to the standalone app's subscriptions,
because the waiting list is a screen here now and an admin should need only
the one app installed. Sending to
the wrong set is not a delivery failure; it delivers, to the wrong app, and
on iOS a notification whose URL is outside the installed app's scope opens in
an in-app browser rather than the app.

Deploy rules with `yarn generate-hat-rules && firebase deploy --only database`.

### One canonical origin (`infra/canonical-host.js`)

CloudFront distribution `EBSAAKUEVN304` answers for both `movie-hat.com` and
`www.movie-hat.com`. Until 2026-09-17 it served the app on both with no
redirect, and two origins mean two PWA scopes: installing from each gave a
separate Home Screen icon (iOS names the second one "Movie Hat 2", which is
the "hat" one bug report saw in a notification header), each with its own
storage and its own push subscription. It also broke notification taps —
`APP_URL` pointed at `www`, so a tap landed outside the installed app's scope
and iOS opened it in an in-app browser instead of the app.

**`movie-hat.com` is canonical.** It is where the app is installed from and
what the invite email in `HatsList.vue` points at. A CloudFront Function
(`movie-hat-canonical-host`, runtime `cloudfront-js-2.0`) runs on
viewer-request and 301s any `www` request to the bare domain, path and query
preserved; every other host passes through untouched.

Redeploy the function after editing:

```
aws cloudfront describe-function --name movie-hat-canonical-host --profile personal   # for the ETag
aws cloudfront update-function --name movie-hat-canonical-host --if-match <etag> \
  --function-config Comment="Redirect www.movie-hat.com to the canonical bare domain",Runtime=cloudfront-js-2.0 \
  --function-code fileb://infra/canonical-host.js --profile personal
aws cloudfront publish-function --name movie-hat-canonical-host --if-match <new etag> --profile personal
```

`aws cloudfront test-function` takes a viewer-request event object and is
worth running before publishing — the function sits in front of every request
to the site.
