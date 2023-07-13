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
    const localHostName = JSON.parse(window.localStorage.getItem('movieHatName'));
    if (localHostEmail) {
      this.$store.commit('setEmail', localHostEmail);
      this.$store.commit('setName', localHostName);
    }
  },
  methods: {
    googleLogin (resp) {
      const credential = decodeCredential(resp.credential);
      this.$store.commit('setEmail', credential.email);
      this.$store.commit('setName', `${credential.name}`);
    }
  },
}
</script>

<style>

</style>