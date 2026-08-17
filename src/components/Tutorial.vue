<template>
  <div class="tutorial col-12 px-3 pb-5">
    <div class="frame">
      <div class="mat">
        <div class="stage">
          <!-- Step art. Deliberately the app's own furniture rather than
               illustrations: what you see here is what you'll see in use. -->
          <div v-if="step.art === 'hat'" class="art art-hat">
            <DrawingHat/>
          </div>
          <div v-else-if="step.art === 'slips'" class="art art-slips">
            <span class="slip" v-for="title in sampleTitles" :key="title">{{ title }}</span>
          </div>
          <div v-else-if="step.art === 'poster'" class="art art-poster">
            <div class="poster-frame">
              <div class="poster-mat">
                <span class="poster-title">Tonight's<br>Movie</span>
              </div>
            </div>
          </div>
          <div v-else-if="step.art === 'wall'" class="art art-wall">
            <span class="tile" v-for="n in 6" :key="n"></span>
          </div>
          <div v-else class="art art-people">
            <span class="person" v-for="n in 3" :key="n"></span>
          </div>
        </div>

        <h2 class="headline m-0">{{ step.title }}</h2>
        <p class="body m-0">{{ step.body }}</p>
      </div>
    </div>

    <ol class="dots p-0 m-0" aria-label="Tutorial progress">
      <li
        v-for="(item, index) in steps"
        :key="index"
        :class="{ current: index === stepIndex }"
        @click="stepIndex = index"
      ></li>
    </ol>

    <div class="controls d-flex justify-content-between align-items-center">
      <button class="btn btn-link text-white" @click="back" :disabled="stepIndex === 0">Back</button>
      <button v-if="!onLastStep" class="btn btn-primary" @click="next">Next</button>
      <button v-else class="btn btn-success" @click="finish">Make your first hat</button>
    </div>

    <div class="d-flex justify-content-center">
      <button class="btn btn-link btn-sm text-white skip" @click="finish">
        {{ onLastStep ? '' : 'Skip the tour' }}
      </button>
    </div>
  </div>
</template>

<script>
import DrawingHat from './DrawingHat.vue';
import { markTutorialSeen } from '../assets/javascript/tutorial.js';

// What Movie Hat actually is, explained before anyone is asked to make
// anything.
//
// This exists as much for the DATABASE as for the user: of 70 hat records
// in August 2026, 40 had no movies and no history — people who signed in,
// were dropped straight onto a lone "Add New Hat" button with no
// explanation, typed "Hatbbbbb" to find out what it did, and never came
// back. Explaining the idea first is the only real prevention for that.
export default {
  components: {
    DrawingHat
  },
  data () {
    return {
      stepIndex: 0,
      sampleTitles: ['The Thing', 'Paddington 2', 'Heat', 'Clue'],
      steps: [
        {
          art: 'hat',
          title: 'It works like a hat',
          body: 'Everyone writes a movie on a slip of paper and drops it in. When it is time to watch something, you pull one out. Movie Hat is that, without the paper.'
        },
        {
          art: 'slips',
          title: 'Everyone adds movies',
          body: 'Search for anything you have been meaning to watch and drop it in the hat. You can leave a note saying why — the person who draws it will see it.'
        },
        {
          art: 'poster',
          title: 'Draw one when you cannot decide',
          body: 'One tap picks a movie at random. No debating, no scrolling for forty minutes. That is the whole point.'
        },
        {
          art: 'wall',
          title: 'Drawn movies leave the hat',
          body: 'A movie you draw comes out for good and joins your history — a wall of everything you have watched together, oldest to newest.'
        },
        {
          art: 'people',
          title: 'A hat is shared',
          body: 'Invite the people you watch with by email. Everybody adds to the same hat, and everybody can draw from it. You can have more than one — one for the family, one for just you.'
        }
      ]
    };
  },
  computed: {
    step () {
      return this.steps[this.stepIndex];
    },
    onLastStep () {
      return this.stepIndex === this.steps.length - 1;
    }
  },
  methods: {
    next () {
      if (!this.onLastStep) this.stepIndex += 1;
    },
    back () {
      if (this.stepIndex > 0) this.stepIndex -= 1;
    },
    finish () {
      // Seen once is seen: never volunteer it again, though "How it works"
      // on the hat list always replays it.
      markTutorialSeen();
      this.$router.push('/hat-list');
    }
  }
};
</script>

<style lang="scss">
.tutorial {
  color: white;
  margin: 0 auto;
  max-width: 520px;

  .frame {
    background: white;
    border: 12px solid black;
    box-shadow: inset 0 0 9px 0 #424242;
    margin-top: 1rem;
    padding: 16px;

    .mat {
      background: black;
      padding: 1.5rem 1.25rem 1.75rem;
      text-align: center;
    }
  }

  .stage {
    align-items: center;
    display: flex;
    height: 190px;
    justify-content: center;
    margin-bottom: 1.25rem;
  }

  .headline {
    color: #6ba2dc;
    font-family: "Monoton", cursive;
    font-size: 1.5rem;
    line-height: 1.3;
  }

  .body {
    color: white;
    font-size: 0.95rem;
    line-height: 1.5;
    margin-top: 0.85rem !important;
  }

  // --- step art -----------------------------------------------------------

  .art-hat {
    transform: scale(0.85);
  }

  .art-slips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    max-width: 300px;

    .slip {
      background: white;
      border: 2px solid black;
      color: black;
      font-size: 0.75rem;
      padding: 6px 10px;
      transform: rotate(-2deg);

      &:nth-child(even) { transform: rotate(2.5deg); }
    }
  }

  .art-poster {
    .poster-frame {
      background: white;
      border: 8px solid black;
      box-shadow: inset 0 0 9px 0 #424242;
      padding: 10px;
    }

    .poster-mat {
      align-items: center;
      background: #6ba2dc;
      display: flex;
      height: 150px;
      justify-content: center;
      width: 104px;
    }

    .poster-title {
      color: black;
      font-size: 0.85rem;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
    }
  }

  .art-wall {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, 56px);

    .tile {
      background: white;
      border: 4px solid black;
      display: block;
      height: 78px;
    }
  }

  .art-people {
    display: flex;
    gap: 1.25rem;

    .person {
      background: white;
      border: 3px solid black;
      border-radius: 50% 50% 40% 40%;
      display: block;
      height: 62px;
      width: 46px;

      &:nth-child(2) { height: 76px; }
    }
  }

  // --- chrome -------------------------------------------------------------

  .dots {
    display: flex;
    gap: 8px;
    justify-content: center;
    list-style: none;
    margin-top: 1.25rem !important;

    li {
      background: rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      cursor: pointer;
      height: 9px;
      width: 9px;

      &.current {
        background: white;
      }
    }
  }

  .controls {
    margin-top: 1rem;

    .btn-link {
      text-decoration: none;

      &:disabled {
        opacity: 0.35;
      }
    }
  }

  .skip {
    opacity: 0.75;
    text-decoration: underline;
  }
}
</style>
