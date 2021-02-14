<template>
  <div class="draw-movie p-4">
    <div v-if="loading" class="spinner-grow text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <div v-else-if="drawnMovie" class="drawn-movie-title">
      <h2 class="mb-4">{{ drawnMovie.title }}</h2>
      <button
        class="btn btn-primary btn-sm"
        @click="drawMovie"
        :disabled="!moviesInHat"
      >
        Draw Again
      </button>
    </div>
    <button
      v-else
      class="btn btn-primary btn-lg"
      @click="drawMovie"
      :disabled="!moviesInHat"
    >
      Draw Movie
    </button>
    <p v-if="!moviesInHat" class="message">The {{ devPrefix }}hat is empty</p>
    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      drawnMovie: null,
      loading: false,
      message: null,
    };
  },
  computed: {
    moviesInHat() {
      return this.$store.state.hat.length;
    },
    devPrefix() {
      return this.$store.state.devMode ? 'dev-' : '';
    },
  },
  methods: {
    async drawMovie() {
      this.loading = true;

      const movies = await this.$store.dispatch(
        'loadHat',
        `${this.devPrefix}hat`
      );
      this.loading = false;

      if (movies.length) {
        const randomMovie = _.sample(movies);
        this.drawnMovie = randomMovie;

        this.removeMovieFromHat(randomMovie);

        this.$router.push({ name: 'draw', params: { movie: this.drawnMovie } });
      } else {
        this.showMessage('No movies in the hat. Which is sad.');
        return 'Error Loading Movie Title';
      }
    },
    async removeMovieFromHat(movie) {
      const movieForHistory = { ...movie };
      delete movieForHistory.id;

      const addToHistory = await axios.post(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/${this.devPrefix}history.json`,
        movieForHistory
      );

      if (addToHistory.statusText != 'OK') {
        console.error(
          'Something went wrong with moving to History: ',
          addToHistory
        );
        return;
      }

      const removeFromHat = await axios.delete(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/${this.devPrefix}hat/${movie.id}.json`
      );

      if (removeFromHat.statusText != 'OK') {
        console.log('Something went wrong with movie delete: ', removeFromHat);
        return;
      }

      await this.$store.dispatch('loadHat', `${this.devPrefix}hat`);
      await this.$store.dispatch('loadHistory', `${this.devPrefix}history`);
    },
    showMessage(message) {
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
  height: 100%;
  position: relative;
  justify-content: center;
  width: 100%;

  .spinner-grow {
    height: 75px;
    width: 75px;
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

  .message {
    bottom: 32px;
    color: white;
    position: absolute;
  }
}
</style>
