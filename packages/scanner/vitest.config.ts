import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15000, // WASM init can be slow
  },
});
