import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// `base: './'` haelt alle Asset-Pfade relativ, damit der Build sowohl unter
// https://<user>.github.io/isiHunt/ als auch lokal per `vite preview` laeuft.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // `host: true` macht den Dev-Server im LAN erreichbar -> Test auf dem Handy.
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        // Phaser ist gross und aendert sich selten -> eigener Chunk fuers Caching.
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
