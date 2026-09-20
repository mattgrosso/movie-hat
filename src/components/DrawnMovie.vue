<template>
  <div class="drawn-movie">
    <DrawingHat v-if="revealing" class="my-5"/>
    <div v-else-if="drawnMovie" class="draw p-4">
      <div class="poster-wrapper">
        <a
          :href="`https://www.google.com/search?q=${drawnMovie.title} movie`"
          target="_blank"
        >
          <img
            v-if="drawnMovie.poster_path"
            class="poster m-2 col-8"
            crossorigin="anonymous"
            :src="`https://image.tmdb.org/t/p/w780${drawnMovie.poster_path}`"
            :alt="`${drawnMovie.title} Poster`"
            :title="drawnMovie.title"
          />
          <img
            v-else
            class="card-img-top not-found"
            src="../assets/images/Image_not_available.png"
            align="center"
          >
        </a>
        <p v-if="history && history.length" class="draw-count text-center col-12 m-0 text-white">
          We have drawn {{ history.length }} movies from the hat.
        </p>
        <p v-if="someTimeAgo" class="days-ago text-center col-12 m-0 text-white">
          <span>
            (Added to the hat {{ someTimeAgo }}
          </span>
          <span v-if="drawnMovie.addedBy">
            by {{ drawnMovie.addedBy }}
          </span>
          <span>)</span>
        </p>
        <p v-if="drawnMovie.note" class="drawn-note text-center col-12 m-0 text-white">
          Note: {{ drawnMovie.note }}
        </p>
        <!-- Only ever on a non-English film: a caption on every second draw
             is noise, and the exception is the whole point. -->
        <p v-if="subtitleNote" class="subtitled text-center col-12 m-0">
          <span aria-hidden="true">💬</span> {{ subtitleNote.text }}
        </p>
        <WhereToWatch :movie="drawnMovie"/>
      </div>
      <div class="details-wrapper px-4 py-2">
        <button
          class="btn btn-primary"
          @click="shareMovie"
        >
          Share
        </button>
        <button
          class="back-button btn btn-success"
          @click="$router.push('/')"
        >
          Home
        </button>
        <!-- Third of the row, same as the other two; its label stays short
             so the three read as one set. Its note is lifted out to span
             the row (display: contents), so the grid sees the button and
             the note as two items. -->
        <RequestMovieButton :movie="drawnMovie" short class="request-slot"/>
      </div>
    </div>
    <div v-else class="loading-spinner">
      <div class="spinner-border spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
import DrawingHat from './DrawingHat.vue';
import WhereToWatch from './WhereToWatch.vue';
import RequestMovieButton from './RequestMovieButton.vue';
import { subtitleNote } from '../utils/movieLanguage.js';
import { drawShareText } from '../utils/shareDraw.js';

export default {
  components: {
    DrawingHat,
    WhereToWatch,
    RequestMovieButton
  },
  data () {
    return {
      revealing: false,
      // Looked up for hat entries added before AddMovie started storing
      // `original_language` — which is most of them. Null means "haven't
      // asked" or "asked and got nothing"; either way the caption stays off.
      fetchedLanguage: null
    };
  },
  mounted () {
    // Arriving fresh from a draw: play the hat here, then let the poster
    // reveal itself in place. A refresh or a walk back to this screen
    // shows the result straight away.
    if (this.$store.state.drawRevealPending) {
      this.$store.commit('setDrawRevealPending', false);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (!reducedMotion) {
        this.revealing = true;
        setTimeout(() => { this.revealing = false; }, 2400);
      }
    }

    // On a refresh the store starts empty: recover the draw from
    // localStorage, and re-read the hat so the draw count comes back.
    if (!this.$store.state.drawnMovie) {
      let remembered = null;
      try {
        remembered = JSON.parse(window.localStorage.getItem('lastDrawnMovie'));
      } catch {
        remembered = null;
      }

      if (remembered) {
        this.$store.commit('setDrawnMovie', remembered);
      } else {
        this.$router.push('/');
        return;
      }
    }

    if (!this.$store.state.history) {
      this.$store.dispatch('getHat');
    }

    this.loadLanguage();
  },
  watch: {
    // A second draw replaces the movie without remounting this screen.
    'drawnMovie.id' () {
      this.fetchedLanguage = null;
      this.loadLanguage();
    }
  },
  computed: {
    drawnMovie () {
      return this.$store.state.drawnMovie;
    },
    /**
     * "Am I going to be reading this?" — see utils/movieLanguage.js. Prefers
     * what the hat entry already carries; falls back to loadLanguage()'s
     * lookup, which is how the films added before that field existed get a
     * caption too.
     */
    subtitleNote () {
      const stored = this.drawnMovie?.original_language;
      return subtitleNote({ original_language: stored || this.fetchedLanguage });
    },
    history () {
      return this.$store.state.history;
    },
    someTimeAgo () {
      if (this.drawnMovie.timeStamp) {
        const now = new Date();
        const drawnDate = new Date(this.drawnMovie.timeStamp);
        const diff = now.getTime() - drawnDate.getTime();
        const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
        const yearsRemainder = diff % (1000 * 60 * 60 * 24 * 365);
        const diffMonths = Math.floor(yearsRemainder / (1000 * 60 * 60 * 24 * 30));
        const monthsRemainder = yearsRemainder % (1000 * 60 * 60 * 24 * 30);
        const diffDays = Math.floor(monthsRemainder / (1000 * 60 * 60 * 24));

        if (diffYears > 0) {
          return `${diffYears} years, ${diffMonths} months, ${diffDays} days ago`
        } else if (diffMonths > 0) {
          return `${diffMonths} months, ${diffDays} days ago`
        } else {
          return `${diffDays} days ago`
        }
      } else {
        return false;
      }
    }
  },
  methods: {
    /**
     * The language the film was made in, for entries that predate AddMovie
     * storing it. One call, no retry, silent on failure — this is a caption,
     * not a feature, and the screen is complete without it.
     */
    async loadLanguage () {
      if (!this.drawnMovie?.id || this.drawnMovie.original_language) return;
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${this.drawnMovie.id}?api_key=${process.env.VUE_APP_TMDB_API_KEY}`
        );
        if (!response.ok) return;
        const data = await response.json();
        this.fetchedLanguage = data?.original_language || null;
      } catch (error) {
        console.warn('Could not look up the movie language', error);
      }
    },
    async shareMovie () {
      const url = `https://image.tmdb.org/t/p/w780${this.drawnMovie.poster_path}`;
      // The title has to be in the TEXT. iOS drops navigator.share's `title`
      // field on the way into a share extension, so a share to Slack used to
      // arrive as "Added by: Matt" over a bare image URL, with the film named
      // nowhere. See utils/shareDraw.js.
      const text = drawShareText(this.drawnMovie, { hatName: this.$store.state.movieHatTitle });
      if (navigator.share) {
        try {
          await navigator.share({
            title: this.drawnMovie.title || 'Movie from hat',
            text,
            url
          });
        } catch (err) {
          console.error('There was an error sharing the movie', err);
        }
      } else {
        // Fallback for browsers that do not support the Web Share API.
        // `members` is an array on new hats, a push-key map on old ones, and
        // absent entirely on a cold reload — Object.values handles all three.
        const members = Object.values(this.$store.state.members || {}).join(",");
        window.location.href = `sms:/open?addresses=${members}&body=${encodeURIComponent(`${text}\n${url}`)}`;
      }
    }
  }
};
</script>

