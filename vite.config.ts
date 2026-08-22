import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

// Version aus der package.json ins Spiel reichen. Sie wird bei jedem Commit
// hochgezaehlt (scripts/bump-version.mjs) und steht unten rechts auf dem
// Bildschirm - damit beim Test auf dem Handy sofort klar ist, ob der neue
// Stand geladen wurde oder noch der alte im Cache haengt.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

/**
 * Legt eine `version.json` neben die `index.html`.
 *
 * Die eingebaute Versionsnummer (`__APP_VERSION__`) sagt, welcher Stand
 * GELADEN wurde. Diese Datei sagt, welcher Stand VERFUEGBAR ist. Erst der
 * Vergleich beider deckt einen haengenden Cache auf - und genau das braucht
 * die App vom Home-Bildschirm, wo es weder Adressleiste noch Reload-Knopf gibt.
 *
 * Bewusst eine eigene kleine Datei und nicht die index.html: Sie laesst sich
 * mit einem Cache-Buster laden, ohne das Spiel neu zu starten.
 */
function versionManifest(): Plugin {
  return {
    name: 'isihunt-version-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      void bundle;
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2),
      });
    },
  };
}

// `base: './'` haelt alle Asset-Pfade relativ, damit der Build sowohl unter
// https://<user>.github.io/isiHunt/ als auch lokal per `vite preview` laeuft.
export default defineConfig({
  base: './',
  plugins: [versionManifest()],
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
    // Keine Sourcemaps im Deploy: sie machten 15 der 21 MB in `dist` aus.
    // Der Browser laedt sie zwar erst beim Oeffnen der DevTools, aber sie
    // belasten Deploy-Dauer und das Pages-Kontingent ohne Gegenwert.
    // Zum Nachstellen eines Fehlers genuegt ein lokaler Build mit `true`.
    sourcemap: false,
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
