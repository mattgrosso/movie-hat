<template>
  <div class="login col-12 d-flex justify-content-center my-5">
    <GoogleLogin :callback="googleLogin"/>
  </div>
</template>

<script>
import { decodeCredential } from 'vue3-google-login'

export default {
  mounted () {
    const localHostEmail = JSON.parse(window.localStorage.getItem('movieHatEmail'));
    if (localHostEmail) {
      this.$store.commit('setEmail', localHostEmail);
    }
  },
  methods: {
    googleLogin (resp) {
      const credential = decodeCredential(resp.credential);
      this.$store.commit('setEmail', credential.email);
    }
  },
}
</script>

<style>

</style>