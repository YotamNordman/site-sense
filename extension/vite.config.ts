import { defineConfig } from 'vite';
import { resolve } from 'path';

const outDir = resolve(__dirname, '../dist/extension');

// Shared config for all entries
const shared = {
  outDir,
  emptyOutDir: false,
  sourcemap: false,
  target: 'chrome120' as const,
};

// Build each entry as a standalone IIFE (no imports at runtime)
// Called separately: vite build --config ... --mode <entry>
const entries: Record<string, string> = {
  background: resolve(__dirname, 'src/background/index.ts'),
  content: resolve(__dirname, 'src/content/index.ts'),
  inject: resolve(__dirname, 'src/inject/capture.ts'),
  popup: resolve(__dirname, 'src/popup/index.ts'),
};

const entry = process.env.ENTRY || 'background';

export default defineConfig({
  resolve: {
    alias: {
      '../../shared': resolve(__dirname, '../shared'),
    },
  },
  build: {
    ...shared,
    emptyOutDir: entry === 'background', // only first build clears
    lib: {
      entry: entries[entry],
      name: entry,
      fileName: () => `${entry}.js`,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
