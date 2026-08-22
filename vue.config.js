const { defineConfig } = require('@vue/cli-service');
const webpack = require('webpack');

// The build stamp (see src/utils/buildStamp.js). Set here, at config
// evaluation, so it names the moment THIS build ran rather than the moment
// the page was loaded — a tab left open for a week keeps showing the build
// it is still running. vue-cli inlines every VUE_APP_* var it finds on
// process.env when it resolves the client env, which happens after this
// file is read, so assigning it here is enough — it deliberately does not
// live in .env, which the version bumper rewrites.
process.env.VUE_APP_BUILD_TIME = new Date().toISOString();

module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    plugins: [
      new webpack.BannerPlugin({
        banner: `Current version: ${process.env.VUE_APP_VERSION}`,
        raw: true,
        entryOnly: true,
        include: /service-worker\.js$/,
      }),
    ],
  },
  pwa: {
    name: 'Movie Hat',
    themeColor: '#ffffff',
    msTileColor: '#ffffff',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    manifestOptions: {
      display: 'standalone',
      background_color: '#ffffff',
      icons: [
        {
          src: './img/icons/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: './img/icons/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: "./img/icons/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ],
    },
    workboxOptions: {
      skipWaiting: true,
      clientsClaim: true,
    },
  },
})