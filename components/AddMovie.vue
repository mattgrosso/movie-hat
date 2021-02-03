<template>
  <div class="add-movie p-4">
    <form @submit.prevent="addMovie($refs.addMovieTitle.value)">
      <div class="input-group mb-3">
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
      <p v-if="message" class="message">{{ message }}</p>
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
      movieTitle: null,
    };
  },
  methods: {
    async addMovie(movieTitle) {
      this.loading = true;

      const movie = {
        title: movieTitle,
      };

      const post = await axios.post(
        'https://movie-hat-9c418-default-rtdb.firebaseio.com/hat.json',
        movie
      );

      this.loading = false;

      if (post.statusText == 'OK') {
        this.movieTitle = null;
        this.$store.dispatch('loadHat');
        this.showMessage(`${movieTitle} was added to the hat.`);
      } else {
        this.showMessage(
          `Something went wrong. ${movieTitle} was not added to the hat.`
        );
      }
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

<style lang="scss" scoped>
.add-movie {
  align-items: center;
  background: #2f6ff4;
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
