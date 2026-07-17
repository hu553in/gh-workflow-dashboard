import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'esnext',
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 24,
        branches: 38,
        functions: 24,
        lines: 23,
      },
    },
  },
});
