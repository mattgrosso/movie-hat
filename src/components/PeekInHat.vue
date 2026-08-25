<template>
  <div class="peek col-12 px-3 py-4">
    <h1 class="peek-title text-white">Peek in the hat</h1>
    <p class="peek-warning text-white">
      This shows what is still waiting in a hat — the thing the rest of the app
      goes out of its way not to tell you. It will spoil your own draws.
    </p>

    <div v-if="message" class="message px-3 text-white">
      <p class="m-0">{{ message }}</p>
    </div>

    <div v-if="loadingHats" class="d-flex justify-content-center my-5">
      <div class="spinner-border text-light" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <template v-else>
      <div v-if="!myHats.length" class="card">
        <div class="card-body">
          <p class="m-0">You're not in any hats.</p>
        </div>
      </div>

      <template v-else>
        <select class="form-select mb-3" :value="selectedKey" @change="selectHat($event.target.value)">
          <option v-for="hat in myHats" :key="hat.hatKey" :value="hat.hatKey">{{ hat.title }}</option>
        </select>

        <div v-if="loadingMovies" class="d-flex justify-content-center my-5">
          <div class="spinner-border text-light" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <template v-else>
          <div class="peek-controls d-flex align-items-center mb-2">
            <input
              v-model="query"
              type="search"
              class="form-control form-control-sm me-2"
              placeholder="Search this hat"
              aria-label="Search this hat"
            >
            <button class="btn btn-outline-light btn-sm text-nowrap" @click="toggleSort">
              {{ sort === 'title' ? 'A–Z' : 'Newest' }}
            </button>
          </div>

          <p class="peek-count text-white m-0 mb-2">
            <span v-if="query">{{ shown.length }} of {{ movies.length }}</span>
            <span v-else>{{ movies.length }} {{ movies.length === 1 ? 'movie' : 'movies' }} in the hat</span>
          </p>

          <ul class="peek-list list-group">
            <li v-for="movie in shown" :key="movie.dbKey" class="list-group-item">
              <div class="d-flex align-items-start">
                <div class="flex-grow-1">
                  <div class="peek-movie-title">
                    {{ movie.title }}
                    <span v-if="year(movie)" class="peek-year">({{ year(movie) }})</span>
                  </div>
                  <div v-if="movie.addedBy || movie.note" class="peek-meta">
                    <span v-if="movie.addedBy">added by {{ movie.addedBy }}</span>
                    <span v-if="movie.addedBy && movie.note"> · </span>
                    <span v-if="movie.note">{{ movie.note }}</span>
                  </div>
                </div>
                <button
                  v-if="confirmingKey !== movie.dbKey"
                  class="btn btn-outline-danger btn-sm ms-2 text-nowrap"
                  :disabled="removingKey === movie.dbKey"
                  @click="confirmingKey = movie.dbKey"
                >
                  Remove
                </button>
              </div>

              <!-- Two-step, and it names the film. Removing is permanent and
                   there is no undo, so a mis-tap in a list of hundreds should
                   not be able to quietly take out the wrong one. -->
              <div v-if="confirmingKey === movie.dbKey" class="peek-confirm mt-2">
                <img
                  v-if="movie.poster_path"
                  class="peek-confirm-poster"
                  :src="`https://image.tmdb.org/t/p/w92${movie.poster_path}`"
                  :alt="movie.title"
                >
                <div class="flex-grow-1">
                  <p class="peek-confirm-text m-0 mb-2">
                    Take <strong>{{ movie.title }}</strong> out of {{ selectedTitle }} for good?
                  </p>
                  <button
                    class="btn btn-danger btn-sm me-2"
                    :disabled="removingKey === movie.dbKey"
                    @click="removeMovie(movie)"
                  >
                    {{ removingKey === movie.dbKey ? 'Removing…' : 'Remove it' }}
                  </button>
                  <button class="btn btn-outline-secondary btn-sm" @click="confirmingKey = null">
                    Cancel
                  </button>
                </div>
              </div>
            </li>
          </ul>

          <p v-if="!shown.length" class="peek-empty text-white mt-3">
            <span v-if="query">Nothing in this hat matches "{{ query }}".</span>
            <span v-else>This hat is empty.</span>
          </p>
        </template>
      </template>
    </template>
  </div>
</template>

<script>
// The hidden screen. Nothing links here — see src/assets/javascript/peek.js
// for what the owner gate is and, more importantly, what it is not.
import { dbGet, dbPatch, hatPath } from '../store/db.js';
import { emailToMemberKey } from '../store/memberKey.mjs';
import { isOwner, movieYear, visibleMovies } from '../assets/javascript/peek.js';

