import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import { createRouter, createWebHashHistory } from 'vue-router';
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import Home from "./components/Home.vue";
import PickAMovie from "./components/PickAMovie.vue";
import DrawnMovie from "./components/DrawnMovie.vue";

const app = createApp(App);

app.use(store);

// Router

const routes = [
  { path: '/', component: Home },
  { path: '/pick-a-movie', component: PickAMovie },
  { path: '/drawn-movie', component: DrawnMovie },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

app.use(router);

app.mount('#app');
