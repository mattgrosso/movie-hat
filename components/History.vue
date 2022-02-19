<template>
  <div class="history">
    <div class="sort-by-options">
      <label>Sort by:</label>
      <select
        class="form-select"
        aria-label="Default select example"
        v-model="selectedSort"
      >
        <option value="watch_order">Watch Order</option>
        <option value="date_added">Date added to hat</option>
        <option value="title">Title</option>
        <option value="cinema_release_date">Cinema Release Date</option>
        <option value="imdb:popularity">IMDB Popularity</option>
        <option value="imdb:votes">IMDB Votes</option>
        <option value="imdb:score">IMDB Score</option>
        <option value="tmdb:popularity">TMDB Popularity</option>
        <option value="tmdb:score">TMDB Score</option>
      </select>
      <div class="sort-order" @click="ascending = ascending * -1">
        <svg
          v-if="ascending > 0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 576 512"
        >
          <!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
          <path
            d="M544 416h-223.1c-17.67 0-32 14.33-32 32s14.33 32 32 32H544c17.67 0 32-14.33 32-32S561.7 416 544 416zM320 96h32c17.67 0 31.1-14.33 31.1-32s-14.33-32-31.1-32h-32c-17.67 0-32 14.33-32 32S302.3 96 320 96zM320 224H416c17.67 0 32-14.33 32-32s-14.33-32-32-32h-95.1c-17.67 0-32 14.33-32 32S302.3 224 320 224zM320 352H480c17.67 0 32-14.33 32-32s-14.33-32-32-32h-159.1c-17.67 0-32 14.33-32 32S302.3 352 320 352zM151.6 41.95c-12.12-13.26-35.06-13.26-47.19 0l-87.1 96.09C4.475 151.1 5.35 171.4 18.38 183.3c6.141 5.629 13.89 8.414 21.61 8.414c8.672 0 17.3-3.504 23.61-10.39L96 145.9v302C96 465.7 110.3 480 128 480s32-14.33 32-32.03V145.9L192.4 181.3C204.4 194.3 224.6 195.3 237.6 183.3c13.03-11.95 13.9-32.22 1.969-45.27L151.6 41.95z"
          />
        </svg>
        <svg
          v-if="ascending < 0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 576 512"
        >
          <!--! Font Awesome Pro 6.0.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. -->
          <path
            d="M320 224H416c17.67 0 32-14.33 32-32s-14.33-32-32-32h-95.1c-17.67 0-32 14.33-32 32S302.3 224 320 224zM320 352H480c17.67 0 32-14.33 32-32s-14.33-32-32-32h-159.1c-17.67 0-32 14.33-32 32S302.3 352 320 352zM320 96h32c17.67 0 31.1-14.33 31.1-32s-14.33-32-31.1-32h-32c-17.67 0-32 14.33-32 32S302.3 96 320 96zM544 416h-223.1c-17.67 0-32 14.33-32 32s14.33 32 32 32H544c17.67 0 32-14.33 32-32S561.7 416 544 416zM192.4 330.7L160 366.1V64.03C160 46.33 145.7 32 128 32S96 46.33 96 64.03v302L63.6 330.7c-6.312-6.883-14.94-10.38-23.61-10.38c-7.719 0-15.47 2.781-21.61 8.414c-13.03 11.95-13.9 32.22-1.969 45.27l87.1 96.09c12.12 13.26 35.06 13.26 47.19 0l87.1-96.09c11.94-13.05 11.06-33.31-1.969-45.27C224.6 316.8 204.4 317.7 192.4 330.7z"
          />
        </svg>
      </div>
    </div>
    <ul v-if="fullHistory.length">
      <li
        class="col-12 col-sm-4 col-md-3 col-lg-2 p-3"
        :class="{ 'no-value': !sortParser(movie).sorted }"
        v-for="(movie, index) in sortedHistory"
        :key="index"
      >
        <a
          :href="`https://www.google.com/search?q=${movie.title}`"
          target="_blank"
        >
          <img :src="movie.poster" :alt="`${movie.title} poster`" />
          <p v-if="sortParser(movie).display">
            {{ sortParser(movie).display }}
          </p>
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
      selectedSort: 'watch_order',
      ascending: -1,
    };
  },
  watch: {
    selectedSort(newVal) {
      const invertedLists = [
        'watch_order',
        'imdb:votes',
        'imdb:score',
        'tmdb:popularity',
        'tmdb:score',
      ];

      if (invertedLists.includes(newVal)) {
        this.ascending = -1;
      }
    },
  },
  async mounted() {
    this.fullHistory = await Promise.all(
      this.$store.state.history.map(async (movie, index) => {
        return this.movieData(movie, index);
      })
    );
  },
  computed: {
    sortedHistory() {
      const sortedHistory = [...this.fullHistory];

      sortedHistory.sort((a, b) => {
        if (this.sortParser(a).value > this.sortParser(b).value) {
          return 1 * this.ascending;
        }

        if (this.sortParser(a).value < this.sortParser(b).value) {
          return -1 * this.ascending;
        }

        if (this.sortParser(a).value == this.sortParser(b).value) {
          return 0;
        }

        return -1 * this.ascending;
      });

      return sortedHistory;
    },
  },
  methods: {
    sortParser(movie) {
      if (this.selectedSort === 'cinema_release_date') {
        if (movie.cinema_release_date) {
          return {
            value: Date.parse(movie.cinema_release_date),
            display: movie.cinema_release_date,
            sorted: true,
          };
        } else {
          // Just a really big number so it sorts to the bottom.
          return {
            value: 10000000000000000000000000,
            display: 'No Date Given',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'title') {
        return {
          value: movie.title,
          display: movie.title,
          sorted: true,
        };
      } else if (this.selectedSort === 'date_added') {
        if (movie.dateAdded) {
          const date = new Date(movie.dateAdded);

          return {
            value: movie.dateAdded,
            display: `${
              date.getMonth() + 1
            }/${date.getDate()}/${date.getFullYear()}`,
            sorted: true,
          };
        } else {
          return {
            value: null,
            display: 'Unknown date',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'watch_order') {
        return {
          value: movie.hatDrawIndex,
          display: `${this.ordinalNumber(movie.hatDrawIndex + 1)} drawn`,
          sorted: true,
        };
      } else if (this.selectedSort === 'imdb:popularity') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:popularity';
        });

        if (result) {
          return {
            value: result.value,
            display: result.value,
            sorted: true,
          };
        } else {
          // Just a really big number so it sorts to the bottom.
          return {
            value: 10000000000000000000000000,
            display: 'Not Scored',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'imdb:votes') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:votes';
        });

        if (result) {
          return {
            value: result.value,
            display: result.value,
            sorted: true,
          };
        } else {
          return {
            value: 0,
            display: 'No Votes',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'imdb:score') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'imdb:score';
        });

        if (result) {
          return {
            value: result.value,
            display: result.value,
            sorted: true,
          };
        } else {
          return {
            value: 0,
            display: 'Not Scored',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'tmdb:popularity') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'tmdb:popularity';
        });

        if (result) {
          return {
            value: result.value,
            display: result.value,
            sorted: true,
          };
        } else {
          return {
            value: 0,
            display: 'Not Listed',
            sorted: false,
          };
        }
      } else if (this.selectedSort === 'tmdb:score') {
        const result = movie.scoring.find((object) => {
          return object.provider_type === 'tmdb:score';
        });

        if (result) {
          return {
            value: result.value,
            display: result.value,
            sorted: true,
          };
        } else {
          return {
            value: 0,
            display: 'Not Scored',
            sorted: false,
          };
        }
      } else {
        return {
          sorted: true,
        };
      }
    },
    async movieData(movie, index) {
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
          databaseId: movie.id,
          dateAdded: movie.timeStamp,
          hatDrawIndex: index,
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
    ordinalNumber(number) {
      const lastDigit = number % 10;
      const lastTwoDigits = number % 100;

      if (lastDigit == 1 && lastTwoDigits != 11) {
        return `${number}st`;
      } else if (lastDigit == 2 && lastTwoDigits != 12) {
        return `${number}nd`;
      } else if (lastDigit == 3 && lastTwoDigits != 13) {
        return `${number}rd`;
      } else {
        return `${number}th`;
      }
    },
  },
};
</script>

<style lang="scss">
.history {
  margin-top: 24px;

  .sort-by-options {
    display: flex;
    flex-wrap: wrap;

    label {
      width: 100%;
    }

    select {
      width: calc(100% - 50px);
    }

    .sort-order {
      width: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      svg {
        height: 24px;
        width: 24px;

        path {
          fill: white;
        }
      }
    }
  }

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
        display: none;
      }

      a {
        background: white;
        border: 12px solid black;
        padding: 24px;
        position: relative;
        text-decoration: none;

        img {
          width: 100%;
        }

        p {
          align-items: center;
          color: black;
          display: flex;
          justify-content: center;
          margin: 0;
          padding: 20px 0 0;
          text-decoration: none;
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
