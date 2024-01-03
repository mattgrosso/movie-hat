<template>
  <div class="history">
    <div class="sort-by-options col-12 col-sm-4 col-md-3 col-lg-2 p-3">
      <label>Sort by:</label>
      <select
        class="form-select"
        aria-label="Default select example"
        v-model="selectedSort"
      >
        <option value="watch_order">Watch Order</option>
        <option value="title">Title</option>
        <option value="cinema_release_date">Cinema Release Date</option>
      </select>
      <div class="sort-order" @click="toggleSortOrder">
        <div v-if="sortOrder !== 'ascending'" class="descending">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down-alt" viewBox="0 0 16 16">
            <path d="M3.5 3.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 12.293V3.5zm4 .5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
          </svg>
        </div>
        <div v-if="sortOrder === 'ascending'" class="ascending">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up-alt" viewBox="0 0 16 16">
            <path d="M3.5 13.5a.5.5 0 0 1-1 0V4.707L1.354 5.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 4.707V13.5zm4-9.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 0 1h-1zm0 3a.5.5 0 0 1 0-1h3a.5.5 0 0 1 0 1h-3zm0 3a.5.5 0 0 1 0-1h5a.5.5 0 0 1 0 1h-5zM7 12.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5z"/>
          </svg>
        </div>
      </div>
    </div>
    <ul>
      <li
        class="col-12 col-sm-4 col-md-3 col-lg-2 p-3"
        v-for="movie in sortedHistory"
        :key="movie.dbKey"
      >
        <a
          :href="`https://www.google.com/search?q=${movie.title} movie`"
          target="_blank"
        >
          <span class="text-white my-1 text-center">({{drawRank(movie)}} drawn)</span>
          <img
            v-if="movie.poster_path"
            v-lazy="`https://image.tmdb.org/t/p/original${movie.poster_path}`"
            :alt="`${movie.title} poster`"
          />
          <img
            v-else
            class="card-img-top not-found"
            src="../assets/images/Image_not_available.png"
            align="center"
          >
        </a>
      </li>
    </ul>
  </div>
</template>

<script>
import ordinal from "ordinal-js";

export default {
  data () {
    return {
      selectedSort: 'watch_order',
      sortOrder: "ascending"
    }
  },
  computed: {
    history () {
      return this.$store.state.history;
    },
    sortedHistory () {
      if (!this.$store.state.history) {
        return [];
      }

      const history = [...this.$store.state.history];

      if (this.selectedSort === "watch_order") {
        return history.sort(this.sortByWatchDate);
      } else if (this.selectedSort === "title") {
        return history.sort(this.sortByTitle);
      } else if (this.selectedSort === "cinema_release_date") {
        return history.sort(this.sortByRelease);
      }

      return history.sort(this.sortByWatchDate);
    }
  },
  methods: {
    toggleSortOrder () {
      if (this.sortOrder === "ascending") {
        this.sortOrder = "descending";
      } else {
        this.sortOrder = "ascending";
      }
    },
    drawRank (movie) {
      if (!this.$store.state.history) {
        return 0;
      }

      const dates = [...this.$store.state.history].map((entry) => {
        return entry.dateDrawn;
      }).sort((a, b) => a - b);

      return ordinal.toOrdinal(dates.indexOf(movie.dateDrawn) + 1);
    },
    sortByWatchDate (a, b) {
      if (a.dateDrawn > b.dateDrawn) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.dateDrawn < b.dateDrawn) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    },
    sortByTitle (a, b) {
      if (a.title > b.title) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.title < b.title) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    },
    sortByRelease (a, b) {
      if (a.release_date > b.release_date) {
        if (this.sortOrder === "ascending") {
          return -1;
        } else {
          return 1;
        }
      }

      if (a.release_date < b.release_date) {
        if (this.sortOrder === "ascending") {
          return 1;
        } else {
          return -1;
        }
      }

      return 0;
    }
  },
}
</script>

<style lang="scss">
.history {
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
        box-shadow: inset 0px 0px 9px 0px #424242;
        overflow: hidden;
        padding: 24px;
        position: relative;
        text-decoration: none;
        width: 100%;

        span {
          background: black;
          border: 3px solid white;
          box-shadow: 0px 0px 4px 0px #424242;
          font-size: 0.6rem;
          left: -40px;
          padding: 4px 36px;
          position: absolute;
          top: 10px;
          transform: rotate(-45deg);
        }

        img {
          width: 100%;
        }
      }
    }
  }
}
</style>