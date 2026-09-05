import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

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

/**
 * Erzeugt den Service Worker mit allen Build- und Public-Dateien als
 * Precache-Liste. Die Dateinamen der Vite-Chunks sind gehasht und können
 * deshalb nicht zuverlässig in einer statischen `public/sw.js` stehen.
 */
function offlineServiceWorker(): Plugin {
  const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
  const templatePath = fileURLToPath(new URL('./scripts/sw-template.txt', import.meta.url));

  const publicFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) return publicFiles(fullPath);
      if (entry.name === '.gitkeep') return [];
      return [relative(publicRoot, fullPath).split(sep).join('/')];
    });

  return {
    name: 'isihunt-offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // `version.json` beantwortet die Updatepruefung und darf deshalb nie
      // aus dem Cache kommen - sonst meldet eine offene App ewig ihre eigene
      // alte Version (AUDIT_2026-09-05, Befund 7). Der Service Worker haelt
      // denselben Pfad zusaetzlich aus dem Cache-first-Zweig heraus.
      const precacheUrls = [
        './',
        './index.html',
        ...Object.keys(bundle).map((fileName) => `./${fileName}`),
        ...publicFiles(publicRoot).map((fileName) => `./${fileName}`),
      ].filter((url) => url !== './version.json');
      const source = readFileSync(templatePath, 'utf8')
        .replace('__ISIHUNT_CACHE_NAME__', JSON.stringify(`isihunt-app-shell-${version}`))
        .replace('__ISIHUNT_PRECACHE_URLS__', JSON.stringify([...new Set(precacheUrls)], null, 2));

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  } satisfies Plugin;
}

// `base: './'` haelt alle Asset-Pfade relativ, damit der Build sowohl unter
// https://<user>.github.io/isiHunt/ als auch lokal per `vite preview` laeuft.
export default defineConfig({
  base: './',
  plugins: [versionManifest(), offlineServiceWorker()],
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
    // Supabase wird nur von Cloud-/Auth-Pfaden benoetigt; ein eigener Chunk
    // haelt den App-Entry unter der Warnschwelle und bleibt separat cachebar.
    chunkSizeWarningLimit: 600,
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
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
