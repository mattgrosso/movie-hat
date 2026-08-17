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
            :src="`https://image.tmdb.org/t/p/w780${drawnMovie.poster_path}`"
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
        <p v-if="history && history.length" class="draw-count text-center col-12 m-0 text-white">
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
        <WhereToWatch :movie="drawnMovie"/>
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
import WhereToWatch from './WhereToWatch.vue';

export default {
  components: {
    WhereToWatch
  },
  mounted () {
    // On a refresh the store starts empty: recover the draw from
    // localStorage, and re-read the hat so the draw count comes back.
    if (!this.$store.state.drawnMovie) {
      let remembered = null;
      try {
        remembered = JSON.parse(window.localStorage.getItem('lastDrawnMovie'));
      } catch {
        remembered = null;
      }

      if (remembered) {
        this.$store.commit('setDrawnMovie', remembered);
      } else {
        this.$router.push('/');
        return;
      }
    }

    if (!this.$store.state.history) {
      this.$store.dispatch('getHat');
    }
  },
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
      const url = `https://image.tmdb.org/t/p/w780${this.drawnMovie.poster_path}`;
      if (navigator.share) {
        try {
          const addedBy = this.drawnMovie.addedBy ? `Added by: ${this.drawnMovie.addedBy}` : '';
          const note = this.drawnMovie.note ? `Note: ${this.drawnMovie.note}` : '';
          const combinedText = `${addedBy}\n${note}`;

          await navigator.share({
            title: 'Movie from hat:',
            text: combinedText,
            url: url,
          });
        } catch (err) {
          console.error('There was an error sharing the movie', err);
        }
      } else {
        // Fallback for browsers that do not support the Web Share API.
        // `members` is an array on new hats, a push-key map on old ones, and
        // absent entirely on a cold reload — Object.values handles all three.
        const members = Object.values(this.$store.state.members || {}).join(",");
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

  // The reveal: the poster arrives as if pulled from the hat, captions a
  // beat behind it.
  .poster-wrapper {
    animation: drawn-reveal 0.7s cubic-bezier(0.2, 0.8, 0.3, 1);
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
    animation: drawn-fade-up 0.5s ease 0.4s backwards;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 150px;

    @media screen and (min-width: 768px) {
      height: 250px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .poster-wrapper,
    .details-wrapper {
      animation: none;
    }
  }
}

@keyframes drawn-reveal {
  from { opacity: 0; transform: translateY(-36px) rotate(-5deg) scale(0.65); }
  to { opacity: 1; transform: none; }
}

@keyframes drawn-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}

.loading-spinner {
  align-items: center;
  display: flex;
  height: 50vh;
  justify-content: center;
}
</style>
