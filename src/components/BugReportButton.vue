<template>
  <button
    v-if="!isOpen"
    type="button"
    class="bug-report-trigger"
    title="Report a bug"
    aria-label="Report a bug"
    @click="open"
  >
    <!-- bootstrap-icons is installed but its CSS is not imported anywhere, so
         the icon rides inline the way HatsList's icons do. -->
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-bug-fill" viewBox="0 0 16 16">
      <path d="M4.978.855a.5.5 0 1 0-.956.29l.41 1.352A5 5 0 0 0 3 6h10a5 5 0 0 0-1.432-3.503l.41-1.352a.5.5 0 1 0-.956-.29l-.291.956Q9.1 1 8 1q-1.1 0-2.113.311z"/>
      <path d="M13 6v1H8.5v8.975A5 5 0 0 0 13 11h.5a.5.5 0 0 1 .5.5v.5a.5.5 0 1 0 1 0v-.5a1.5 1.5 0 0 0-1.5-1.5H13V9h1.5a.5.5 0 0 0 0-1H13V7h.5A1.5 1.5 0 0 0 15 5.5V5a.5.5 0 0 0-1 0v.5a.5.5 0 0 1-.5.5zm-5.5 9.975V7H3V6h-.5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 0-1 0v.5A1.5 1.5 0 0 0 2.5 7H3v1H1.5a.5.5 0 0 0 0 1H3v1h-.5A1.5 1.5 0 0 0 1 11.5v.5a.5.5 0 1 0 1 0v-.5a.5.5 0 0 1 .5-.5H3a5 5 0 0 0 4.5 4.975"/>
    </svg>
  </button>

  <!-- Hand-rolled, deliberately NOT Bootstrap's Modal (Meal Hat's lesson: a
       bug-report button that can freeze the app is a poor joke). No JS modal
       library, no backdrop element to leak, no data-api. -->
  <div v-if="isOpen" class="bug-report-backdrop" @click.self="close">
    <div class="bug-report-panel" role="dialog" aria-modal="true" aria-label="Report a bug">
      <template v-if="!sent">
        <h2 class="bug-report-panel__title">Report a bug</h2>
        <textarea
          ref="textarea"
          v-model="transcript"
          class="bug-report-panel__textarea"
          placeholder="What happened?"
          rows="5"
          :disabled="sending"
        ></textarea>
        <p v-if="error" class="bug-report-panel__error">{{ error }}</p>
        <div class="bug-report-panel__actions">
          <button type="button" class="btn btn-sm btn-secondary" :disabled="sending" @click="close">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="sending || !transcript.trim()"
            @click="send"
          >
            {{ sending ? 'Sending…' : 'Send report' }}
          </button>
        </div>
      </template>

      <!-- Says something DIFFERENT when it only reached the stash. "Sent"
           for something still sitting in localStorage is a lie the reporter
           has no way to catch. -->
      <p v-else-if="queuedOffline" class="bug-report-panel__sent">
        Saved — it&rsquo;ll send when you&rsquo;re back online.
      </p>
      <p v-else class="bug-report-panel__sent">
        Sent — thanks!
      </p>
    </div>
  </div>
</template>

<script>
import { submitBugReport } from '../utils/bugReports.js';

export default {
  name: 'BugReportButton',
  data () {
    return {
      isOpen: false,
      transcript: '',
      sending: false,
      error: null,
      sent: false,
      queuedOffline: false
    };
  },
  methods: {
    open () {
      this.isOpen = true;
      this.sent = false;
      this.error = null;
      this.$nextTick(() => this.$refs.textarea?.focus());
    },
    close () {
      // Never disappear mid-send: the text is the only copy until the write
      // lands or the stash catches it.
      if (this.sending) return;
      this.isOpen = false;
      this.transcript = '';
      this.error = null;
    },
    async send () {
      if (!this.transcript.trim() || this.sending) return;

      this.sending = true;
      this.error = null;

      try {
        const result = await submitBugReport(this.$store, this.transcript, this.$route);
        this.sent = true;
        this.queuedOffline = Boolean(result && result.queued);
        this.transcript = '';
        setTimeout(() => {
          this.isOpen = false;
          this.sent = false;
          this.queuedOffline = false;
        }, 2200);
      } catch (err) {
        // Keep the text. They just typed it and it is not stored anywhere else.
        this.error = err.message || 'Could not send that report.';
      } finally {
        this.sending = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
/* Fixed bottom-left, matching the other apps (Cinema Roll moved it there
   from the right after a report). This app has no fixed bottom furniture,
   so the corner is free on every screen — hat, draw, list, and the sign-in
   page, which matters because login trouble is a thing worth reporting.

   Always-visible tap target above the 40px minimum; :active rather than
   :hover because an installed iOS PWA keeps a hover state with no pointer
   to leave it. Respects the safe-area inset on notched phones. */
.bug-report-trigger {
  position: fixed;
  left: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0));
  z-index: 1200;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  border: 1px solid #4a7bb0;
  background: #fff;
  color: #46698f;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  opacity: 0.9;
  padding: 0;
}

.bug-report-trigger:active {
  opacity: 1;
  color: #0d6efd;
  border-color: #0d6efd;
}

.bug-report-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.bug-report-panel {
  background: #fff;
  border: 1px solid #dcdcdc;
  border-radius: 0.5rem;
  padding: 1.25rem;
  max-width: min(420px, 90vw);
  width: 100%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.bug-report-panel__title {
  font-size: 1.05rem;
  margin: 0;
}

.bug-report-panel__textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  padding: 0.5rem;
  font: inherit;
  /* A UA minimum width beats width: 100% and can push the panel wider than
     a phone's viewport. */
  min-width: 0;
}

.bug-report-panel__error {
  color: #b02a37;
  font-size: 0.9rem;
  margin: 0;
}

.bug-report-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.bug-report-panel__sent {
  text-align: center;
  margin: 0.5rem 0;
  color: #2f6f47;
}
</style>
