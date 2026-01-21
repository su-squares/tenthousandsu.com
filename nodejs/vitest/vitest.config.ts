import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const toPosix = (p: string) => p.replace(/\\/g, '/');

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
      allowExternal: true,
      reportsDirectory: path.resolve(repoRoot, 'coverage'),
      include: [
        toPosix(path.resolve(repoRoot, 'assets/web3/**/*.js')),
        toPosix(path.resolve(repoRoot, 'assets/billboard/**/*.js')),
        toPosix(path.resolve(repoRoot, 'assets/js/asset-base.js')),
        toPosix(path.resolve(repoRoot, 'assets/js/link-utils.js')),
        toPosix(path.resolve(repoRoot, 'assets/modals/**/*.js'))
      ],
      exclude: [
        toPosix(path.resolve(repoRoot, 'assets/web3/vendor/**')),
        toPosix(path.resolve(repoRoot, 'assets/web3/**/*.test.js')),
        toPosix(path.resolve(repoRoot, 'assets/web3/**/*.spec.js')),
        toPosix(path.resolve(repoRoot, 'assets/web3/config/runtime.generated.js')),
        toPosix(path.resolve(repoRoot, 'assets/billboard/**/*.test.js')),
        toPosix(path.resolve(repoRoot, 'assets/billboard/**/*.spec.js'))
      ],
      all: true,
      thresholds: {
        lines: 80,
        functions: 75,
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