<style lang="scss">
.draw {
  background-color: var(--bg-color);
  // One centered column at every width. The old desktop layout put the
  // buttons in a side column next to a poster that filled two-thirds of the
  // screen; the draw reads like a movie one-sheet, so the poster stays the
  // centerpiece — at a size that fits on screen — and the actions sit
  // underneath it.
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;

  // The reveal: the poster arrives as if pulled from the hat, captions a
  // beat behind it.
  .poster-wrapper {
    animation: drawn-reveal 0.7s cubic-bezier(0.2, 0.8, 0.3, 1);
    text-align: center;

    .poster {
      background: white;
      border: 12px solid black;
      box-shadow: inset 0px 0px 9px 0px #424242;
      padding: 24px;

      // col-8 handles phones; on a desktop the cap is the viewport's
      // HEIGHT, or a tall poster pushes its own buttons below the fold.
      // (w780 posters are 2:3, so the width cap rarely wins.)
      @media screen and (min-width: 768px) {
        max-height: min(62vh, 640px);
        max-width: 420px;
        width: auto;
      }
    }

    .draw-count,
    .days-ago {
      font-size: 0.75rem;
    }

    // Brighter than the grey captions above it and a hair larger: this one
    // changes whether you press play, so it is not a footnote. Amber rather
    // than red — it's information, not a warning.
    .subtitled {
      color: #ffd479;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 0.25rem;
    }
  }

  // Share · Home · Request: one row of three columns at every width, capped
  // so they don't sprawl on a desktop. A grid rather than flex so the
  // columns are fixed by construction — the request column is a little
  // wider, because "Downloading" is the longest word in the row and it has
  // to fit at 390px without an ellipsis.
  .details-wrapper {
    animation: drawn-fade-up 0.5s ease 0.4s backwards;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr);
    margin: 0 auto;
    max-width: 480px;
    width: 100%;

    .btn {
      font-size: 0.95rem;
      overflow: hidden;
      padding-left: 0.4rem;
      padding-right: 0.4rem;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .request-movie.request-slot {
      display: contents;
    }

    // `display: contents` makes the request button a grid item directly —
    // and Matt's force lever a FOURTH one in a three-column grid, so it
    // dropped to a row of its own at a single column's width. "Force it
    // through" wrapped to two lines inside a ~120px box at 0.7rem, which is
    // the "ugly... almost illegible" of the report (-P1tU_AggltCIyidYPvF,
    // 2026-09-19). It gets the whole row, and enough size to read.
    .request-movie__force {
      font-size: 0.8rem;
      grid-column: 1 / -1;
      justify-self: center;
      padding: 0.3rem 0.9rem;
      white-space: nowrap;
    }

    // The explanation under the request button reads across the whole row.
    .request-movie__note,
    .request-movie__error {
      grid-column: 1 / -1;
      margin-top: -0.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .poster-wrapper,
    .details-wrapper {
      animation: none;
    }
  }
}

@keyframes drawn-reveal {
  from { opacity: 0; transform: translateY(-36px) rotate(-5deg) scale(0.65); }
  to { opacity: 1; transform: none; }
}

@keyframes drawn-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.loading-spinner {
  align-items: center;
  display: flex;
  height: 50vh;
  justify-content: center;
}
</style>
