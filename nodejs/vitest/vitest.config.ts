import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./setup/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        '../../assets/web3/**/*.js',
        '../../assets/billboard/**/*.js',
        '../../assets/js/asset-base.js',
        '../../assets/js/link-utils.js',
        '../../assets/modals/**/*.js'
      ],
      exclude: [
        '../../assets/web3/vendor/**',
        '../../assets/web3/**/*.test.js',
        '../../assets/web3/**/*.spec.js',
        '../../assets/web3/config/runtime.generated.js',
        '../../assets/billboard/**/*.test.js',
        '../../assets/billboard/**/*.spec.js'
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    reporters: ['verbose'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    watch: false,
    retry: 0
  },
  resolve: {
    alias: {
      '@web3': path.resolve(__dirname, '../../assets/web3'),
      '@test-helpers': path.resolve(__dirname, './src/helpers'),
      '@mocks': path.resolve(__dirname, './src/mocks'),
      '@fixtures': path.resolve(__dirname, './src/fixtures'),
      '@billboard': path.resolve(__dirname, '../../assets/billboard'),
      '@modals': path.resolve(__dirname, '../../assets/modals'),
      '@square-lookup': path.resolve(__dirname, '../../assets/square-lookup'),
      '@assets-js': path.resolve(__dirname, '../../assets/js')
    }
  }
});
