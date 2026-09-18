<template>
  <div class="history">
    <div class="sort-by-options col-12 col-sm-4 col-md-3 col-lg-2 p-3">
      <label>Sort by:</label>
      <select
        class="form-select"
        aria-label="Default select example"
        v-model="selectedSort"
      >
        <option value="watch_order">Watch Order</option>
        <option value="title">Title</option>
        <option value="cinema_release_date">Cinema Release Date</option>
      </select>
      <div class="sort-order" @click="toggleSortOrder">
        <div v-if="sortOrder !== 'ascending'" class="descending">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down-alt" viewBox="0 0 16 16">
            <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
          </svg>
        </div>
        <div v-if="sortOrder === 'ascending'" class="ascending">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up-alt" viewBox="0 0 16 16">
            <path d="M3.5 13.5a.5.5 0 0 1-1 0V4.707L1.354 5.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 4.707V13.5zm4-9.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
          </svg>
        </div>
      </div>
    </div>
    <ul>
      <li
        class="col-12 col-sm-4 col-md-3 col-lg-2 p-3"
        v-for="movie in sortedHistory"
        :key="movie.dbKey"
      >
        <!-- The frame wraps the link so the "i" can sit on the poster without
             living inside the anchor (a button inside a link is a tap that
             goes two places). Small and subtle on purpose — bug report,
             2026-09-13: "something small and subtle for each poster on the
             home screen that would show me the details of when it was added
             to the hat exactly, then by whom". -->
        <div class="poster-frame">
        <a
          :href="`https://www.google.com/search?q=${movie.title} movie`"
          target="_blank"
        >
          <span class="draw-band text-white my-1 text-center">({{drawRank(movie)}} drawn)</span>
          <img
            v-if="movie.poster_path"
            v-lazy="`https://image.tmdb.org/t/p/w342${movie.poster_path}`"
            :alt="`${movie.title} poster`"
          />
          <img
            v-else
            class="card-img-top not-found"
            src="../assets/images/Image_not_available.png"
            align="center"
          >
          <div v-if="movie.addedBy || movie.note" class="caption">
            <p v-if="movie.addedBy && movie.note">"{{movie.note}}" <br>- {{movie.addedBy}}</p>
            <p v-else-if="movie.addedBy">Added by: {{movie.addedBy}}</p>
            <p v-else-if="movie.note">"{{movie.note}}"</p>
          </div>
        </a>
        <button
          type="button"
          class="poster-info"
          :class="{ open: detailsOpenFor === movie.dbKey }"
          :aria-expanded="String(detailsOpenFor === movie.dbKey)"
          :aria-label="`Details for ${movie.title}`"
          @click="toggleDetails(movie)"
        >i</button>
        <!-- The back of the card: the title, the facts in two columns, and
             where it's streaming (bug report, 2026-09-15: "add in there also
             the places that it can be streamed since we're pulling that
             anyway, and the style of that whole open panel should be a
             little nicer"). -->
        <div v-if="detailsOpenFor === movie.dbKey" class="poster-details">
          <p class="poster-details-title">{{ movie.title }}</p>
          <dl v-if="detailRows(movie).length" class="poster-details-rows">
            <template v-for="row in detailRows(movie)" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </template>
          </dl>
          <p v-else class="poster-details-empty">Nothing more is known about this one.</p>
          <WhereToWatch :movie="movie" show-empty/>
        </div>
        </div>
        <!-- Matt only (the button hides itself for everyone else). Rendered
             once the requests index is in, so each button gets its row
             rather than reading its own. -->
        <RequestMovieButton
          v-if="requests"
          :movie="movie"
          :initial-row="requests[movie.id] || null"
          compact
        />
      </li>
    </ul>
  </div>
</template>

<script>
import ordinal from "ordinal-js";
import RequestMovieButton from './RequestMovieButton.vue';
import WhereToWatch from './WhereToWatch.vue';
import { historyDetailRows } from '../assets/javascript/historyDetails.js';
import { dbGet } from '../store/db.js';

