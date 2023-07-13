<template>
  <div class="pick-a-movie mx-auto">
    <!-- TODO: Should we add streaming services to these entries? -->
    <div v-if="message" class="movie-added col-12 d-flex justify-content-center flex-wrap">
      <div v-if="chosenMovie" class="image-wrapper col-6">
        <img
          v-if="chosenMovie.poster_path"
          class="poster col-12"
          :src="`https://image.tmdb.org/t/p/original${chosenMovie.poster_path}`"
          align="center"
        >
        <img
          v-else
          class="card-img-top not-found"
          src="../assets/images/Image_not_available.png"
          align="center"
        >
      </div>
      <p class="col-12 px-5">{{message}}</p>
      <div v-if="showNoteField" class="note-input input-group my-3 mx-4">
        <input
          type="text"
          class="form-control"
          placeholder="Would you like to add a note?"
          aria-label="Note for movie"
          aria-describedby="movie-note"
          v-model="noteValue"
        >
        <button
          class="btn btn-primary"
          type="button"
          id="movie-note"
          @click="addNoteToMovieAndGoHome"
        >
          {{buttonText}}
        </button>
      </div>
      <div v-show="showTimer" class="progress col-8" style="height: 2px;">
        <div
          class="progress-bar bg-dark"
          role="progressbar"
          :aria-valuenow="timer"
          aria-valuemin="0"
          aria-valuemax="100"
          :style="`width: ${timer}%;`"
        />
      </div>
    </div>
    <div v-else class="search-results">
      <p class="border border-white text-white d-flex justify-content-center m-3 p-2">
        Which movie do you want to add to the hat?
      </p>
      <ul class="movies p-0 d-flex justify-content-around flex-wrap">
        <li class="card shadow border" v-for="movie in searchResults" :key="movie.id" @click="addToHat(movie)">
          <img
            v-if="movie.poster_path"
            class="card-img-top"
            :src="`https://image.tmdb.org/t/p/original${movie.poster_path}`"
            align="center"
          >
          <img
            v-else
            class="card-img-top not-found"
            src="../assets/images/Image_not_available.png"
            align="center"
          >
          <div class="info p-1">
            <p v-if="movie.title" class="m-0 card-text text-center" :title="movie.title">
              {{truncate(movie.title)}}
              <br>
              {{movie.release_date}}
            </p>
            <div v-if="movie.streamers" class="streaming-providers">
              <div v-if="movie.streamers.flatrate" class="flatrate service-type">
                <div class="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cast" viewBox="0 0 16 16">
                    <path d="m7.646 9.354-3.792 3.792a.5.5 0 0 0 .353.854h7.586a.5.5 0 0 0 .354-.854L8.354 9.354a.5.5 0 0 0-.708 0z"/>
                    <path d="M11.414 11H14.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-13a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5h3.086l-1 1H1.5A1.5 1.5 0 0 1 0 10.5v-7A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v7a1.5 1.5 0 0 1-1.5 1.5h-2.086l-1-1z"/>
                  </svg>
                </div>
                <ul class="border border-dark">
                  <li class="streaming-provider" v-for="(streamer, index) in movie.streamers.flatrate" :key="index">
                    <img class="streamer-logo" :src="`https://image.tmdb.org/t/p/original${streamer.logo_path}`">
                  </li>
                </ul>
              </div>
              <div v-if="movie.streamers.rent" class="rent service-type">
                <div class="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-currency-dollar" viewBox="0 0 16 16">
                    <path d="M4 10.781c.148 1.667 1.513 2.85 3.591 3.003V15h1.043v-1.216c2.27-.179 3.678-1.438 3.678-3.3 0-1.59-.947-2.51-2.956-3.028l-.722-.187V3.467c1.122.11 1.879.714 2.07 1.616h1.47c-.166-1.6-1.54-2.748-3.54-2.875V1H7.591v1.233c-1.939.23-3.27 1.472-3.27 3.156 0 1.454.966 2.483 2.661 2.917l.61.162v4.031c-1.149-.17-1.94-.8-2.131-1.718H4zm3.391-3.836c-1.043-.263-1.6-.825-1.6-1.616 0-.944.704-1.641 1.8-1.828v3.495l-.2-.05zm1.591 1.872c1.287.323 1.852.859 1.852 1.769 0 1.097-.826 1.828-2.2 1.939V8.73l.348.086z"/>
                  </svg>
                </div>
                <ul class="border border-dark">
                  <li class="streaming-provider" v-for="(streamer, index) in movie.streamers.rent" :key="index">
                    <img class="streamer-logo" :src="`https://image.tmdb.org/t/p/original${streamer.logo_path}`">
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  data () {
    return {
      message: null,
      chosenMovie: null,
      showNoteField: false,
      noteValue: "",
      timer: 100,
      showTimer: true
    }
  },
  computed: {
    movieHatTitle () {
      return this.$store.state.movieHatTitle;
    },
    searchResults () {
      return this.$store.state.movieChoices;
    },
    buttonText () {
      if (this.noteValue) {
        return "Add Note";
      } else {
        return "No Thanks";
      }
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
    setTimer (milliseconds) {
      const speed = 50;

      const timerInterval = setInterval(() => {
        if (this.timer < 0) {
          clearInterval(timerInterval)
        }
        this.timer = this.timer - (speed / milliseconds * 100);
      }, speed);
    },
    async addToHat (movie) {
      this.loading = true;
      this.chosenMovie = movie;

      if (this.isMovieAlreadyInHat(movie)) {
        this.showMessage(
          `${this.chosenMovie.title} is already in the hat.`,
          4000,
          this.returnHome
        );

        return;
      }

      if (!this.$store.state.dbKeyForHatTitle) {
        const respForKey = await axios.get(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.$store.state.movieHatTitle}.json`
        );

        if (!respForKey.data) {
          return;
        }

        this.$store.commit("setDbKeyForHatTitle", Object.keys(respForKey.data)[0]);
      }

      const dbKey = this.$store.state.dbKeyForHatTitle;

      const post = await axios.post(
        `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/${dbKey}/movies.json`,
        { ...movie, timeStamp: Date.now(), addedBy: this.$store.state.name }
      );

      if (post.statusText === 'OK') {
        this.entryKey = post.data.name;
        this.loading = false;

        this.$store.dispatch('getHat');

        this.showNoteField = true;

        this.showMessage(
          `${this.chosenMovie.title} was added to the hat.`,
          -1,
          this.addNoteToMovieAndGoHome
        );
      } else {
        this.showMessage(
          `Something went wrong. ${this.chosenMovie.title} was not added to the hat.`,
          6000
        );
      }
    },
    async addNoteToMovieAndGoHome () {
      if (this.noteValue) {
        const dbKey = this.$store.state.dbKeyForHatTitle;

        const entry = await axios.get(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/${dbKey}/movies/${this.entryKey}.json`
        );

        const payload = {
          ...entry.data,
          note: this.noteValue
        };

        await axios.patch(
          `https://movie-hat-9c418-default-rtdb.firebaseio.com/hats/${this.movieHatTitle}/${dbKey}/movies/${this.entryKey}.json`,
          payload
        );
      }
      this.returnHome();
    },
    returnHome () {
      this.$router.push('/');
    },
    showMessage (message, delay, callBack) {
      delay = delay || 30000;

      this.message = message;

      if (delay > 0) {
        this.setTimer(delay - 100);

        setTimeout(() => {
          this.message = null;
          if (callBack) {
            callBack();
          }
        }, delay);
      } else {
        this.showTimer = false;
      }
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
        color: white;
        font-size: 1.5rem;
        margin: 36px 0 12px;
        text-align: center;
      }
    }

    .movies {
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

        .streaming-providers {
          .service-type {
            position: relative;

            .icon {
              align-items: center;
              background: black;
              border-radius: 50%;
              display: flex;
              height: 18px;
              justify-content: center;
              left: 0;
              padding: 3px;
              position: absolute;
              top: 50%;
              transform: translate(0px, -50%);
              width: 18px;

              svg {
                path {
                  fill: white;
                }
              }
            }

            ul {
              border-radius: 4px;
              column-gap: 4px;
              display: flex;
              flex-wrap: wrap;
              justify-content: flex-start;
              margin: 0;
              margin: 4px 4px 4px 8px;
              padding: 8px 8px 8px 16px;
              row-gap: 4px;

              .streaming-provider {
                display: flex;

                .streamer-logo {
                  height: 18px;
                  width: 18px;
                }
              }
            }
          }

        }
      }
    }
  }
</style>