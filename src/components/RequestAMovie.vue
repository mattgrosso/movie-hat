<template>
  <div class="request-a-movie">
    <h2 class="request-a-movie__title">Movie requests</h2>
    <p class="request-a-movie__blurb">
      Search for anything and ask the Mac mini to add it to Plex. Nothing here
      touches a hat.
    </p>

    <!-- Where the "ready to watch" notification lands (?ready=<tmdbId>). It
         can't open Plex itself, so this is the one tap between it and Plex.
         See READY_PARAM in utils/requestMovie.js. It goes once dealt with,
         or an hour on (readyCardFresh). -->
    <section v-if="readyRow" class="request-a-movie__ready">
      <button type="button" class="request-a-movie__ready-close" aria-label="Close" @click="dismissReady">✕</button>
      <p class="request-a-movie__ready-title">
        {{ readyHeadline(readyRow) }}
      </p>
      <a :href="plexHref" class="btn btn-lg request-a-movie__plex" @click="leaveForPlex">▶ Watch in Plex</a>
      <p class="request-a-movie__ready-hint">Opens Plex. It's under Recently Added.</p>
    </section>

    <form class="request-a-movie__form" @submit.prevent="runSearch">
      <div class="input-group">
        <input
          v-model="query"
          class="form-control"
          type="search"
          placeholder="search for title"
          aria-label="Search for a movie to request"
          autocomplete="off"
          enterkeyhint="search"
        >
        <button class="btn btn-success" type="submit" :disabled="!query.trim() || searching">
          <span v-if="searching" class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Searching…</span>
          </span>
          <span v-else>Search</span>
        </button>
      </div>
    </form>

    <!-- "You won't hear about this" — shown only when something of theirs is
         actually downloading AND this device has no push subscription. That
         combination is the whole failure mode: the request works, the movie
         arrives, and nobody is ever told. Points at the header bell rather
         than adding a second control that does the same thing. -->
    <p v-if="awaiting.length && !pushOn" class="request-a-movie__nudge">
      <span aria-hidden="true">🔔</span>
      {{ awaiting.length === 1 ? 'Your movie is' : `${awaiting.length} of your movies are` }}
      still downloading, and notifications are off on this device — tap the
      bell at the top to be told when {{ awaiting.length === 1 ? 'it lands' : 'they land' }}.
    </p>

    <p v-if="error" class="request-a-movie__error">{{ error }}</p>

    <!-- The results replace the list, so this is the way back to it. -->
    <button v-if="searched" type="button" class="request-a-movie__back" @click="clearSearch">
      ‹ Back to requests
    </button>

    <ul v-if="results.length" class="movie-results">
      <li v-for="movie in results" :key="movie.id" class="movie-results__item">
        <img v-if="movie.poster" :src="movie.poster" alt="" class="movie-results__poster" loading="lazy">
        <div v-else class="movie-results__poster movie-results__poster--none" aria-hidden="true">🎬</div>
        <div class="movie-results__body">
          <h3 class="movie-results__name">
            {{ movie.title }}
            <span v-if="movie.year" class="movie-results__year">{{ movie.year }}</span>
          </h3>
          <p v-if="movie.overview" class="movie-results__overview">{{ movie.overview }}</p>
          <RequestMovieButton :movie="movie" :initial-row="rowFor(movie.id)" short/>
        </div>
      </li>
    </ul>

    <p v-else-if="searched && !searching" class="request-a-movie__empty">
      Nothing came back for &ldquo;{{ lastQuery }}&rdquo;. Try the original title, or add the year.
    </p>

    <section v-else-if="queue.length" class="request-a-movie__mine">
      <h3 class="request-a-movie__mine-title">
        {{ isAdmin ? 'Recent requests' : 'What you\u2019ve asked for' }}
      </h3>
      <ul class="request-a-movie__mine-list">
        <li v-for="row in queue" :key="row.tmdbId" class="request-a-movie__mine-row">
          <span class="request-a-movie__mine-name">
            {{ row.title }}
            <!-- Only on somebody else's row, and only for an admin — on your
                 own list every line would say "you". -->
            <span v-if="row.requestedBy !== email" class="request-a-movie__mine-who">
              {{ askerName(row) }}
            </span>
          </span>
          <span class="request-a-movie__mine-state" :class="`is-${row.status}`">{{ shortLabel(row) }}</span>
          <span v-if="progressFor(row)" class="request-a-movie__mine-bar" :class="{ 'is-held': progressFor(row).heldBy }" aria-hidden="true">
            <span :style="{ width: `${progressFor(row).percent}%` }"/>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
