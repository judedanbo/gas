import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.client': 'true',
    'import.meta.server': 'false'
  },
  test: {
    environment: 'happy-dom',
    // Test file patterns - exclude e2e tests (those use Playwright)
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Exclude patterns
    exclude: ['node_modules', 'dist', '.nuxt', 'tests/e2e/**'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'composables/**/*.ts',
        'server/utils/**/*.ts',
        'server/api/**/*.ts'
      ],
      exclude: [
        'node_modules',
        'tests',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    // Global test timeout
    testTimeout: 10000,
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    // Globals
    globals: true
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './'),
      '@': resolve(__dirname, './')
    }
  }
})
