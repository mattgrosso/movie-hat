<template>
  <div class="add-movie p-4">
    <form @submit.prevent="checkForSimilarMovies($refs.addMovieTitle.value)">
      <div class="input-group">
        <input
          class="form-control"
          placeholder="Movie Title"
          ref="addMovieTitle"
          type="text"
          v-model="movieTitle"
        />
        <button class="btn btn-success" type="submit">
          <span v-if="loading">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </span>
          <span v-else>Add Movie</span>
        </button>
      </div>
      <div v-if="message" class="message">
        <p>{{ message }}</p>
        <div v-if="showMessageCtas" class="message-ctas">
          <button class="btn btn-success" @click="confirmSimilarTitle">
            Yes
          </button>
          <button class="btn btn-warning" @click="clearMovie">Nevermind</button>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return {
      loading: false,
      message: null,
      showMessageCtas: false,
      movieTitle: null,
    };
  },
  computed: {
    devPrefix() {
      return this.$store.state.devMode ? 'dev-' : '';
    },
  },
  methods: {
    async checkForSimilarMovies(movieTitle) {
      const similarMovie = await this.$store.dispatch(
        'findSimilarMovie',
        movieTitle
      );

      if (similarMovie) {
        this.showMessageCtas = true;
        this.showMessage(
          `It looks like ${similarMovie.title} is already in the ${this.devPrefix}hat. Do you still want to add ${movieTitle}?`
        );
      } else {
        this.addMovie(movieTitle);
      }
    },
    async addMovie(movieTitle) {
      this.loading = true;
      this.$emit('start-adding-movie');

      const movie = {
        title: movieTitle,
        timeStamp: Date.now(),
      };

      const post = await axios.post(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/${this.devPrefix}hat.json`,
        movie
      );

      this.loading = false;

      if (post.statusText == 'OK') {
        this.movieTitle = null;
        this.$store.dispatch('loadHat', `${this.devPrefix}hat`);
        this.showMessage(
          `${movieTitle} was added to the ${this.devPrefix}hat.`,
          6000,
          this.finishAddingMovie
        );
      } else {
        this.showMessage(
          `Something went wrong. ${movieTitle} was not added to the ${this.devPrefix}hat.`,
          6000,
          this.finishAddingMovie
        );
      }
    },
    finishAddingMovie() {
      this.$emit('finish-adding-movie');
    },
    confirmSimilarTitle() {
      this.message = null;
      this.showMessageCtas = false;
      this.addMovie(this.movieTitle);
    },
    clearMovie() {
      this.message = null;
      this.showMessageCtas = false;
      this.movieTitle = null;
    },
    showMessage(message, delay, callBack) {
      delay = delay || 30000;

      this.message = message;
      setTimeout(() => {
        this.message = null;
        if (callBack) {
          callBack();
        }
      }, delay);
    },
  },
};
</script>

<style lang="scss" scoped>
.add-movie {
  align-items: center;
  display: flex;
  height: 100%;
  justify-content: center;
  width: 100%;

  form {
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;

    button {
      min-width: 110px;
    }
  }

  .message {
    bottom: -16px;
    color: white;
    position: absolute;
    transform: translateY(100%);
  }
}
</style>
