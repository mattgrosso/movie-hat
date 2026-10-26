<template>
  <div class="login">
    <h1 class="col-12 text-center">Welcome to Movie Hat</h1>
    <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
    <button @click="login" :disabled="signingIn" class="btn btn-primary google-signin-button">
      <i class="bi bi-google me-2"></i>
      Sign in with Google
    </button>
    <p v-if="message" class="login-message text-center mt-3">{{ message }}</p>
  </div>
</template>

<script>

export default {
  data () {
    return { signingIn: false, message: null };
  },
  // The remembered email and name are restored by the store at creation —
  // the old restore-from-localStorage hook here ran too late for any route
  // that rendered before this component did.
  mounted () {
    // Automated-testing sign-in: /#/?testToken=<custom token>, minted by
    // `yarn mint-hat-token` for the tester account (Cinema Roll's pattern).
    // Only Admin-SDK tokens pass, so this cannot reach a real account.
    //
    // Read from location.hash, not $route: this component renders outside
    // <router-view>, so it mounts before the router has resolved the
    // initial navigation and $route.query is still empty.
    const queryString = window.location.hash.split('?')[1] || '';
    const testToken = new URLSearchParams(queryString).get('testToken');
    if (testToken) {
      this.$store.dispatch('loginWithTestToken', testToken)
        .then(() => this.$router.replace({ query: {} }))
        .catch((error) => console.error('Test token sign-in failed', error));
    }
  },
  methods: {
    // Off while Google's window is open: a second tap opened another window
    // and cancelled the first (Sentry, 2026-10-26).
    async login () {
      if (this.signingIn) return;
      this.signingIn = true;
      this.message = null;
      try {
        this.message = await this.$store.dispatch('login');
      } finally {
        this.signingIn = false;
      }
    }
  }
}
</script>

<style>
/* The sign-in button used to sit orphaned at the far left of the screen. */
.login {
  align-items: center;
  display: flex;
  flex-direction: column;
  padding: 2rem 1rem;
}

.login-message {
  max-width: 24rem;
}
</style>