<template>
  <div class="drawn-movie">
    <div v-if="drawnMovie" class="draw p-4">
      <div class="poster-wrapper">
        <a
          :href="`https://www.google.com/search?q=${drawnMovie.title} movie`"
          target="_blank"
        >
          <img
            v-if="drawnMovie.poster_path"
            class="poster m-2 col-8"
            crossorigin="anonymous"
            :src="`https://image.tmdb.org/t/p/original${drawnMovie.poster_path}`"
            :alt="`${drawnMovie.title} Poster`"
            :title="drawnMovie.title"
          />
          <img
            v-else
            class="card-img-top not-found"
            src="../assets/images/Image_not_available.png"
            align="center"
          >
        </a>
        <p class="draw-count text-center col-12 m-0 text-white">
          We have drawn {{ history.length }} movies from the hat.
        </p>
        <p v-if="someTimeAgo" class="days-ago text-center col-12 m-0 text-white">
          <span>
            (Added to the hat {{ someTimeAgo }}
          </span>
          <span v-if="drawnMovie.addedBy">
            by {{ drawnMovie.addedBy }}
          </span>
          <span>)</span>
        </p>
        <p v-if="drawnMovie.note" class="drawn-note text-center col-12 m-0 text-white">
          Note: {{ drawnMovie.note }}
        </p>
      </div>
      <div class="details-wrapper px-4 py-2">
        <button
          class="btn btn-primary col-12 col-sm-6 col-md-12 m-3"
          @click="shareMovie"
        >
          Share
        </button>
        <button
          class="back-button btn btn-success col-12 col-sm-6 col-md-12"
          @click="$router.push('/')"
        >
          Home
        </button>
      </div>
    </div>
    <div v-else class="loading-spinner">
      <div class="spinner-border spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    drawnMovie () {
      return this.$store.state.drawnMovie;
    },
    history () {
      return this.$store.state.history;
    },
    someTimeAgo () {
      if (this.drawnMovie.timeStamp) {
        const now = new Date();
        const drawnDate = new Date(this.drawnMovie.timeStamp);
        const diff = now.getTime() - drawnDate.getTime();
        const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
        const yearsRemainder = diff % (1000 * 60 * 60 * 24 * 365);
        const diffMonths = Math.floor(yearsRemainder / (1000 * 60 * 60 * 24 * 30));
        const monthsRemainder = yearsRemainder % (1000 * 60 * 60 * 24 * 30);
        const diffDays = Math.floor(monthsRemainder / (1000 * 60 * 60 * 24));

        if (diffYears > 0) {
          return `${diffYears} years, ${diffMonths} months, ${diffDays} days ago`
        } else if (diffMonths > 0) {
          return `${diffMonths} months, ${diffDays} days ago`
        } else {
          return `${diffDays} days ago`
        }
      } else {
        return false;
      }
    }
  },
  methods: {
    async shareMovie () {
      const url = `https://image.tmdb.org/t/p/original${this.drawnMovie.poster_path}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Check out this movie',
            text: 'Here is the movie we drew from the hat:',
            url: url,
          });
        } catch (err) {
          console.error('There was an error sharing the movie', err);
        }
      } else {
        // Fallback for browsers that do not support the Web Share API
        const members = this.$store.state.members.join(",");
        window.location.href = `sms:/open?addresses=${members}&body=${url}`;
      }
    }
  }
};
</script>

<style lang="scss">
.draw {
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  justify-content: center;

  @media screen and (min-width: 768px) {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-around;
  }

  .poster-wrapper {
    text-align: center;

    .poster {
      background: white;
      border: 12px solid black;
      box-shadow: inset 0px 0px 9px 0px #424242;
      padding: 24px;
    }

    .draw-count,
    .days-ago {
      font-size: 0.75rem;
    }
  }

  .details-wrapper {
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 150px;

    @media screen and (min-width: 768px) {
      height: 250px;
    }
  }
}

.loading-spinner {
  align-items: center;
  display: flex;
  height: 50vh;
  justify-content: center;
}
</style>
