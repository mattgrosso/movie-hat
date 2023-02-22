<template>
  <div class="header d-flex justify-content-center align-items-center">
    <h1 class="col-12 d-flex justify-content-center">
      <span>
        Movie Hat
      </span>
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
      margin: 6px;
      min-height: 150px;
      padding: 24px;
      width: calc(100% - 12px);

      span {
        background: black;
        color: #6ba2dc;
        font-size: 2.9rem;
        padding: 24px;
      }
    }
  }
</style>