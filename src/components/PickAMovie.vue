<template>
  <div class="pick-a-movie mx-auto">
    <div v-if="message" class="movie-added col-12 d-flex justify-content-center flex-wrap">
      <div v-if="chosenMovie" class="image-wrapper col-8">
        <img class="poster col-12" :src="`https://image.tmdb.org/t/p/original${chosenMovie.poster_path}`" align="center">
      </div>
      <p class="col-12 px-5">{{message}}</p>
    </div>
    <ul v-else class="p-0 d-flex justify-content-around flex-wrap">
      <li class="card shadow border" v-for="movie in searchResults" :key="movie.id" @click="addToHat(movie)">
        <img class="card-img-top" :src="`https://image.tmdb.org/t/p/original${movie.poster_path}`" align="center">
        <p class="my-3 mx-1 card-text text-center" :title="movie.title">
          {{truncate(movie.title)}}
          <br>
          {{movie.release_date}}
        </p>
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data () {
    return {
      message: null,
      chosenMovie: null
    }
  },
  computed: {
    movieHatTitle () {
      return this.$store.state.movieHatTitle;
    },
    searchResults () {
      return this.$store.state.movieChoices;
    }
  },
  methods: {
    isMovieAlreadyInHat (movie) {
      if (!this.$store.state.movieHat.length) {
        return false;
      }

      const ids = this.$store.state.movieHat.map((entry) => entry.id);

      if (ids.includes(movie.id)) {
        return ids.includes(movie.id);
      }

      return false;
    },
    async addToHat (movie) {
      this.loading = true;
      this.chosenMovie = movie;

      this.isMovieAlreadyInHat(movie);

      const post = await axios.post(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/movies.json`,
        { ...movie, timeStamp: Date.now() }
      );

      if (post.statusText === 'OK') {
        this.$store.dispatch('getMovieHat');

        this.showMessage(
          `${this.chosenMovie.title} was added to the hat.`,
          3000,
          this.returnHome
        );

        this.loading = false;
      } else {
        this.showMessage(
          `Something went wrong. ${this.chosenMovie.title} was not added to the hat.`,
          6000
        );
      }
    },
    returnHome () {
      this.$router.push('/');
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
    },
    truncate (string) {
      if (string.length > 15) {
        return `${string.substr(0, 13)}...`;
      } else {
        return string;
      }
    }
  },
}
</script>

<style lang="scss">
  .pick-a-movie {
    max-width: 832px;

    .movie-added {
      .image-wrapper {
        background: white;
        border: 12px solid black;
        padding: 24px;
      }

      p {
        font-size: 1.5rem;
        color: white;
        text-align: center;
        margin: 36px 0;
      }
    }

    ul {
      column-gap: 1rem;
      list-style: none;
      margin: 1rem 1rem 5rem;
      row-gap: 1rem;

      .card {
        border-radius: 4px;
        cursor: pointer;
        width: calc((100% - 2rem) / 3);

        p {
          font-size: .75rem;
        }
      }
    }
  }
</style>