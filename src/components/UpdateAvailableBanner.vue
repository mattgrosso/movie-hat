<template>
  <div v-if="$store.state.updateAvailable" class="update-available-banner">
    <span v-if="updating">Updating&hellip;</span>
    <span v-else>A new version of Movie Hat is ready.</span>
    <button class="btn btn-sm btn-dark" :disabled="updating" @click="reload">
      {{ updating ? 'One moment' : 'Refresh' }}
    </button>
  </div>
</template>

<script>
import { reloadForUpdate } from '../utils/appUpdate.js';

// Shows once App.vue's deploy check flags a new version. Updates normally
// apply THEMSELVES at a quiet moment (App.vue's auto-update watcher) — this
// banner is the visible state while waiting, and the manual fallback
// whenever a quiet moment never comes. Cinema Roll's pattern.
export default {
  name: 'UpdateAvailableBanner',
  data () {
    return {
      updating: false
    };
  },
  methods: {
    async reload () {
      if (this.updating) return;
      this.updating = true;
      await reloadForUpdate();
    }
  }
}
</script>

<style scoped>
.update-available-banner {
  align-items: center;
  background-color: #ffc107;
  color: #000;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  text-align: center;
}
</style>