export default {
  name: 'PeekInHat',
  data () {
    return {
      myHats: [],
      selectedKey: null,
      movies: [],
      query: '',
      sort: 'title',
      loadingHats: true,
      loadingMovies: false,
      confirmingKey: null,
      removingKey: null,
      message: null
    }
  },
  async mounted () {
    await this.$router.isReady();

    // state.email is restored from localStorage when the store is created, so
    // it is already here — no wait needed, and no flash of the screen for
    // somebody who should be bounced. If the Firebase session behind it has
    // lapsed the reads below are refused, which loadMyHats says out loud.
    if (!isOwner(this.$store.state.email)) {
      this.$router.replace('/');
      return;
    }

    await this.loadMyHats();
  },
  computed: {
    shown () {
      return visibleMovies(this.movies, { query: this.query, sort: this.sort });
    },
    selectedTitle () {
      return this.myHats.find((hat) => hat.hatKey === this.selectedKey)?.title || 'this hat';
    }
  },
  methods: {
    year (movie) {
      return movieYear(movie);
    },
    toggleSort () {
      this.sort = this.sort === 'title' ? 'added' : 'title';
    },
    // Only hats this account belongs to. The index IS the membership list, so
    // there is nothing here to reach a hat the rules would refuse anyway.
    async loadMyHats () {
      const memberKey = emailToMemberKey(this.$store.state.email);

      if (!memberKey) {
        this.loadingHats = false;
        return;
      }

      try {
        const mine = await dbGet(`userHats/${memberKey}`);
        this.myHats = Object.values(mine || {})
          .filter((entry) => entry?.title && entry?.hatKey)
          .sort((a, b) => a.title.localeCompare(b.title));
      } catch {
        this.showMessage("Couldn't load your hats. You may need to sign in again.");
      }

      this.loadingHats = false;

      // Open the hat you were last in, so the common case takes no taps.
      const current = this.$store.state.dbKeyForHatTitle;
      const opening = this.myHats.some((hat) => hat.hatKey === current) ? current : this.myHats[0]?.hatKey;
      if (opening) await this.selectHat(opening);
    },
    async selectHat (hatKey) {
      this.selectedKey = hatKey;
      this.query = '';
      this.confirmingKey = null;
      this.movies = [];

      const hat = this.myHats.find((entry) => entry.hatKey === hatKey);
      if (!hat) return;

      this.loadingMovies = true;

      try {
        // Only the movies node — the history is the one part of a hat this
        // screen has no business enlarging, and it is the big half.
        const movies = await dbGet(`${hatPath(hat.title, hat.hatKey)}/movies`);
        this.movies = Object.entries(movies || {}).map(([dbKey, movie]) => ({ ...movie, dbKey }));
      } catch {
        this.showMessage(`Couldn't open ${hat.title}.`);
      }

      this.loadingMovies = false;
    },
    async removeMovie (movie) {
      const hat = this.myHats.find((entry) => entry.hatKey === this.selectedKey);
      if (!hat) return;

      this.removingKey = movie.dbKey;

      try {
        // PATCH with null, exactly as the draw does when a movie leaves the
        // hat. Nothing is written to history: a movie taken out this way was
        // never drawn, and history is the record of what actually got watched.
        await dbPatch(hatPath(hat.title, hat.hatKey), { [`movies/${movie.dbKey}`]: null });

        this.movies = this.movies.filter((entry) => entry.dbKey !== movie.dbKey);
        this.confirmingKey = null;
        this.showMessage(`Removed ${movie.title}.`);

        // The store's copy of the hat is now one movie out of date, and the
        // count on the home screen reads from it.
        if (hat.hatKey === this.$store.state.dbKeyForHatTitle) {
          this.$store.dispatch('getHat');
        }
      } catch (error) {
        console.error('Could not remove the movie', error);
        this.showMessage(`Couldn't remove ${movie.title}. It's still in the hat.`);
      } finally {
        this.removingKey = null;
      }
    },
    showMessage (message) {
      this.message = message;
      setTimeout(() => { this.message = null; }, 4000);
    }
  }
}
</script>

<style lang="scss">
  .peek {
    margin: 0 auto;
    max-width: 720px;

    .peek-title {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
    }

    .peek-warning {
      font-size: 0.78rem;
      opacity: 0.75;
    }

    .peek-count {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .peek-list {
      .peek-movie-title {
        font-size: 0.95rem;
      }

      .peek-year {
        color: #6c757d;
        font-size: 0.8rem;
      }

      .peek-meta {
        color: #6c757d;
        font-size: 0.72rem;
      }
    }

    .peek-confirm {
      display: flex;
      gap: 0.75rem;

      .peek-confirm-poster {
        border-radius: 3px;
        flex: 0 0 auto;
        width: 46px;
      }

      .peek-confirm-text {
        font-size: 0.8rem;
      }
    }

    .peek-empty {
      font-size: 0.85rem;
      opacity: 0.75;
    }
  }
</style>
