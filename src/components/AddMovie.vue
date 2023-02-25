<template>
  <div class="add-movie d-flex flex-wrap col-12 col-sm-4 col-md-3 col-lg-2 p-3">
    <form class="col-12" @submit.prevent="addMovie">
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
    </form>
    <div v-if="message" class="message px-3">
      <p class="m-0">{{ message }}</p>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data () {
    return {
      movieTitle: null,
      loading: false,
      message: null,
      showMessageCtas: false
    }
  },
  methods: {
    async addMovie () {
      this.loading = true;

      const resp = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${this.movieTitle}`);

      const choices = resp.data.results.map((result) => {
        return {
          backdrop_path: result.backdrop_path,
          id: result.id,
          overview: result.overview,
          popularity: result.popularity,
          poster_path: result.poster_path,
          release_date: result.release_date,
          title: result.title,
          vote_average: result.vote_average,
          vote_count: result.vote_count
        }
      });

      choices.sort(this.sortByVotes);

      if (!choices.length) {
        this.showMessage(
          `We couldn't find ${this.movieTitle}.`,
          6000
        );

        this.loading = false;
        return;
      }

      if (choices.length > 12) {
        choices.length = 12;
      }

      this.$store.commit('setMovieChoices', choices);
      this.loading = false;
      this.$router.push('/pick-a-movie');
    },
    sortByVotes (a, b) {
      if (a.vote_count > b.vote_count) {
        return -1;
      }

      if (a.vote_count < b.vote_count) {
        return 1
      }

      return 0;
    },
    showMessage (message, delay, callBack) {
      delay = delay || 30000;

      this.message = message;

      setTimeout(() => {
        this.message = null;
        if (callBack) {
          callBack();
        }
      }, delay);
    }
  },
}
</script>

<style lang="scss">
  .add-movie {
    align-items: center;
    display: flex;
    justify-content: center;
    position: relative;
    width: 100%;

    .message {
      bottom: -12px;
      color: white;
      position: absolute;
      left: 0;
    }
  }
</style>