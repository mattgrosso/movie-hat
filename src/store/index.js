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

// The remembered current hat. Newer saves are a {title, hatKey} pair —
// the KEY is the hat's identity, because titles are display labels and two
// hats can share one. A legacy save is a bare title from before that was
// true; carrying it forward with no key makes getHat resolve it the old way
// once, after which it is re-saved in the new form.
function readDefaultHat () {
  const saved = readLocal('defaultMovieHat');
  if (saved?.title && saved?.hatKey) return saved;

  const legacyTitle = readLocal('defaultMovieHatTitle');
  return legacyTitle ? { title: legacyTitle, hatKey: null } : null;
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
    movieHatTitle: readDefaultHat()?.title || null,
    dbKeyForHatTitle: readDefaultHat()?.hatKey || null,
    drawnMovie: null,
    // True between tapping Draw and the reveal on the drawn-movie screen —
    // that screen plays the hat animation while this is set.
    drawRevealPending: false,
    movieChoices: null,
    // A human-readable problem the UI should show. Failures used to go only
    // to the console, which is how an outage looked like an empty app.
    appError: null,
    // A newer deploy exists than the bundle this page is running. App.vue
    // applies it at a quiet moment; the banner is the fallback.
    updateAvailable: false
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
    /**
     * The current hat, as the {title, hatKey} PAIR. The key is the identity
     * — titles are labels and two hats can share one — so the two are set
     * and remembered together. Pass null to forget the current hat.
     */
    setCurrentHat (state, hat) {
      // The legacy title-only save is superseded either way.
      window.localStorage.removeItem('defaultMovieHatTitle');

      if (hat?.title && hat?.hatKey) {
        window.localStorage.setItem('defaultMovieHat', JSON.stringify({ title: hat.title, hatKey: hat.hatKey }));
      } else {
        window.localStorage.removeItem('defaultMovieHat');
      }

      state.movieHatTitle = hat?.title || null;
      state.dbKeyForHatTitle = hat?.hatKey || null;
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
    setDrawRevealPending (state, value) {
      state.drawRevealPending = Boolean(value);
    },
    setMovieChoices (state, value) {
      state.movieChoices = value;
    },
    setAppError (state, value) {
      state.appError = value;
    },
    setUpdateAvailable (state, value) {
      state.updateAvailable = Boolean(value);
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

      // The stored key IS the identity; resolving by title is only for a
      // legacy title-only save, and its answer gets re-saved as the pair so
      // resolution happens at most once.
      let dbKey = context.state.dbKeyForHatTitle;
      if (!dbKey) {
        dbKey = await resolveHatKey(title, context.state.email);
        if (dbKey) context.commit('setCurrentHat', { title, hatKey: dbKey });
      }

      if (!dbKey) {
        // The remembered hat opens nothing — deleted, or we're not a member.
        // Forgetting it means the next load goes to the hat list instead of
        // silently showing nothing forever.
        context.commit('setAppError', `Couldn't open "${title}" — it may have been deleted, or you may no longer be a member.`);
        context.commit('setCurrentHat', null);
        context.commit('setMovieHat', []);
        context.commit('setHistory', []);
        return;
      }

      let data = null;
      try {
        data = await dbGet(hatPath(title, dbKey));
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          // Refused outright — signed out, or no longer a member. Forget
          // the remembered hat so this can't recur on every load.
          context.commit('setAppError', `Couldn't open "${title}" — you may need to sign in again, or you may no longer be a member.`);
          context.commit('setCurrentHat', null);
        } else {
          context.commit('setAppError', `Couldn't load "${title}". Please try again.`);
        }
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
