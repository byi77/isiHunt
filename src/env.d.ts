/// <reference types="vite/client" />

/**
 * Typen fuer die eigenen Umgebungsvariablen.
 *
 * Ohne diese Deklaration waere `import.meta.env.VITE_SUPABASE_URL` vom Typ
 * `any` - Tippfehler im Variablennamen faenden erst zur Laufzeit auf, und zwar
 * als stilles "Online-Funktionen fehlen".
 *
 * Beide sind optional: das Spiel laeuft auch ohne (siehe config/backend.ts).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Versionsnummer aus der package.json, zur Bauzeit eingesetzt (vite.config.ts).
 *
 * Kein `import` der package.json: Das zoege die ganze Datei in den Build und
 * machte aus einer Zeichenkette eine Abhaengigkeit.
 */
declare const __APP_VERSION__: string;
