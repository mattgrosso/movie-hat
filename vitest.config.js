// Vitest, following Cinema Roll's setup but pared down: the tests here
// cover the pure logic that guards the data — key transforms, index
// building, backup retention and freshness — none of which needs a DOM.
// The default environment stays `node`; a component test opts into jsdom
// with `// @vitest-environment jsdom` at its top (WhereToWatch.test.mjs was
// the first, 2026-09-16), which is also when the Vue plugin arrived.
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.{js,mjs}'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
