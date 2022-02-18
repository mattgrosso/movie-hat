<template>
  <div class="history">
    <div class="sort-by-options">
      <label>Sort by:</label>
      <select
        class="form-select"
        aria-label="Default select example"
        v-model="selectedSort"
      >
        <option value="watch_date">Watch Date</option>
        <option value="title">Title</option>
        <option value="cinema_release_date">Cinema Release Date</option>
        <option value="imdb:popularity">IMDB Popularity</option>
        <option value="imdb:votes">IMDB Votes</option>
        <option value="imdb:score">IMDB Score</option>
        <option value="tmdb:popularity">TMDB Popularity</option>
        <option value="tmdb:score">TMDB Score</option>
      </select>
    </div>
    <ul v-if="fullHistory.length">
      <li
        class="col-12 col-sm-4 col-md-3 col-lg-2 p-3"
        :class="{ 'no-value': notSorted(sortParser(movie)) }"
        v-for="(movie, index) in sortedHistory"
        :key="index"
      >
        <a
          :href="`https://www.google.com/search?q=${movie.title}`"
          target="_blank"
        >
          <img :src="movie.poster" :alt="`${movie.title} poster`" />
        </a>
      </li>
    </ul>
    <div v-if="!fullHistory.length" class="spinner-wrapper">
      <div class="spinner-grow text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
import justWatch from '@/assets/justwatch-api.mjs';
const jw = new justWatch();

export default {
  data() {
    return {
      fullHistory: [],
      selectedSort: 'watch_date',
    };
  },
  async mounted() {
    this.fullHistory = await Promise.all(
      this.$store.state.history.map(async (movie) => {
        return this.movieData(movie);
      })
    );
  },
  computed: {
    sortedHistory() {
      const sortedHistory = [...this.fullHistory];

      if (this.selectedSort === 'watch_date') {
        return sortedHistory;
      }

      sortedHistory.sort((a, b) => {
        if (this.sortParser(a) > this.sortParser(b)) {
          return 1;
        }

        if (this.sortParser(a) < this.sortParser(b)) {
          return -1;
        }

        if (this.sortParser(a) == this.sortParser(b)) {
          return 0;
        }

        return -1;
      });

      return sortedHistory;
    },
  },
  methods: {
    sortParser(movie) {
      if (this.selectedSort === 'cinema_release_date') {
        if (movie.cinema_release_date) {
          return Date.parse(movie.cinema_release_date);
        } else {
          // Just a really big number so it sorts to the bottom.
          return 10000000000000000000000000;
        }
      } else if (this.selectedSort === 'title') {
        return movie.title;
      } else if (this.selectedSort === 'imdb:popularity') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:popularity';
        });

        if (result) {
          return result.value;
        } else {
          // Just a really big number so it sorts to the bottom.
          return 10000000000000000000000000;
        }
      } else if (this.selectedSort === 'imdb:votes') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:votes';
        });

        if (result) {
          return result.value;
        } else {
          return 10000000000000000000000000;
        }
      } else if (this.selectedSort === 'imdb:score') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:score';
        });

        if (result) {
          return result.value;
        } else {
          return 10000000000000000000000000;
        }
      } else if (this.selectedSort === 'tmdb:popularity') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'tmdb:popularity';
        });

        if (result) {
          return result.value;
        } else {
          return 0;
        }
      } else if (this.selectedSort === 'tmdb:score') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'tmdb:score';
        });

        if (result) {
          return result.value;
        } else {
          return 0;
        }
      }
    },
    notSorted(value) {
      if (this.selectedSort === 'watch_date') {
        return false;
      } else if (
        value === 0 ||
        value === 10000000000000000000000000 ||
        value === '' ||
        !value
      ) {
        return true;
      }
    },
    async movieData(movie) {
      const data = await jw.search(movie.title);
      let posterUrl;

      if (data.items[0]) {
        posterUrl = `https://images.justwatch.com${data.items[0].poster.replace(
          '{profile}',
          ''
        )}s718`;

        const movieData = {
          ...data.items[0],
          poster: posterUrl,
        };

        return movieData;
      } else {
        posterUrl = `https://www.movienewz.com/wp-content/uploads/2014/07/poster-holder.jpg`;

        const movieData = {
          ...movie,
          poster: posterUrl,
        };

        return movieData;
      }
    },
  },
};
</script>

<style lang="scss">
.history {
  margin-top: 24px;

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;

    li {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;

      &.no-value {
        opacity: 0.5;
        pointer-events: none;
      }

      a {
        background: white;
        border: 12px solid black;
        padding: 24px;

        img {
          width: 100%;
        }
      }
    }
  }

  .spinner-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 100px;
  }
}
</style>
