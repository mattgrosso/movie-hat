<template>
  <div v-if="$store.state.updateAvailable" class="update-available-banner">
    <span v-if="isUpdating">Updating&hellip;</span>
    <span v-else-if="isDeferred">A new version of Movie Hat is waiting for a better connection. This one keeps working.</span>
    <span v-else>A new version of Movie Hat is ready.</span>
    <button class="btn btn-sm btn-dark" :disabled="isUpdating" @click="reload">
      {{ isUpdating ? 'One moment' : (isDeferred ? 'Try again' : 'Refresh') }}
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
      updating: false,
      // The connection couldn't carry the new version (appUpdate.js), so
      // the page stayed on the working one; say so rather than spin.
      deferred: false
    };
  },
  computed: {
    // Also true while App.vue applies the update on its own, so a tap can't
    // turn the automatic attempt into a second, harder one.
    isUpdating () {
      return this.updating || this.$store.state.updateApplying;
    },
    isDeferred () {
      return this.deferred || this.$store.state.updateDeferred;
    }
  },
  methods: {
    async reload () {
      if (this.isUpdating) return;
      this.updating = true;
      // The target lets a second tap for the SAME update skip the service
      // worker and load fresh instead of looping (bug report 2026-10-01).
      const outcome = await reloadForUpdate({ target: this.$store.state.updateTargetBundle });
      if (outcome === 'deferred') {
        this.updating = false;
        this.deferred = true;
      }
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
