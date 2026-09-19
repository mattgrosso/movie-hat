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
      {{ label }}
    </button>
    <!--
      Forcing is Matt's alone, so the option only appears for the account the
      database will accept it from. Not in a compact list: there it would be
      a second control per row on a page that is mostly rows.
    -->
    <button
      v-if="forceable && canRequest && !compact"
      type="button"
      class="request-movie__force"
      title="Bring the VPN up and start the download now, even if somebody is watching Plex"
      @click="request({ tmdbId: movie.id, title: movie.title, force: true })"
    >
      Force it through
    </button>
    <p v-if="error" class="request-movie__error m-0">{{ error }}</p>
    <!-- The note spells out what "Downloading" means; the compact list
         button carries it in its tooltip instead. -->
    <p v-else-if="note && !compact" class="request-movie__note m-0">{{ note }}</p>
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
// Rendered only for whoever may request: the people in REQUESTER_EMAILS
// (Matt, Seth, Brian) or anyone with an approved `siteUsers` row — a request
// fills the disk on Matt's Mac mini. The database rules enforce the same
// pair, so hiding the button is a courtesy to everyone else, not the
// boundary. Both answers come from the `mayRequestMovies` store getter.
import { computed, watch, onBeforeUnmount } from 'vue';
import { useStore } from 'vuex';
import { dbGet, dbPut } from '../store/db.js';
import { useRequestMovie, isValidTmdbId } from '../utils/requestMovie.js';

export default {
  name: 'RequestMovieButton',
  props: {
    movie: { type: Object, default: null },
    // Small and quiet, for a list of many (the home page's drawn movies):
    // text-sized, no box, a download glyph in place of the long label.
    compact: { type: Boolean, default: false },
    // Short labels ("Added" for "Added to library") where the button shares
    // a row with others. Compact implies it.
    short: { type: Boolean, default: false },
    // The row for this movie, when the parent read the whole `requests`
    // node already — `null` for "none". Leave undefined and the button
    // reads its own. This is what keeps a hundred buttons from making a
    // hundred reads on the home page.
    initialRow: { type: Object, default: undefined }
  },
  setup (props) {
    const store = useStore();
    // The store getter, not owner.mjs directly: since 2026-09-18 there are
    // TWO ways to qualify — the hard-coded three, or an approved `siteUsers`
    // row — and the getter is the one place that knows both.
    const signedIn = computed(() => store.getters.mayRequestMovies);

    const { row, requesting, error, label, note, settled, canRequest, forceable, load, request, stop } = useRequestMovie({
      read: dbGet,
      write: dbPut,
      source: 'movie-hat',
      email: () => store.state.email,
      short: props.compact || props.short
    });

    // Read the row as soon as there is a movie AND it's someone who may
    // request: a request made last week shows its state on arrival.
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
      if (status === 'exists' || (status === 'added' && settled.value)) return 'btn-success';
      if (status === 'error') return 'btn-danger';
      if (status === 'pending' || status === 'processing' || status === 'added' || requesting.value) return 'btn-secondary';
      // Solid, not outlined: on the drawn-movie page it sits beside a blue
      // Share and a green Home, and an outline on the dark page read as
      // "transparent... doesn't really show up" (report, 2026-09-15).
      return 'btn-request';
    });

    const tooltip = computed(() => {
      const who = row.value?.requestedBy;
      const status = row.value?.status;
      if (status === 'error' && row.value?.error) return String(row.value.error);
      if (who && status && status !== 'error') return [note.value, `Requested by ${who}`].filter(Boolean).join(' ');
      return 'Ask the Mac mini to add this movie to the library';
    });

    return { signedIn, row, requesting, error, label, note, settled, canRequest, forceable, request, buttonClass, tooltip };
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

  // Idle state. White on #6f42c1 is ~6:1. Press feedback only — a phone
  // keeps :hover stuck after a tap.
  .btn-request,
  .btn-request:disabled {
    background: #6f42c1;
    border-color: #6f42c1;
    color: white;
  }

  .btn-request:active {
    background: #59359a;
    border-color: #59359a;
    color: white;
  }

  // Deliberately quiet: it is a lever, not a call to action, and pressing it
  // starts a download over the top of whatever somebody is watching.
  &__force {
    background: none;
    border: 1px solid rgba(255, 193, 7, 0.55);
    border-radius: 0.25rem;
    color: #ffc107;
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
  }

  &__force:active {
    background: rgba(255, 193, 7, 0.18);
  }

  &__error {
    color: #ffc107;
    font-size: 0.75rem;
    text-align: center;
  }

  &__note {
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.7rem;
    line-height: 1.3;
    text-align: center;
  }

  // Under a drawn movie's frame on the home page: reads as a caption, not
  // a control, until it's needed. Colour carries the state; the box is
  // gone. Tap target stays 32px tall via padding.
  &--compact {
    gap: 0;

    .btn,
    .btn.btn-request,
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
