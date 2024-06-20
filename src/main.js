import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import { createRouter, createWebHashHistory } from 'vue-router';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import VueLazyLoad from 'vue3-lazyload';
import vue3GoogleLogin from 'vue3-google-login'
import PickAMovie from "./components/PickAMovie.vue";
import DrawnMovie from "./components/DrawnMovie.vue";
import Hat from "./components/Hat.vue";
import HatList from "./components/HatsList.vue";
import './registerServiceWorker'

const app = createApp(App);

app.use(store);

app.use(VueLazyLoad, {});

app.use(vue3GoogleLogin, {
  clientId: '495603923646-a1kcb1lsvq7t2ekk5bmm15o30vf6pmnq.apps.googleusercontent.com'
})

// Router

const routes = [
  { path: '/', component: Hat },
  { path: '/pick-a-movie', component: PickAMovie },
  { path: '/drawn-movie', component: DrawnMovie },
  { path: '/hat-list', component: HatList },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

app.use(router);

app.mount('#app');
