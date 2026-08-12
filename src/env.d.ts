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
