<template>
  <div class="history">
    <ul v-if="fullHistory.length">
      <li
        class="col-12 col-sm-4 col-md-3 col-lg-2 p-3"
        v-for="(movie, index) in fullHistory"
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
    };
  },
  async mounted() {
    this.fullHistory = await Promise.all(
      this.$store.state.history.map(async (movie) => {
        return this.movieData(movie);
      })
    );
  },
  methods: {
    async movieData(movie) {
      const data = await jw.search(movie.title);
      let posterUrl;

      if (data.items[0]) {
        posterUrl = `https://images.justwatch.com${data.items[0].poster.replace(
          '{profile}',
          ''
        )}s718`;
      } else {
        posterUrl = `https://www.movienewz.com/wp-content/uploads/2014/07/poster-holder.jpg`;
      }

      const movieData = {
        ...data.items[0],
        poster: posterUrl,
      };

      return movieData;
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
