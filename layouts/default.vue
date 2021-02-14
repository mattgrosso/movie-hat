<template>
  <div>
    <Nuxt />
  </div>
</template>

<style lang="scss">
body {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;

  #__nuxt,
  #__layout {
    height: 100%;

    > div {
      height: 100%;
    }
  }
}
</style>
