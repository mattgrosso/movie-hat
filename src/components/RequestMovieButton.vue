<template>
  <div v-if="movie && signedIn" class="request-movie" :class="{ 'request-movie--compact': compact }">
    <button
      type="button"
      class="btn"
      :class="buttonClass"
      :disabled="!canRequest"
      :title="tooltip"
      @click="request({ tmdbId: movie.id, title: movie.title })"
    >
      <!-- Compact: a small download glyph so the word can stay short.
           bootstrap-icons' CSS isn't loaded, so the SVG rides inline. -->
      <svg v-if="compact" xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
        <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
      </svg>
      {{ compact && !row && !requesting ? 'Request' : label }}
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
    movie: { type: Object, default: null },
    // Small and quiet, for a list of many (the home page's drawn movies):
    // text-sized, no box, a download glyph in place of the long label.
    compact: { type: Boolean, default: false },
    // The row for this movie, when the parent read the whole `requests`
    // node already — `null` for "none". Leave undefined and the button
    // reads its own. This is what keeps a hundred buttons from making a
    // hundred reads on the home page.
    initialRow: { type: Object, default: undefined }
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
        if (ready && isValidTmdbId(tmdbId)) load(tmdbId, props.initialRow);
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

  // Under a drawn movie's frame on the home page: reads as a caption, not
  // a control, until it's needed. Colour carries the state; the box is
  // gone. Tap target stays 32px tall via padding.
  &--compact {
    gap: 0;

    .btn,
    .btn.btn-outline-light,
    .btn.btn-secondary,
    .btn.btn-success,
    .btn.btn-danger {
      align-items: center;
      background: none;
      border: 0;
      color: rgba(255, 255, 255, 0.6);
      display: inline-flex;
      font-size: 0.65rem;
      gap: 0.3em;
      line-height: 1;
      opacity: 1;
      padding: 0.6rem 0.5rem;
      width: auto;

      &:hover:not(:disabled) {
        color: white;
      }
    }

    .btn.btn-success {
      color: #8fd19e;
    }

    .btn.btn-danger {
      color: #ffb3b3;
    }

    &__error,
    .request-movie__error {
      font-size: 0.6rem;
    }
  }
}
</style>