// "Request a movie" as a screen of its own, 2026-09-18 — Matt's ask was to
// have the standalone Movie Requests app's features in Movie Hat so his
// phone carries one icon instead of two. This is that app's search screen,
// here.
//
// It is NOT the drawn-movie Request button (RequestMovieButton, which sits
// beside a movie that is already in a hat). This one searches all of TMDb,
// so a film nobody has ever put in a hat can be asked for.
//
// Reachable only for whoever `mayRequestMovies` says — the header pill is
// hidden otherwise and App.vue's router guard bounces a typed URL. The
// database rules are what actually enforce it.
//
// The whole `requests` node is read in one go rather than per card: it spares
// twenty result cards twenty reads each, and it is what lets a result say
// "Already in the library" or "Requested by Seth" before anything is pressed.
// It is then re-read on a timer for as long as the screen is in front of
// somebody — see `requestsPollDelay`. It used to be read exactly once, which
// made the list under the search box a photograph of the moment you arrived.
import { searchMovies } from '../utils/tmdb.js';
import { dbGet } from '../store/db.js';
import {
  requestLabel,
  downloadProgress,
  isSettled,
  requestsPollDelay,
  listenForForeground,
  pageIsVisible,
  POLL_FAST_WINDOW_MS,
  READY_PARAM,
  REQUESTS_HOME_EVENT,
  readyRequest,
  readyHeadline,
  readyCardFresh,
  dismissReadyCard,
  plexUrl
} from '../utils/requestMovie.js';
import { deviceSubscribed } from '../utils/push.js';
import RequestMovieButton from './RequestMovieButton.vue';

