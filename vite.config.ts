import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

// Version aus der package.json ins Spiel reichen. Sie wird bei jedem Commit
// hochgezaehlt (scripts/bump-version.mjs) und steht im Menue - damit beim Test
// auf dem Handy sofort klar ist, ob der neue Stand geladen wurde oder noch der
// alte im Cache haengt.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

// `base: './'` haelt alle Asset-Pfade relativ, damit der Build sowohl unter
// https://<user>.github.io/isiHunt/ als auch lokal per `vite preview` laeuft.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
