<template>
  <div class="drawing-hat" role="status" aria-label="Drawing a movie from the hat">
    <div class="tickets">
      <span class="ticket ticket-1"></span>
      <span class="ticket ticket-2"></span>
      <span class="ticket ticket-3"></span>
    </div>
    <div class="hat">
      <div class="crown"></div>
      <div class="band"></div>
      <div class="brim"></div>
      <div class="opening"></div>
    </div>
    <p class="drawing-label text-white m-0">Drawing…</p>
  </div>
</template>

<script>
// The magician's hat mid-draw: set down the way you actually draw from one
// — opening UP, brim at the top, crown hanging below — with paper tickets
// tossing out of the mouth. Pure CSS, in the app's black-and-white
// poster-mat idiom.
export default {};
</script>

<style lang="scss">
.drawing-hat {
  align-items: center;
  display: flex;
  flex-direction: column;
  padding-top: 56px;

  .hat {
    animation: hat-wobble 0.9s ease-in-out infinite;
    height: 100px;
    position: relative;
    transform-origin: 50% 92%;
    width: 150px;

    // Stacking, top of the upturned hat downward: the dark mouth sits in
    // the brim, the white band rides just beneath it, the crown tapers
    // away below.
    .brim {
      background: black;
      border-radius: 50%;
      height: 26px;
      left: 0;
      position: absolute;
      top: 0;
      width: 150px;
      z-index: 2;
    }

    .opening {
      background: #2a2a2a;
      border-radius: 50%;
      height: 16px;
      left: 27px;
      position: absolute;
      top: 5px;
      width: 96px;
      z-index: 3;
    }

    .band {
      background: white;
      height: 10px;
      left: 25px;
      position: absolute;
      top: 26px;
      width: 100px;
      z-index: 1;
    }

    .crown {
      background: black;
      border-radius: 0 0 16px 16px;
      height: 84px;
      left: 25px;
      position: absolute;
      top: 13px;
      width: 100px;
      z-index: 0;
    }
  }

  // Anchored at the hat's mouth; every ticket launches up and out of it.
  .tickets {
    height: 0;
    position: relative;
    width: 0;
    z-index: 4;

    .ticket {
      background: white;
      border: 2px solid black;
      height: 15px;
      left: -12px;
      opacity: 0;
      position: absolute;
      top: 8px;
      width: 24px;
    }

    .ticket-1 { animation: ticket-toss 1.4s ease-out infinite; }
    .ticket-2 { animation: ticket-toss-left 1.4s ease-out 0.45s infinite; }
    .ticket-3 { animation: ticket-toss-right 1.4s ease-out 0.9s infinite; }
  }

  .drawing-label {
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    margin-top: 0.9rem !important;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .hat { animation: none; }
    .tickets .ticket { animation: none; }
  }
}

@keyframes hat-wobble {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-7deg) translateY(1px); }
  50% { transform: rotate(6deg) translateY(-2px); }
  75% { transform: rotate(-4deg); }
}

@keyframes ticket-toss {
  0% { opacity: 0; transform: translate(0, 8px) rotate(0deg); }
  15% { opacity: 1; }
  60% { opacity: 1; transform: translate(6px, -74px) rotate(260deg); }
  100% { opacity: 0; transform: translate(10px, -32px) rotate(420deg); }
}

@keyframes ticket-toss-left {
  0% { opacity: 0; transform: translate(0, 8px) rotate(0deg); }
  15% { opacity: 1; }
  60% { opacity: 1; transform: translate(-44px, -62px) rotate(-240deg); }
  100% { opacity: 0; transform: translate(-56px, -20px) rotate(-380deg); }
}

@keyframes ticket-toss-right {
  0% { opacity: 0; transform: translate(0, 8px) rotate(0deg); }
  15% { opacity: 1; }
  60% { opacity: 1; transform: translate(48px, -56px) rotate(300deg); }
  100% { opacity: 0; transform: translate(60px, -16px) rotate(460deg); }
}
</style>