export default {
  name: 'RequestAMovie',
  components: { RequestMovieButton },
  data () {
    return {
      query: '',
      lastQuery: '',
      results: [],
      searching: false,
      searched: false,
      error: null,
      rows: {},
      // Whether THIS device would actually receive the "ready to watch"
      // push. Asked of the browser, not the database — a subscription on his
      // phone says nothing about the laptop he is looking at now.
      pushOn: true,
      plexHref: plexUrl(),
      // The ready card was dealt with, or has been up long enough.
      readyHidden: false,
      // Polling bookkeeping. Not reactive state anyone renders; kept here so
      // the component owns its own teardown.
      pollTimer: null,
      fastUntil: 0,
      stopListeningForForeground: null
    };
  },
  computed: {
    email () {
      return this.$store.state.email;
    },
    isAdmin () {
      return this.$store.getters.mayApproveAccess;
    },
    // The movie a "ready to watch" notification opened this screen for.
    readyRow () {
      if (this.readyHidden) return null;
      return readyRequest(this.rows, this.$route.query[READY_PARAM]);
    },
    /**
     * What the list under the search box shows. An admin sees EVERYBODY's
     * requests, which is what makes the "Andy requested Tony" notification
     * worth tapping — it opens this screen, and the request had better be on
     * it. Everyone else sees only their own; the rules let them read the
     * whole node, but another person's viewing habits are not their business.
     */
    queue () {
      const rows = this.isAdmin ? Object.values(this.rows || {}) : this.mine;
      return [...rows].sort((a, b) => {
        // Unfinished first — that is what anyone opening this wants to see.
        const done = (row) => (isSettled(row) ? 1 : 0);
        return done(a) - done(b) || (b.createdAt || 0) - (a.createdAt || 0);
      });
    },
    // Their own requests that have not landed yet — the ones a notification
    // would be about.
    awaiting () {
      return this.mine.filter((row) => !isSettled(row));
    },
    // Your own requests, unfinished first — what you came back to check on.
    mine () {
      const email = this.$store.state.email;
      return Object.values(this.rows || {})
        .filter((row) => row?.requestedBy && row.requestedBy === email)
        .sort((a, b) => {
          const done = (row) => (isSettled(row) ? 1 : 0);
          return done(a) - done(b) || (b.createdAt || 0) - (a.createdAt || 0);
        });
    }
  },
  methods: {
    readyHeadline,
    rowFor (tmdbId) {
      return this.rows?.[tmdbId] ?? null;
    },
    shortLabel (row) {
      return requestLabel(row, { short: true });
    },
    // The label already carries the percent; this is just the bar under it.
    progressFor (row) {
      return downloadProgress(row);
    },
    /** The local part of the address — the closest thing the data has to a name. */
    askerName (row) {
      return String(row.requestedBy || '').split('@')[0];
    },
    async loadRows () {
      try {
        this.rows = (await dbGet('requests')) || {};
      } catch (error) {
        // Not fatal: every button still reads its own row when it mounts.
        console.warn('Could not read the requests node', error);
      }
    },
    /**
     * Read again, later. One timer, always exactly one — re-armed after each
     * read so the interval is recomputed against what the node now says
     * rather than against what it said when the screen opened.
     */
    schedulePoll () {
      clearTimeout(this.pollTimer);
      const delay = requestsPollDelay(this.rows, { fastUntil: this.fastUntil });
      this.pollTimer = setTimeout(async () => {
        this.pollTimer = null;
        // A hidden tab reads nothing; returning to the foreground does the
        // read instead, so nothing is missed and a backgrounded PWA costs
        // nothing.
        if (pageIsVisible()) await this.loadRows();
        this.schedulePoll();
      }, delay);
    },
    /** Hide the ready card for good if its time is up. */
    checkReady () {
      const ready = this.$route.query[READY_PARAM];
      if (ready && !this.readyHidden && !readyCardFresh(ready)) this.dismissReady();
    },
    /**
     * Done with the ready card: remembered on this device, and the link
     * dropped from the address so reopening the app doesn't bring it back.
     */
    dismissReady () {
      const ready = this.$route.query[READY_PARAM];
      if (!ready) return;
      this.readyHidden = true;
      dismissReadyCard(ready);
      const query = { ...this.$route.query };
      delete query[READY_PARAM];
      this.$router?.replace({ query });
    },
    // After the tap has opened Plex, so the link isn't pulled out from under it.
    leaveForPlex () {
      setTimeout(() => this.dismissReady(), 0);
    },
    /** Back in front of someone: read now, and be quick again for a bit. */
    onForeground () {
      this.checkReady();
      this.fastUntil = Date.now() + POLL_FAST_WINDOW_MS;
      this.loadRows();
      this.schedulePoll();
    },
    /**
     * Drop the search and show the list again, freshly read so whatever was
     * just requested is on it.
     */
    clearSearch () {
      this.query = '';
      this.lastQuery = '';
      this.results = [];
      this.searched = false;
      this.error = null;
      this.dismissReady();
      this.loadRows();
    },
    async runSearch () {
      const term = this.query.trim();
      if (!term || this.searching) return;
      this.searching = true;
      this.error = null;
      this.lastQuery = term;
      this.dismissReady();
      // Blur so the phone keyboard drops and the results are actually
      // visible.
      document.activeElement?.blur?.();
      try {
        this.results = await searchMovies(term);
        this.searched = true;
        // Refreshed alongside the results, so a movie somebody else asked
        // for five minutes ago already says so.
        this.loadRows();
      } catch (error) {
        this.error = error.message;
        this.results = [];
      } finally {
        this.searching = false;
      }
    }
  },
  watch: {
    // Emptying the box (iPhone's little x included) is asking for the list.
    query (value) {
      if (!value.trim() && this.searched && !this.searching) this.clearSearch();
    },
    // A tap on the notification while the app is already open steers this
    // screen rather than remounting it, and the rows may predate the import.
    // A new link gets its own chance at the card.
    '$route.query.ready' (ready) {
      if (!ready) return;
      this.readyHidden = !readyCardFresh(ready);
      this.loadRows();
    }
  },
  async mounted () {
    this.fastUntil = Date.now() + POLL_FAST_WINDOW_MS;
    this.checkReady();
    this.loadRows();
    this.schedulePoll();
    this.stopListeningForForeground = listenForForeground(this.onForeground);
    window.addEventListener(REQUESTS_HOME_EVENT, this.clearSearch);
    // Optimistic default while this resolves, so the nudge cannot flash at
    // somebody who has notifications on.
    this.pushOn = await deviceSubscribed();
  },
  beforeUnmount () {
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.stopListeningForForeground?.();
    this.stopListeningForForeground = null;
    window.removeEventListener(REQUESTS_HOME_EVENT, this.clearSearch);
  }
};
</script>

