<template>
  <div class="draw-movie p-4">
    <button
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
    drawMovie () {
      const movies = this.$store.state.movieHat;

      if (!movies.length) {
        this.showMessage('No movies in the hat. Which is sad.');
        return;
      }

      let randomMovie = sample(movies);

      if (this.$store.getters.isDevHat) {
        randomMovie = movies[movies.length - 1];
      }

      this.$store.commit('setDrawnMovie', randomMovie);
      // So a refresh (or the PWA relaunching) on the drawn-movie screen
      // still has something to show.
      window.localStorage.setItem('lastDrawnMovie', JSON.stringify(randomMovie));

      // Go to the drawn screen IMMEDIATELY — it plays the hat animation and
      // reveals the movie in place, rather than animating here and then
      // cutting. The database write rides along underneath the reveal.
      this.$store.commit('setDrawRevealPending', true);
      this.removeMovieFromHat(randomMovie).catch((error) => {
        console.error("The draw didn't save", error);
        this.$store.commit('setAppError', `The draw didn't save — ${randomMovie.title} is still in the hat. Please draw again.`);
      });

      this.$router.push('/drawn-movie');
    },
    async removeMovieFromHat (movie) {
      const movieForHistory = { ...movie, dateDrawn: Date.now() };
      delete movieForHistory.dbKey;

      if (!this.$store.state.dbKeyForHatTitle) {
        // Through the index, not by listing the title: once the rules are
        // on, access is granted per hat and the title level is unreadable.
        const resolved = await resolveHatKey(this.$store.state.movieHatTitle, this.$store.state.email);

        if (!resolved) {
          throw new Error('No hat to draw from');
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

  .current-count {
    font-size: 0.75rem;
  }
}
</style>
