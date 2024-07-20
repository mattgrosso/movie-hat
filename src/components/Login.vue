<template>
  <div class="login">
    <h1 class="col-12 text-center">Welcome to Movie Hat</h1>
    <h2 class="col-12 text-center fs-6 mb-5">Please sign in with Google</h2>
    <button @click="login" class="btn btn-primary google-signin-button">
      <i class="bi bi-google me-2"></i>
      Sign in with Google
    </button>
  </div>
</template>

<script>

export default {
  mounted () {
    const localHostEmail = JSON.parse(window.localStorage.getItem('movieHatEmail'));
    const localHostName = JSON.parse(window.localStorage.getItem('movieHatName'));
    if (localHostEmail) {
      this.$store.commit('setEmail', localHostEmail);
      this.$store.commit('setName', localHostName);
    }
  },
  methods: {
    async login () {
      await this.$store.dispatch('login');
    }
  }
}
</script>

<style>

</style>