import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['bridge/src/**/*.test.ts'],
  },
});
