<template>
  <div class="draw-movie p-4">
    <div v-if="loading" class="spinner-grow text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
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
import axios from 'axios';
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

        await this.removeMovieFromHat(randomMovie);

        this.$store.commit('setDrawnMovie', randomMovie);

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
        const respForKey = await axios.get(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.$store.state.movieHatTitle}.json`
        );

        if (!respForKey.data) {
          return;
        }

        this.$store.commit("setDbKeyForHatTitle", Object.keys(respForKey.data)[0]);
      }

      const dbKey = this.$store.state.dbKeyForHatTitle;

      const addToHistory = await axios.post(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/${dbKey}/history.json`,
        movieForHistory
      );

      if (addToHistory.statusText !== 'OK') {
        console.error('Something went wrong with moving to History: ', addToHistory);
        return;
      }

      const removeFromHat = await axios.delete(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/${dbKey}/movies/${movie.dbKey}.json`
      );

      if (removeFromHat.statusText !== 'OK') {
        console.log('Something went wrong with movie delete: ', removeFromHat);
        return;
      }

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

  .spinner-grow {
    height: 75px;
    width: 75px;
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
