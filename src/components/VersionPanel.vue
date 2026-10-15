<template>
  <div class="versions">
    <p v-if="state === 'asking'" class="versions__status m-0">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"/>
      Asking the indexers which versions exist… this takes up to 20 seconds.
    </p>
    <p v-else-if="state === 'error'" class="versions__status versions__status--bad m-0">
      {{ problem || 'The search didn’t come back.' }}
      <button type="button" class="btn btn-link btn-sm p-0" @click="ask">Try again</button>
    </p>
    <template v-else-if="state === 'ready'">
      <p class="versions__lead m-0">
        <template v-if="runtime">TMDB says {{ runtime }} min. A file much bigger than its quality suggests may be a longer cut.</template>
        <template v-else>Pick one, or close this to let the Mac mini choose.</template>
      </p>
      <p v-if="!versions.fits.length && !versions.other.length" class="versions__status m-0">No versions turned up.</p>
      <ul class="versions__list">
        <li v-for="r in versions.fits" :key="r.infoHash">
          <button type="button" class="versions__item" :class="{ 'is-chosen': chosen === r.infoHash }" :aria-pressed="chosen === r.infoHash" @click="pick(r)">
            <span class="versions__top">
              <span v-if="r.cut" class="versions__cut">{{ r.cut }}</span>
              <strong>{{ r.quality || 'quality not stated' }}</strong>
              <span>{{ formatSize(r.size) }}</span>
            </span>
            <span class="versions__title">{{ r.title }}</span>
            <span class="versions__meta">{{ r.seeders || 0 }} seeders · {{ r.indexer }}</span>
          </button>
        </li>
      </ul>
      <!-- Ones the quality profile would refuse: offered, marked, dimmed -
           a deliberate choice may override the profile (the 35mm theatrical
           Dawn of the Dead was 20 GB against a 5 GB cap). -->
      <template v-if="versions.other.length">
        <p class="versions__other m-0">Other versions · outside your usual settings</p>
        <ul class="versions__list">
          <li v-for="r in versions.other" :key="r.infoHash">
            <button type="button" class="versions__item versions__item--other" :class="{ 'is-chosen': chosen === r.infoHash }" :aria-pressed="chosen === r.infoHash" @click="pick(r)">
              <span class="versions__top">
                <span v-if="r.cut" class="versions__cut">{{ r.cut }}</span>
                <strong>{{ r.quality || 'quality not stated' }}</strong>
                <span>{{ formatSize(r.size) }}</span>
              </span>
              <span class="versions__title">{{ r.title }}</span>
              <span class="versions__meta">{{ r.seeders || 0 }} seeders · {{ r.indexer }}</span>
              <span class="versions__blocked">{{ r.blocked }}</span>
            </button>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<script>
// "Choose a version" (Matt, 2026-10-15). Opened from the request button;
// asks the Mac mini for the versions of this film ONCE per open, polls the
// answer, and lets the requester pick one. The pick goes back up as
// `choose` and rides on the request row as `release`. The shape and the
// one-ask-per-open rule are in utils/requestMovie.js.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { dbGet, dbPatch } from '../store/db.js';
import { buildVersionAsk, versionQueryPath, versionsAnswered, sortVersions, formatSize } from '../utils/requestMovie.js';

const POLL_MS = 2000;
const GIVE_UP_MS = 60000;

export default {
  name: 'VersionPanel',
  props: {
    tmdbId: { type: Number, required: true },
    email: { type: String, required: true },
    chosen: { type: String, default: null }
  },
  emits: ['choose'],
  setup (props, { emit }) {
    const state = ref('asking');
    const problem = ref('');
    const node = ref(null);
    let timer = null;
    let started = 0;

    const stopPolling = () => { if (timer) clearTimeout(timer); timer = null; };

    async function poll (askedAt) {
      try {
        const got = await dbGet(versionQueryPath(props.tmdbId));
        if (versionsAnswered(got, askedAt)) {
          node.value = got;
          if (got.status === 'error') { state.value = 'error'; problem.value = got.error || ''; } else state.value = 'ready';
          return;
        }
      } catch (e) {
        console.error('Reading the versions failed', e);
      }
      if (Date.now() - started > GIVE_UP_MS) { state.value = 'error'; problem.value = 'The Mac mini didn’t answer. It may be asleep.'; return; }
      timer = setTimeout(() => poll(askedAt), POLL_MS);
    }

    // One ask per deliberate open (or a deliberate Try again): the service
    // refuses an ask it has already answered, and a new search is a new
    // `requestedAt`.
    async function ask () {
      stopPolling();
      state.value = 'asking';
      problem.value = '';
      started = Date.now();
      try {
        await dbPatch(versionQueryPath(props.tmdbId), buildVersionAsk(props.email));
        // The server's clock stamped the ask; anything answered after
        // (a little before now, to allow for clock skew) counts.
        poll(Date.now() - 5000);
      } catch (e) {
        console.error('Asking for versions failed', e);
        state.value = 'error';
        problem.value = 'Movie Hat wouldn’t send the question - are you signed in?';
      }
    }

    onMounted(ask);
    onBeforeUnmount(stopPolling);

    const versions = computed(() => sortVersions(node.value?.releases));
    const runtime = computed(() => node.value?.runtime || null);
    const pick = (r) => emit('choose', props.chosen === r.infoHash ? null : { infoHash: r.infoHash, title: r.title });

    return { state, problem, versions, runtime, pick, ask, formatSize };
  }
};
</script>

<style lang="scss">
.versions {
  width: min(100%, 420px);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;

  &__status { font-size: 0.85rem; color: #ced4da; display: flex; gap: 0.4rem; align-items: center; }
  &__status--bad { color: #ffc107; }
  &__lead { font-size: 0.8rem; color: #adb5bd; }
  &__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  &__item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.45rem 0.6rem;
    border-radius: 8px;
    border: 1px solid #495057;
    background: #212529;
    color: #f8f9fa;
    text-align: left;
  }
  &__item.is-chosen { border-color: #6f42c1; box-shadow: 0 0 0 2px #6f42c1; background: #2a2140; }
  &__item--other { opacity: 0.7; }
  &__item--other.is-chosen { opacity: 1; }
  &__top { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; font-size: 0.9rem; }
  &__cut { background: #ffc107; color: #212529; border-radius: 4px; padding: 0 0.35rem; font-size: 0.75rem; font-weight: 700; }
  &__title { font-size: 0.72rem; color: #adb5bd; word-break: break-word; }
  &__meta { font-size: 0.72rem; color: #8b949e; }
  &__blocked { font-size: 0.72rem; color: #ffc107; }
  &__other { font-size: 0.75rem; color: #adb5bd; margin-top: 0.3rem !important; text-transform: uppercase; letter-spacing: 0.04em; }
}
</style>
