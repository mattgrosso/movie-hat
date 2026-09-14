import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Vite replaced Vue CLI/webpack here on 2026-09-14, following the recipe the
// ten Around Table Round games used that day (no-thanks e817419) and the one
// Cinema Roll used for the same PWA shape (ee3e00e). The rules that shaped
// this file:
//
//  - Nothing in src/ was rewritten for the move. Every `process.env.VUE_APP_*`
//    read (VUE_APP_TMDB_API_KEY, VUE_APP_PUSH_API_URL,
//    VUE_APP_VAPID_PUBLIC_KEY, and the build stamp's VUE_APP_VERSION /
//    VUE_APP_BUILD_TIME) and `process.env.BASE_URL` is statically replaced via
//    `define` below, exactly as webpack's DefinePlugin did, so the house
//    modules stay byte-identical to their siblings. Vite handles
//    `process.env.NODE_ENV` itself and turns any other `process.env.X` into
//    `undefined`, which is what an unset VUE_APP_ var was under Vue CLI too
//    (utils/push.js's "push not configured" guard depends on that).
//
//    VERSION_BUMP is deliberately NOT defined: it is read only by
//    src/assets/javascript/version.js, which runs under plain Node from
//    scripts/bump-and-build.mjs and is never part of the bundle. Vue CLI
//    didn't inline it either.
//
//  - App.vue's checkDeployedBundle() notices a new deploy by reading the
//    hashed entry bundle's name off index.html, matching
//    /js\/app\.[a-z0-9]+\.js/. The rollup output options below reproduce
//    webpack's `js/app.<hex>.js` naming exactly (Rollup's default hash
//    alphabet is base64, which would never match) - change them and
//    auto-update silently stops working.
//
//  - This file is `.mjs` rather than the games' `vite.config.js` +
//    `"type": "module"`, because src/assets/javascript/version.js (the
//    deploy-time version bump) and eslint.config.js are CommonJS and stay so.

// The house build stamp (see src/utils/buildStamp.js): this module is
// evaluated once per build/serve, so the ISO time below names the moment THIS
// bundle was built - not the moment the page was loaded, which is the whole
// point (a tab left open for a week keeps showing the build it is still
// running). The old vue.config.js set the same value the same way, at config
// evaluation. VUE_APP_VERSION comes from .env and is bumped by
// scripts/bump-and-build.mjs on `yarn deploy` - untouched here.
//
// NB: this runs while Vite's temporary vite.config.mjs.timestamp-*.mjs copy of
// this file exists on disk; .gitignore covers it so a clean tree reads clean.
const buildTime = new Date().toISOString();

