import { createStore } from 'vuex'
import { dbGet, hatPath, resolveHatKey } from './db.js'
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDlfyRC1BgoQ6UCPKsX-dvFC9HumeEwGjg",
  authDomain: "movie-hat-9c418.firebaseapp.com",
  databaseURL: "https://movie-hat-9c418-default-rtdb.firebaseio.com",
  projectId: "movie-hat-9c418",
  storageBucket: "movie-hat-9c418.appspot.com",
  messagingSenderId: "1061874698443",
  appId: "1:1061874698443:web:b2326dbc709a9237c2b34e"
};

initializeApp(firebaseConfig);

// localStorage can hold junk (a hand-cleared value, a stringified
// `undefined` from an old bug) — junk means "nothing remembered", not a
// crash before the app even mounts.
function readLocal (key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export default createStore({
  state: {
    // Restored here, at creation, so every component sees the remembered
    // values from its first render — this used to be scattered across
    // Login.vue and Hat.vue mounted hooks, and any route that mounted first
    // (a refresh on /drawn-movie) saw nulls.
    email: readLocal('movieHatEmail'),
    // Whether Firebase itself says we're signed in, as opposed to an email
    // remembered in localStorage. Null until onAuthStateChanged first fires.
    //
    // These were the same thing until 2026-08-16, which was the problem: the
    // app trusted `movieHatEmail` in localStorage and never checked the
    // session behind it. That works only while the database lets anyone
    // read and write. The moment the rules require a signed-in user, a
    // remembered email with no live session means the app looks logged in
    // and every request fails.
    authUser: null,
    authResolved: false,
    name: readLocal('movieHatName'),
    movieHat: null,
    history: null,
    members: null,
    movieHatTitle: readLocal('defaultMovieHatTitle'),
    dbKeyForHatTitle: null,
    drawnMovie: null,
    movieChoices: null,
    // A human-readable problem the UI should show. Failures used to go only
    // to the console, which is how an outage looked like an empty app.
    appError: null
  },
  getters: {
    isDevHat: (state) => {
      return state.movieHatTitle === 'Dev Hat';
    }
  },
  mutations: {
    setAuthUser (state, user) {
      state.authUser = user;
      state.authResolved = true;
    },
    setEmail (state, value) {
      if (value == null) {
        window.localStorage.removeItem('movieHatEmail');
      } else {
        window.localStorage.setItem('movieHatEmail', JSON.stringify(value));
      }
      state.email = value;
    },
    setName (state, value) {
      if (value == null) {
        window.localStorage.removeItem('movieHatName');
      } else {
        window.localStorage.setItem('movieHatName', JSON.stringify(value));
      }
      state.name = value;
    },
    setMovieHat (state, value) {
      state.movieHat = value;
    },
    setMovieHatTitle (state, value) {
      if (value == null) {
        window.localStorage.removeItem('defaultMovieHatTitle');
      } else {
        window.localStorage.setItem('defaultMovieHatTitle', JSON.stringify(value));
      }
      state.movieHatTitle = value;
    },
    setDbKeyForHatTitle (state, value) {
      state.dbKeyForHatTitle = value;
    },
    setHistory (state, value) {
      state.history = value;
    },
    setMembers (state, value) {
      state.members = value;
    },
    setDrawnMovie (state, value) {
      state.drawnMovie = value;
    },
    setMovieChoices (state, value) {
      state.movieChoices = value;
    },
    setAppError (state, value) {
      state.appError = value;
    }
  },
  actions: {
    /**
     * Subscribe to the real session. Called once at start-up.
     *
     * When Firebase says there IS a user we adopt its email, so the two can
     * never disagree. When it says there is NOT, the remembered email is
     * left in place for now — the rules are still open, so the app keeps
     * working — but `authUser` stays null, which is what the sign-in gate
     * will look at once the rules are closed.
     */
    watchAuth (context) {
      onAuthStateChanged(getAuth(), (user) => {
        context.commit('setAuthUser', user || null);

        if (user?.email) {
          context.commit('setEmail', user.email);
          if (user.displayName) context.commit('setName', user.displayName);
        }
      });
    },
    async login (context) {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();

      try {
        const result = await signInWithPopup(auth, provider);
        // const token = result.user.stsTokenManager.accessToken; // This is the Google API access token.
        // const user = result.user; // The signed-in user info.

        // Handle the result.
        if (result) {
          const userData = result.user;
          console.log('userData: ', userData);
          context.commit('setEmail', userData.email);

          if (userData.displayName) {
            context.commit('setName', userData.displayName);
          }
        }
      } catch (error) {
        console.error(error);
      }
    },
    /**
     * Automated-testing sign-in (Cinema Roll's Login.vue testToken pattern).
     * Only tokens minted by the Admin SDK (yarn mint-hat-token) can pass
     * signInWithCustomToken, so this cannot reach a real account.
     */
    async loginWithTestToken (context, token) {
      const result = await signInWithCustomToken(getAuth(), token);
      // watchAuth adopts the email too, but not before the caller wants to
      // navigate — commit it now so the first getHat has it.
      if (result?.user?.email) {
        context.commit('setEmail', result.user.email);
        if (result.user.displayName) context.commit('setName', result.user.displayName);
      }
    },
    async getHat (context) {
      const title = context.state.movieHatTitle;
      if (!title) {
        return;
      }

      const dbKey = await resolveHatKey(title, context.state.email);

      if (!dbKey) {
        // The remembered hat opens nothing — deleted, or we're not a member.
        // Forgetting it means the next load goes to the hat list instead of
        // silently showing nothing forever.
        context.commit('setAppError', `Couldn't open "${title}" — it may have been deleted, or you may no longer be a member.`);
        context.commit('setMovieHatTitle', null);
        context.commit('setMovieHat', []);
        context.commit('setHistory', []);
        return;
      }

      context.commit("setDbKeyForHatTitle", dbKey);

      let data = null;
      try {
        data = await dbGet(hatPath(title, dbKey));
      } catch (error) {
        const hint = error.status === 401 || error.status === 403
          ? 'You may need to sign in again.'
          : 'Please try again.';
        context.commit('setAppError', `Couldn't load "${title}". ${hint}`);
        return;
      }

      if (data) {
        let hatAsArray = [];

        if (data.movies) {
          hatAsArray = Object.keys(data.movies).map((key) => {
            const movie = { ...data.movies[key], dbKey: key };
            return movie;
          });
        }

        let history = [];

        if (data.history) {
          history = Object.keys(data.history).map((key) => {
            const movie = { ...data.history[key], dbKey: key };
            return movie;
          });
        }

        context.commit('setAppError', null);
        context.commit('setMembers', data.members);
        context.commit('setMovieHat', hatAsArray);
        context.commit('setHistory', history);
      }
    }
  },
  modules: {
  }
})