<style lang="scss">
.request-a-movie {
  margin: 0 auto;
  max-width: 640px;
  padding: 1rem 1rem 4rem;

  &__title {
    color: white;
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  &__blurb {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    margin-bottom: 1rem;
  }

  &__ready {
    background: rgba(0, 0, 0, 0.25);
    border-radius: 10px;
    margin-bottom: 1rem;
    padding: 1rem;
    position: relative;
    text-align: center;
  }

  &__ready-close {
    background: none;
    border: 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 1rem;
    line-height: 1;
    padding: 0.5rem;
    position: absolute;
    right: 0.25rem;
    top: 0.25rem;
  }

  &__ready-title {
    color: white;
    font-size: 1.05rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  // Plex's own orange, so it reads as "this goes to Plex".
  &__plex {
    background: #e5a00d;
    border: none;
    color: #1f1f1f;
    font-weight: 700;
    width: 100%;

    &:hover,
    &:active { background: #cc8e0b; color: #1f1f1f; }
  }

  &__ready-hint {
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.75rem;
    margin: 0.5rem 0 0;
  }

  &__error {
    color: #ffe08a;
    font-size: 0.85rem;
    margin-top: 0.75rem;
  }

  &__back {
    background: none;
    border: none;
    color: white;
    font-size: 0.85rem;
    margin-top: 0.75rem;
    padding: 0.25rem 0;
    text-decoration: underline;
  }

  &__nudge {
    background: rgba(0, 0, 0, 0.22);
    border-radius: 8px;
    color: white;
    font-size: 0.78rem;
    line-height: 1.5;
    margin: 0.85rem 0 0;
    padding: 0.7rem 0.85rem;
  }

  &__empty {
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.9rem;
    margin-top: 1.5rem;
    text-align: center;
  }

  &__mine {
    margin-top: 2rem;
  }

  &__mine-title {
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }

  &__mine-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  &__mine-row {
    align-items: baseline;
    border-top: 1px solid rgba(255, 255, 255, 0.25);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.6rem 0;
  }

  // Full width under the name and state; wraps onto its own line.
  &__mine-bar {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    display: block;
    flex-basis: 100%;
    height: 4px;
    margin-top: -0.35rem;
    overflow: hidden;

    span {
      background: #8fd19e;
      display: block;
      height: 100%;
    }

    &.is-held span { background: rgba(255, 255, 255, 0.5); }
  }

  &__mine-name {
    color: white;
    font-size: 0.9rem;
  }

  &__mine-who {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    margin-left: 0.4rem;
  }

  &__mine-state {
    color: rgba(255, 255, 255, 0.75);
    flex: none;
    font-size: 0.75rem;

    &.is-added,
    &.is-exists { color: #d4f5dd; }

    &.is-error { color: #ffd7d7; }
  }

  .movie-results {
    list-style: none;
    margin: 1.25rem 0 0;
    padding: 0;

    &__item {
      border-top: 1px solid rgba(255, 255, 255, 0.25);
      display: grid;
      gap: 0.9rem;
      grid-template-columns: 92px 1fr;
      padding: 1rem 0;
    }

    &__poster {
      border-radius: 6px;
      display: block;
      width: 92px;

      &--none {
        align-items: center;
        aspect-ratio: 2 / 3;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        font-size: 1.6rem;
        justify-content: center;
      }
    }

    &__body {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      min-width: 0;
    }

    &__name {
      color: white;
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }

    &__year {
      color: rgba(255, 255, 255, 0.7);
      font-weight: 400;
      margin-left: 0.35rem;
    }

    &__overview {
      color: rgba(255, 255, 255, 0.85);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      font-size: 0.8rem;
      line-height: 1.4;
      margin: 0;
      overflow: hidden;
    }
  }

  // The shared button assumes a dark page; Movie Hat's is blue. Only the
  // two muted text colours need adjusting — the button itself already reads.
  .request-movie__note {
    color: rgba(255, 255, 255, 0.85);
  }
}
</style>
