<template>
  <div class="header d-flex justify-content-center align-items-center">
    <h1 class="col-12 d-flex justify-content-center">
      <span>
        Movie Hat
      </span>
      <div class="mat"></div>
    </h1>
  </div>
</template>

<script>
export default {

}
</script>

<style lang="scss">
  .header {
    h1 {
      background: white;
      border: 12px solid black;
      box-shadow: inset 0px 0px 9px 0px #424242;
      font-family: "Monoton", cursive;
      height: 150px;
      margin: 6px;
      overflow: hidden;
      position: relative;
      width: calc(100% - 12px);

      span {
        align-items: center;
        background: black;
        color: #6ba2dc;
        display: flex;
        font-size: 2.5rem;
        height: 100%;
        justify-content: center;
        padding: 24px 64px;
        white-space: nowrap;
        width: 100%;
      }

      .mat {
        border: 24px solid white;
        bottom: 0;
        left: 0;
        position: absolute;
        right: 0;
        top: 0;
      }
    }
  }
</style>