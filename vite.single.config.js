import { defineConfig } from 'vite';
/**
 * Build variant that emits exactly one JS file and one CSS file, so
 * `scripts/build-single.mjs` can inline everything into a portable HTML file.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
