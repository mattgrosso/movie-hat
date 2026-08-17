<template>
  <div class="draw-movie p-4">
    <div v-if="loading" class="hat-draw" role="status" aria-label="Drawing a movie from the hat">
      <div class="tickets">
        <span class="ticket" v-for="n in 3" :key="n" :class="`ticket-${n}`"></span>
      </div>
      <div class="hat">
        <div class="opening"></div>
        <div class="crown"></div>
        <div class="band"></div>
        <div class="brim"></div>
      </div>
      <p class="drawing-label text-white m-0">Drawing…</p>
    </div>
    <button
      v-else
      class="btn btn-primary btn-lg"
      @click="drawMovie"
      :disabled="!moviesInHat"
    >
      Draw Movie
    </button>
    <p v-if="message" class="message text-white my-2 col-12 text-center">
      {{ message }}
    </p>
  </div>
</template>

<script>
import { dbPatch, hatPath, resolveHatKey } from '../store/db.js';
import sample from 'lodash/sample';

export default {
  data () {
    return {
      drawnMovie: null,
      loading: false,
      message: null
    };
  },
  computed: {
    movieHatTitle () {
      return this.$store.state.movieHatTitle;
    },
    moviesInHat () {
      return this.$store.state.movieHat?.length;
    }
  },
  methods: {
    async drawMovie () {
      this.loading = true;

      const movies = this.$store.state.movieHat;

      if (movies.length) {
        let randomMovie = sample(movies);

        if (this.$store.getters.isDevHat) {
          randomMovie = movies[movies.length - 1];
        }

        this.drawnMovie = randomMovie;

        // The draw deserves a beat of suspense: hold the hat animation for
        // a moment even when the network is instant. Anyone who asked their
        // OS for reduced motion gets the result as fast as it comes.
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const suspense = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 2200));

        await Promise.all([this.removeMovieFromHat(randomMovie), suspense]);

        this.$store.commit('setDrawnMovie', randomMovie);
        // So a refresh (or the PWA relaunching) on the drawn-movie screen
        // still has something to show.
        window.localStorage.setItem('lastDrawnMovie', JSON.stringify(randomMovie));

        this.$store.dispatch('getHat');

        this.loading = false;

        this.$router.push('/drawn-movie');
      } else {
        this.showMessage('No movies in the hat. Which is sad.');
      }
    },
    async removeMovieFromHat (movie) {
      const movieForHistory = { ...movie, dateDrawn: Date.now() };
      delete movieForHistory.dbKey;

      if (!this.$store.state.dbKeyForHatTitle) {
        // Through the index, not by listing the title: once the rules are
        // on, access is granted per hat and the title level is unreadable.
        const resolved = await resolveHatKey(this.$store.state.movieHatTitle, this.$store.state.email);

        if (!resolved) {
          return;
        }

        this.$store.commit("setDbKeyForHatTitle", resolved);
      }

      const dbKey = this.$store.state.dbKeyForHatTitle;

      // One write, both halves: the movie lands in history and leaves the
      // hat atomically, so a failure between the two steps can no longer
      // strand it in both places (or worse). Push keys normally come from
      // the server; a PATCH needs its own, and the draw timestamp is unique
      // enough within one hat's history.
      await dbPatch(hatPath(this.movieHatTitle, dbKey), {
        [`history/drawn-${movieForHistory.dateDrawn}`]: movieForHistory,
        [`movies/${movie.dbKey}`]: null
      });

      this.$store.dispatch('getHat');
    },
    showMessage (message) {
      this.message = message;
      setTimeout(() => {
        this.message = null;
      }, 3000);
    },
  },
};
</script>

<style lang="scss">
.draw-movie {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  position: relative;
  width: 100%;

  // The magician's hat, upside down, giving the hat a shake while paper
  // tickets toss out of it. Pure CSS in the app's own black-and-white
  // poster-mat idiom.
  .hat-draw {
    align-items: center;
    display: flex;
    flex-direction: column;
    padding-top: 46px;

    .hat {
      animation: hat-wobble 0.9s ease-in-out infinite;
      height: 92px;
      position: relative;
      transform-origin: 50% 90%;
      width: 150px;

      .opening {
        background: #1a1a1a;
        border-radius: 50%;
        height: 26px;
        left: 25px;
        position: absolute;
        top: -2px;
        width: 100px;
        z-index: 3;
      }

      .crown {
        background: black;
        border-radius: 0 0 14px 14px;
        height: 70px;
        left: 25px;
        position: absolute;
        top: 10px;
        width: 100px;
        z-index: 2;
      }

      .band {
        background: white;
        height: 10px;
        left: 25px;
        position: absolute;
        top: 58px;
        width: 100px;
        z-index: 2;
      }

      .brim {
        background: black;
        border-radius: 50%;
        height: 22px;
        left: 0;
        position: absolute;
        top: 68px;
        width: 150px;
        z-index: 1;
      }
    }

    .tickets {
      height: 0;
      position: relative;
      width: 0;
      z-index: 4;

      .ticket {
        background: white;
        border: 2px solid black;
        height: 15px;
        left: -12px;
        opacity: 0;
        position: absolute;
        top: 4px;
        width: 24px;
      }

      .ticket-1 { animation: ticket-toss 1.4s ease-out infinite; }
      .ticket-2 { animation: ticket-toss-left 1.4s ease-out 0.45s infinite; }
      .ticket-3 { animation: ticket-toss-right 1.4s ease-out 0.9s infinite; }
    }

    .drawing-label {
      font-size: 0.8rem;
      letter-spacing: 0.14em;
      margin-top: 0.75rem !important;
      text-transform: uppercase;
    }

    @media (prefers-reduced-motion: reduce) {
      .hat { animation: none; }
      .tickets .ticket { animation: none; }
    }
  }

  @keyframes hat-wobble {
    0%, 100% { transform: rotate(0deg); }
    20% { transform: rotate(-7deg) translateY(1px); }
    50% { transform: rotate(6deg) translateY(-2px); }
    75% { transform: rotate(-4deg); }
  }

  @keyframes ticket-toss {
    0% { opacity: 0; transform: translate(0, 6px) rotate(0deg); }
    15% { opacity: 1; }
    60% { opacity: 1; transform: translate(6px, -72px) rotate(260deg); }
    100% { opacity: 0; transform: translate(10px, -30px) rotate(420deg); }
  }

  @keyframes ticket-toss-left {
    0% { opacity: 0; transform: translate(0, 6px) rotate(0deg); }
    15% { opacity: 1; }
    60% { opacity: 1; transform: translate(-42px, -60px) rotate(-240deg); }
    100% { opacity: 0; transform: translate(-54px, -18px) rotate(-380deg); }
  }

  @keyframes ticket-toss-right {
    0% { opacity: 0; transform: translate(0, 6px) rotate(0deg); }
    15% { opacity: 1; }
    60% { opacity: 1; transform: translate(46px, -54px) rotate(300deg); }
    100% { opacity: 0; transform: translate(58px, -14px) rotate(460deg); }
  }

  .current-count {
    font-size: 0.75rem;
  }

  .drawn-movie-title {
    position: relative;

    h2 {
      color: white;
      font-size: 3rem;
    }

    button {
      bottom: -16px;
      left: 50%;
      position: absolute;
      transform: translateX(-50%);
    }
  }
}
</style>
