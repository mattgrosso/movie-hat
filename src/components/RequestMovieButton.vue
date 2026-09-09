<template>
  <div v-if="movie && signedIn" class="request-movie">
    <button
      type="button"
      class="btn"
      :class="buttonClass"
      :disabled="!canRequest"
      :title="tooltip"
      @click="request({ tmdbId: movie.id, title: movie.title })"
    >
      {{ label }}
    </button>
    <p v-if="error" class="request-movie__error m-0">{{ error }}</p>
  </div>
</template>

<script>
// The "Request this movie" button: one tap asks the Mac mini to add the
// movie to Radarr, and the button then reports what happened — Requested,
// Adding…, Added to library / Already in library, or a failure that can be
// tapped again. All of the logic is in utils/requestMovie.js (shared with
// Cinema Roll); this file is Movie Hat's binding of it to dbGet/dbPut and
// the store's email.
//
// Rendered for MATT ONLY (his call, 2026-09-09) — a request fills the disk
// on his Mac mini. The database rules enforce the same address, so hiding
// the button is a courtesy to everyone else, not the boundary.
import { computed, watch, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import { dbGet, dbPut } from '../store/db.js';
import { isOwner } from '../assets/javascript/owner.mjs';
import { useRequestMovie, isValidTmdbId } from '../utils/requestMovie.js';

export default {
  name: 'RequestMovieButton',
  props: {
    movie: { type: Object, default: null }
  },
  setup (props) {
    const store = useStore();
    const signedIn = computed(() => isOwner(store.state.email));

    const { row, requesting, error, label, settled, canRequest, load, request, stop } = useRequestMovie({
      read: dbGet,
      write: dbPut,
      source: 'movie-hat',
      email: () => store.state.email
    });

    // Read the row as soon as there is a movie AND it's Matt: a request made
    // last week shows its state on arrival.
    watch(
      () => [props.movie?.id, signedIn.value],
      ([tmdbId, ready]) => {
        if (ready && isValidTmdbId(tmdbId)) load(tmdbId);
        else stop();
      },
      { immediate: true }
    );
    onBeforeUnmount(stop);

    const buttonClass = computed(() => {
      const status = row.value?.status;
      if (status === 'added' || status === 'exists') return 'btn-success';
      if (status === 'error') return 'btn-danger';
      if (status === 'pending' || status === 'processing' || requesting.value) return 'btn-secondary';
      return 'btn-outline-light';
    });

    const tooltip = computed(() => {
      const who = row.value?.requestedBy;
      const status = row.value?.status;
      if (status === 'error' && row.value?.error) return String(row.value.error);
      if (who && status && status !== 'error') return `Requested by ${who}`;
      return 'Ask the Mac mini to add this movie to the library';
    });

    return { signedIn, row, requesting, error, label, settled, canRequest, request, buttonClass, tooltip };
  }
};
</script>

<style lang="scss">
.request-movie {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;

  .btn {
    width: min(100%, 320px);
  }

  .btn-outline-light {
    border-color: #999;
    color: white;
  }

  .btn-outline-light:hover {
    color: #222;
  }

  &__error {
    color: #ffc107;
    font-size: 0.75rem;
    text-align: center;
  }
}
</style>
