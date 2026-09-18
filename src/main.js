import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import { createRouter, createWebHashHistory } from 'vue-router';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import VueLazyLoad from 'vue3-lazyload';
import PickAMovie from "./components/PickAMovie.vue";
import DrawnMovie from "./components/DrawnMovie.vue";
import Hat from "./components/Hat.vue";
import HatList from "./components/HatsList.vue";
import Wrapped from "./components/Wrapped.vue";
import Tutorial from "./components/Tutorial.vue";
import './registerServiceWorker'

const app = createApp(App);

app.use(store);

// Watch the real Firebase session from start-up. Until 2026-08-16 the app
// treated an email in localStorage as being signed in and never looked at
// the session behind it — which is fine only while the database lets anyone
// read and write. This is what the sign-in gate will read once the rules
// require a signed-in user.
store.dispatch('watchAuth');

app.use(VueLazyLoad, {});

// Router

const routes = [
  { path: '/', component: Hat },
  { path: '/pick-a-movie', component: PickAMovie },
  { path: '/drawn-movie', component: DrawnMovie },
  { path: '/hat-list', component: HatList },
  // Always reachable; the app only volunteers it around year's end.
  { path: '/wrapped', component: Wrapped },
  // Offered unasked to anyone with no hats, replayable from the hat list.
  { path: '/tutorial', component: Tutorial },
  // "Request a movie" and its waiting list (2026-09-18). Both belong to the
  // standalone Movie Requests app and live here too so Matt's phone carries
  // one icon instead of two — see the components' own headers.
  //
  // Lazy, like /peek and for the same reason: almost nobody who opens Movie
  // Hat may open these, and they should not cost everyone else the download.
  // `meta.requires` is read by the guard below.
  {
    path: '/request',
    meta: { requires: 'mayRequestMovies' },
    component: () => import('./components/RequestAMovie.vue')
  },
  {
    path: '/access',
    meta: { requires: 'mayApproveAccess' },
    component: () => import('./components/AccessRequests.vue')
  },
  // Hidden: look inside a hat and take a movie back out. Nothing links here,
  // and the screen bounces anyone who isn't the owner — see
  // src/assets/javascript/peek.js for what that gate is and is not.
  //
  // Loaded on demand so a screen almost nobody can open costs nobody the
  // download.
  {
    path: '/peek',
    // (Under webpack a `webpackChunkName: "peek"` hint named the chunk; Vite
    // names it after the component, js/PeekInHat.<hash>.js. Nothing refers to
    // either name, so the hint is gone rather than translated.)
    component: () => import('./components/PeekInHat.vue')
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

/**
 * Keep anyone who may not use the request screens off them, even if they
 * type the URL. This is a courtesy, not the boundary — the database rules
 * are — but an empty screen that silently fails every read is a worse answer
 * than the home page.
 *
 * `siteUserResolved` is the subtlety: the permission comes from a row that
 * is read asynchronously after sign-in, so for the first moment after a
 * reload on /request nobody looks allowed. Waiting for the read means a
 * refresh on these screens lands where it should instead of bouncing home.
 */
router.beforeEach(async (to) => {
  const requires = to.meta?.requires;
  if (!requires) return true;

  if (!store.state.siteUserResolved) {
    await new Promise((resolve) => {
      const stop = store.watch((state) => state.siteUserResolved, (resolved) => {
        if (!resolved) return;
        stop();
        resolve();
      });
      // A signed-out visitor never resolves one, and App.vue is showing them
      // the sign-in screen anyway. Don't hang the router on it.
      if (store.state.authResolved && !store.state.authUser) {
        stop();
        resolve();
      }
    });
  }

  return store.getters[requires] ? true : '/';
});

app.use(router);

app.mount('#app');