// Vite copies public/ verbatim, .DS_Store files included, where Vue CLI's copy
// step skipped them. They would otherwise ride along to S3 (and into the
// service worker's precache). Removed from dist before the worker is
// generated - this plugin sits ahead of VitePWA, and closeBundle hooks run in
// plugin order.
function dropDsStore () {
  const sweep = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) sweep(full);
      else if (entry.name === '.DS_Store') rmSync(full);
    }
  };
  let outDir;
  return {
    name: 'movie-hat:drop-ds-store',
    apply: 'build',
    configResolved (config) {
      outDir = join(config.root, config.build.outDir);
    },
    closeBundle: {
      sequential: true,
      handler () {
        try {
          sweep(outDir);
        } catch {
          // dist missing (e.g. emptyOutDir off and nothing written) - nothing to sweep.
        }
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // Same files, same precedence as Vue CLI: .env, .env.local, .env.[mode],
  // .env.[mode].local, plus any VUE_APP_* already in the shell. Only keys
  // that are actually set get a define, so an unset one stays `undefined`.
  const env = loadEnv(mode, process.cwd(), 'VUE_APP_');

  const define = {
    'process.env.VUE_APP_BUILD_TIME': JSON.stringify(buildTime),
    // Vue CLI's publicPath. registerServiceWorker.js and App.vue build URLs
    // off it.
    'process.env.BASE_URL': JSON.stringify('/'),
  };
  for (const [key, value] of Object.entries(env)) {
    define[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    base: '/',
    define,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        // Left at Vite's default (sass's legacy JS API), which is the same
        // path sass-loader 13 took with the `sass` version this repo pins
        // (1.58.3 - too old for `api: 'modern-compiler'`, which needs
        // sass >= 1.70). Same compiler, same version, same API as before, so
        // the emitted CSS is unchanged. vue.config.js had no additionalData/
        // prependData, so there is nothing else to carry over.
        scss: {},
      },
    },
    server: {
      // Vue CLI's dev server listened on 8080 on every interface (vue.config.js
      // had no devServer block, so the default stood); Matt's bookmarks and
      // phone-on-LAN checks expect that. Vite also restarts itself when .env
      // changes (the deploy-time version bump), so the old nodemon wrapper that
      // watched .env is not needed.
      port: 8080,
      host: true,
      watch: {
        // VS Code Local History snapshots - never imported, pure churn.
        ignored: ['**/.history/**'],
      },
    },
    build: {
      // Vue CLI shipped source maps for the JS bundles (productionSourceMap
      // defaults to true) and they went to S3 with everything else; keep that.
      // The service worker never precaches them (globIgnores below).
      sourcemap: true,
      // Everything non-lazy (vue, vuex, vue-router, firebase, bootstrap,
      // chart.js) lands in the one entry chunk; Vue CLI split its node_modules
      // half into chunk-vendors, Vite doesn't by default. The total is what it
      // was, so the warning threshold is raised rather than adding a manual
      // chunking rule.
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        // Naming the entry `app` (not Vite's default `index`) is what makes the
        // bundle come out as js/app.<hash>.js and the CSS as css/app.<hash>.css
        // - the webpack layout every deployed client and App.vue's update check
        // already know.
        input: {
          app: fileURLToPath(new URL('./index.html', import.meta.url)),
        },
        output: {
          // Lowercase hex, like webpack's contenthash - see the header comment.
          hashCharacters: 'hex',
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          // Same top-level folders as the webpack build: css/ and img/
          // (src/assets/images/Image_not_available.png - public/img/icons/ is
          // copied as-is, untouched by this). fonts/ is listed for the same
          // reason webpack had a fonts rule, though nothing currently emits one.
          assetFileNames: (info) => {
            const name = info.name || '';
            if (/\.css$/i.test(name)) return 'css/[name].[hash][extname]';
            if (/\.(woff2?|ttf|eot|otf)$/i.test(name)) return 'fonts/[name].[hash][extname]';
            if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)) return 'img/[name].[hash][extname]';
            return 'assets/[name].[hash][extname]';
          },
        },
      },
    },
    plugins: [
      vue(),
      dropDsStore(),
      // The service worker, one option for one with what @vue/cli-plugin-pwa
      // (workbox GenerateSW) built from the old vue.config.js. Every option
      // below was checked against the last webpack-built dist/service-worker.js:
      //
      //  - `filename: 'service-worker.js'` (not the plugin's default sw.js) is
      //    what src/registerServiceWorker.js registers and what every
      //    already-installed phone is checking for updates at. A renamed worker
      //    would leave them controlled by the old one forever.
      //  - `manifest: false` + `injectRegister: false`: the manifest is the
      //    static public/manifest.json (that plugin's generated output, copied
      //    byte-for-byte), the meta/link tags are hand-written in index.html,
      //    registration is register-service-worker in
      //    src/registerServiceWorker.js (production only). Nothing injected.
      //  - No worker on `yarn serve` (devOptions.enabled stays false), same as
      //    before.
      //
      // The old vue.config.js also carried a webpack BannerPlugin stamping
      // "Current version: x" into service-worker.js. It never reached the built
      // worker - BannerPlugin acts on webpack assets and the worker is generated
      // afterwards by the workbox plugin - so it has no replacement here. What
      // does make the worker change between deploys is its precache manifest:
      // the hashed js/app.<hash>.js + css/app.<hash>.css entries and
      // index.html's content revision, exactly as before.
      VitePWA({
        strategies: 'generateSW',
        filename: 'service-worker.js',
        registerType: 'autoUpdate',
        injectRegister: false,
        manifest: false,
        workbox: {
          // Vue CLI precached every emitted file, so the whole of dist/ -
          // index.html and manifest.json included (App.vue's update check
          // relies on index.html being precached and side-steps it with a query
          // param) - except the plugin's own defaults: source maps,
          // img/icons/, favicon.ico. The plugin's default glob is only
          // {js,css,html}, hence the explicit everything.
          globPatterns: ['**/*'],
          globIgnores: ['**/*.map', 'img/icons/**', 'favicon.ico', '**/.DS_Store'],
          // Content-hashed bundles are immutable by name (revision: null, as
          // workbox-webpack-plugin did); the copied public files get a content
          // revision so a changed file at the same URL is re-fetched.
          dontCacheBustURLsMatching: /\.[0-9a-f]{8}\.(js|css|woff2?|ttf|png|jpe?g|gif|svg|webp)$/,
          // webpack wrote every precache URL root-absolute ("/robots.txt");
          // workbox-build's glob yields "robots.txt". They resolve to the same
          // thing under a root-scoped worker, but keep the manifest
          // byte-for-byte the same shape.
          modifyURLPrefix: { '': '/' },
          // Cache-name prefix, as before (the old plugin used the package
          // name, so setCacheNameDetails({prefix:'movie-hat'})). Same prefix +
          // workbox's unchanged "precache-v2" suffix means the new worker
          // updates the existing precache in place rather than starting a
          // second one beside it.
          cacheId: 'movie-hat',
          skipWaiting: true,
          clientsClaim: true,
          // The old worker never called cleanupOutdatedCaches(); the plugin
          // defaults it on. Off, to match.
          cleanupOutdatedCaches: false,
          // The plugin's default is a precached-index.html NavigationRoute; the
          // old worker registered no navigation route at all (its
          // precacheAndRoute call is the whole of its routing). Off.
          navigateFallback: null,
          sourcemap: true,
          // Push notification handlers (public/push-sw.js) - GenerateSW mode
          // has no hand-written worker to edit, so extra behaviour rides in via
          // importScripts. The file is copied from public/ as-is, so the name
          // here must match its real path in dist/.
          importScripts: ['push-sw.js'],
          // The old worker had no runtimeCaching at all. Nothing added.
        },
      }),
    ],
  };
});