export default {
  components: {
    RequestMovieButton,
    WhereToWatch
  },
  data () {
    return {
      selectedSort: 'watch_order',
      sortOrder: "ascending",
      // dbKey of the one poster whose details are unfolded; one at a time,
      // so the list doesn't turn into a wall of captions.
      detailsOpenFor: null,
      // tmdbId → runtime in minutes. Not on the stored record (every one was
      // saved from TMDB's search response, which omits runtime), so the panel
      // fetches it the first time it opens and keeps it for the session.
      runtimes: {},
      // tmdbId → request row, read ONCE for the whole list (requesters
      // only — the rules let nobody else list the node). Null until it's
      // in, so no button renders before it has its row.
      requests: null
    }
  },
  watch: {
    // Watches the GETTER, not the email: the approved-user half of the
    // answer arrives asynchronously with the `siteUsers` row, after the
    // email is already set.
    requestsAllowed: {
      immediate: true,
      async handler (allowed) {
        if (!allowed) {
          this.requests = null;
          return;
        }
        try {
          this.requests = (await dbGet('requests')) || {};
        } catch (error) {
          // Offline or refused: no buttons, rather than a page of errors.
          console.warn('Could not read movie requests', error);
          this.requests = null;
        }
      }
    }
  },
  computed: {
    // Whether this account may read the `requests` node at all. Two ways to
    // qualify (the hard-coded three, or an approved `siteUsers` row) and the
    // store getter is the one place that knows both.
    requestsAllowed () {
      return this.$store.getters.mayRequestMovies;
    },
    history () {
      return this.$store.state.history;
    },
    sortedHistory () {
      if (!this.$store.state.history) {
        return [];
      }

      const history = [...this.$store.state.history];

      if (this.selectedSort === "watch_order") {
        return history.sort(this.sortByWatchDate);
      } else if (this.selectedSort === "title") {
        return history.sort(this.sortByTitle);
      } else if (this.selectedSort === "cinema_release_date") {
        return history.sort(this.sortByRelease);
      }

      return history.sort(this.sortByWatchDate);
    }
  },
  methods: {
    toggleDetails (movie) {
      this.detailsOpenFor = this.detailsOpenFor === movie.dbKey ? null : movie.dbKey;
      if (this.detailsOpenFor) this.fetchRuntime(movie);
    },
    // One lookup per movie per session. A failure is silent: the Runtime row
    // simply doesn't render, the same way an absent provider strip doesn't
    // claim "nowhere".
    async fetchRuntime (movie) {
      const id = movie?.id;
      if (!id || this.runtimes[id] !== undefined) return;
      this.runtimes[id] = null;
      try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
        const data = await response.json();
        if (Number.isFinite(Number(data?.runtime))) this.runtimes[id] = Number(data.runtime);
      } catch (error) {
        console.warn('Could not load runtime', error);
      }
    },
    detailRows (movie) {
      return historyDetailRows(movie, {
        rank: this.drawRank(movie),
        runtime: this.runtimes[movie?.id] ?? null
      });
    },
    toggleSortOrder () {
      if (this.sortOrder === "ascending") {
        this.sortOrder = "descending";
      } else {
        this.sortOrder = "ascending";
      }
    },
    drawRank (movie) {
      if (!this.$store.state.history) {
        return 0;
      }

      const dates = [...this.$store.state.history].map((entry) => {
        return entry.dateDrawn;
      }).sort((a, b) => a - b);

      return ordinal.toOrdinal(dates.indexOf(movie.dateDrawn) + 1);
    },
    sortByWatchDate (a, b) {
      if (a.dateDrawn > b.dateDrawn) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.dateDrawn < b.dateDrawn) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    },
    sortByTitle (a, b) {
      if (a.title > b.title) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.title < b.title) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    },
    sortByRelease (a, b) {
      if (a.release_date > b.release_date) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.release_date < b.release_date) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    }
  },
}
</script>

