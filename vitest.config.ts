/**
 * Testkonfiguration, bewusst getrennt von `vite.config.ts`.
 *
 * Die Testeinstellungen standen zunaechst als `test`-Block in der Vite-Config.
 * Manuell lief das; im `pre-push`-Hook brach Vitest dagegen reproduzierbar mit
 * "failed to find the runner" ab - eine der Ursachen, die Vitest dafuer selbst
 * nennt, ist ein Vitest-Bezug in der Vite-Konfigurationsdatei. Eine eigene
 * Datei laesst die Vite-Config unberuehrt und beendet das Problem.
 *
 * `mergeConfig` uebernimmt Alias (`@`) und `define` (`__APP_VERSION__`) aus der
 * Vite-Config - beides brauchen die Tests, und beides soll nur an einer Stelle
 * gepflegt werden.
 */

import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // `jsdom` statt `node`, weil SaveSystem auf `window.localStorage`
      // zugreift. Die Tests laufen damit gegen die echte Persistenz statt
      // gegen Attrappen.
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
    },
  }),
);
