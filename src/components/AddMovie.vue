<template>
  <div class="add-movie d-flex flex-wrap col-12 col-sm-4 col-md-3 col-lg-2 p-3">
    <form class="col-12" @submit.prevent="addMovie">
      <div class="input-group">
        <input
          class="form-control"
          placeholder="search for title"
          ref="addMovieTitle"
          type="text"
          v-model="movieTitle"
        />
        <button class="btn btn-success" type="submit" :disabled="!movieTitle">
          <span v-if="loading">
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </span>
          <span v-else>Search</span>
        </button>
      </div>
    </form>
    <div v-if="message" class="message px-3">
      <p class="m-0">{{ message }}</p>
    </div>
  </div>
</template>

<script>
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

      let results = [];
      try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${process.env.VUE_APP_TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(this.movieTitle)}`);
        const data = await response.json();
        results = data.results || [];
      } catch (error) {
        console.error(error);
        this.showMessage("The movie search didn't answer. Please try again.", 6000);
        this.loading = false;
        return;
      }

      const choices = results.map((result) => {
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

      // All the provider lookups at once — running them one at a time was
      // most of what the search spinner was waiting on.
      await Promise.all(choices.map(async (movie) => {
        const USProviders = await this.getStreamingProviders(movie.id);

        if (!USProviders) {
          movie.streamers = null;
          return;
        }

        const shortNamed = (providers) =>
          providers.filter((provider) => !this.nameTooLong(provider.provider_name)).slice(0, 5);

        const streamers = {};

        if (USProviders.flatrate) {
          streamers.flatrate = shortNamed(USProviders.flatrate);
        }

        if (USProviders.rent) {
          streamers.rent = shortNamed(USProviders.rent);
        }

        movie.streamers = Object.keys(streamers).length ? streamers : null;
      }));

      this.$store.commit('setMovieChoices', choices);
      this.loading = false;
      this.$router.push('/pick-a-movie');
    },
    async getStreamingProviders (id) {
      try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${process.env.VUE_APP_TMDB_API_KEY}`);
        const data = await response.json();
        return data.results?.US || null;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    nameTooLong (name) {
      return name.split(' ').length > 3;
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

    // Full width is right on a phone; on anything wider the search box
    // turned into a runway.
    form {
      @media (min-width: 576px) {
        max-width: 420px;
      }
    }

    .message {
      bottom: -12px;
      color: white;
      position: absolute;
      left: 0;
    }
  }
</style>