<style lang="scss">
.history {
  .sort-by-options {
    display: flex;
    flex-wrap: wrap;

    label {
      width: 100%;
    }

    select {
      width: calc(100% - 50px);
    }

    .sort-order {
      width: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      svg {
        height: 24px;
        width: 24px;

        path {
          fill: white;
        }
      }
    }
  }

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;

    li {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;

      &.no-value {
        display: none;
      }

      .request-movie {
        // Tucked under the frame; the li is flex-wrap so this takes its
        // own line, and the negative margin closes most of the gap.
        margin-top: -0.35rem;
      }

      .poster-frame {
        position: relative;
        width: 100%;
      }

      // The "i": a small dark dot in the poster's top-right corner, quiet
      // enough not to compete with the ribbon in the other corner. The
      // frame's 12px border plus its 24px padding is where the poster
      // starts; the button sits just inside that.
      .poster-info {
        align-items: center;
        background: rgba(0, 0, 0, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.7);
        border-radius: 50%;
        color: white;
        cursor: pointer;
        display: flex;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 0.75rem;
        font-style: italic;
        font-weight: 700;
        height: 24px;
        justify-content: center;
        line-height: 1;
        padding: 0;
        position: absolute;
        right: 18px;
        top: 18px;
        width: 24px;

        // Press feedback only — a phone keeps :hover stuck after a tap.
        &:active,
        &.open {
          background: white;
          color: black;
        }
      }

      // Same white card and black frame as the poster, so it reads as the
      // back of the card rather than a popup.
      // The back of the card, NOT a second frame: the poster above it is the
      // framed object. A hairline and the card's own white keep the panel
      // reading as part of the same object without competing with it.
      .poster-details {
        background: white;
        border: 1px solid #d5d5d5;
        border-top: none;
        border-radius: 0 0 3px 3px;
        color: black;
        padding: 12px 16px 14px;
        text-align: left;
        width: 100%;

        .poster-details-title {
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1.3;
          margin: 0 0 0.4rem;
          overflow-wrap: anywhere;
        }

        // Two columns: small-caps labels, the facts beside them.
        .poster-details-rows {
          column-gap: 0.6rem;
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          margin: 0;
          row-gap: 0.2rem;

          dt {
            // #666 on white is ~5.7:1.
            color: #666;
            font-size: 0.5rem;
            font-weight: 700;
            letter-spacing: 0.08em;
            line-height: 1.6;
            text-transform: uppercase;
          }

          dd {
            font-size: 0.6rem;
            line-height: 1.4;
            margin: 0;
            overflow-wrap: anywhere;
          }
        }

        .poster-details-empty {
          color: #555;
          font-size: 0.6rem;
          font-style: italic;
          margin: 0;
        }

        // The streaming strip, in the card's own ink, under a hairline.
        .where-to-watch {
          border-top: 1px solid #ddd;
          color: black;
          margin-top: 0.6rem;
          padding-top: 0.6rem;

          .where-to-watch-link {
            justify-content: flex-start !important;
            // Explicitly plain: it is a link inside a card, not a poster.
            background: none;
            border: none;
            box-shadow: none;
            padding: 0;
          }

          .where-to-watch-empty {
            color: #555;
            opacity: 1;
          }
        }
      }

      // The child combinator is load-bearing: as a plain descendant rule this
      // framed every anchor in the card, so WhereToWatch's provider link came
      // out as a second black box inside the details panel (Matt, 2026-09-17:
      // "I don't like how all of these new dibs have the black frame... only
      // the poster should be framed"). Same root cause as the rotated band.
      .poster-frame > a {
        background: white;
        border: 12px solid black;
        box-shadow: inset 0px 0px 9px 0px #424242;
        // Block, explicitly: the link used to be a flex item of the li,
        // which blockified it; inside .poster-frame it is a plain inline
        // and its width, padding and border would stop laying out.
        display: block;
        overflow: hidden;
        padding: 24px;
        position: relative;
        text-decoration: none;
        width: 100%;

        // Was a bare `span`, which matched EVERY span inside ANY link in the
        // card - not just the corner band. WhereToWatch renders its own <a>
        // wrapping <span class="service">, so the streaming logos were being
        // absolutely positioned and rotated -45deg into a black diagonal
        // sliver (bug report -P1gchJKgU6aoUrymFOb). Keyed to the band itself
        // now, so nothing new inside a card can inherit it.
        .draw-band {
          background: black;
          border: 3px solid white;
          box-shadow: 0px 0px 4px 0px #424242;
          font-size: 0.6rem;
          left: -40px;
          padding: 4px 36px;
          position: absolute;
          top: 10px;
          transform: rotate(-45deg);
        }

        img {
          width: 100%;
        }

        .caption {
          padding: 16px 0 0;

          p {
            color: black;
            font-size: 0.5rem;
            text-align: center;
            margin: 0;
          }
        }
      }
    }
  }
}
</style>