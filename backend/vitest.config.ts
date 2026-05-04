import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/modules/evidence/**/*.ts',
        'src/modules/validation/**/*.ts',
        'src/modules/attendance/**/*.ts',
        'src/shared/network/**/*.ts',
        'src/shared/geo/**/*.ts'
      ]
    }
  }
});
