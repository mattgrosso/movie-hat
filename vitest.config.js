// Vitest, following Cinema Roll's setup but pared down: the tests here
// cover the pure logic that guards the data — key transforms, index
// building, backup retention and freshness — none of which needs a DOM, so
// there is no jsdom and no Vue plugin until a component test needs them.
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
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
