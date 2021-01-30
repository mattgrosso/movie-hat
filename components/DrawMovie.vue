<template>
  <div class="draw-movie p-4">
    <div v-if="loading" class="spinner-grow text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <div v-else-if="drawnMovie" class="drawn-movie-title">
      <h2 class="mb-4">{{ drawnMovie }}</h2>
      <button class="btn btn-primary btn-sm" @click="getMovie">
        Draw Again
      </button>
    </div>
    <button v-else class="btn btn-primary btn-lg" @click="getMovie">
      Draw Movie
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      drawnMovie: null,
      loading: false,
    };
  },
  methods: {
    async getMovie() {
      this.loading = true;
      const movies = await this.$store.dispatch('loadMovies');
      this.loading = false;

      if (movies.length) {
        const randomMovie = _.sample(movies);
        this.drawnMovie = randomMovie;

        return randomMovie;
      } else {
        return 'Error Loading Movie Title';
      }
    },
  },
};
</script>

<style lang="scss">
.draw-movie {
  align-items: center;
  background: #408458;
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
      font-size: 3rem;
      color: white;
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
