/**
 * Erkennt, ob eine neuere Fassung des Spiels bereitliegt.
 *
 * ## Das Problem
 *
 * Die eingebaute Versionsnummer sagt, welcher Stand **geladen** wurde. Sie sagt
 * nichts darueber, welcher Stand **verfuegbar** waere. Solange beide
 * auseinanderfallen koennen, ohne dass es jemand merkt, ist jede Rueckmeldung
 * vom Geraet unsicher - und genau daran sind vier Runden Fehlersuche
 * gescheitert (docs/CODE_STYLE.md 1.9).
 *
 * Im Browser reicht ein hartes Neuladen. Als App vom Home-Bildschirm gibt es
 * das nicht: keine Adressleiste, kein Reload-Knopf, und der Cache haelt sich
 * dort hartnaeckiger als in einem normalen Tab.
 *
 * ## Die Loesung
 *
 * Der Build legt eine `version.json` neben die `index.html`
 * (siehe `vite.config.ts`). Beim Start wird sie mit Cache-Buster geladen und
 * mit `APP_VERSION` verglichen. Weicht sie ab, kann die Oberflaeche das
 * anbieten, statt darauf zu warten, dass der Cache von selbst nachgibt.
 *
 * ## Warum das nie stoert
 *
 * Jeder Fehler wird verschluckt und als "kein Update bekannt" behandelt. Ohne
 * Netz, mit blockierter Anfrage oder ohne `version.json` (Dev-Server) verhaelt
 * sich das Spiel exakt wie vorher. Eine Aktualisierungspruefung darf niemals
 * der Grund sein, dass man nicht spielen kann.
 */

import { APP_VERSION } from '@/config/GameConfig';

export interface UpdateInfo {
  /** Version, die auf dem Server liegt. */
  readonly available: string;
  /** Version, die gerade laeuft. */
  readonly running: string;
}

/** Wie lange auf die Antwort gewartet wird, bevor aufgegeben wird. */
const TIMEOUT_MS = 4000;

/**
 * Fragt den Server nach der verfuegbaren Version.
 *
 * @returns die Info, wenn eine ANDERE Version bereitliegt - sonst `null`.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Cache-Buster im Pfad: Ohne ihn beantwortet ausgerechnet der Cache die
    // Frage, ob der Cache veraltet ist.
    const response = await fetch(`version.json?_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!response.ok) return null;

    const data: unknown = await response.json();
    const available = (data as { version?: unknown }).version;

    if (typeof available !== 'string' || available === APP_VERSION) return null;

    return { available, running: APP_VERSION };
  } catch {
    // Kein Netz, kein Server, keine Datei: kein Update bekannt. Bewusst still -
    // eine Fehlermeldung waere hier nur Laerm.
    return null;
  }
}

/**
 * Laedt das Spiel unter Umgehung des Caches neu.
 *
 * `location.reload()` genuegt auf iOS nicht zuverlaessig - der Standalone-Modus
 * beantwortet die Anfrage weiterhin aus seinem eigenen Speicher. Ein neuer
 * Suchteil in der Adresse erzeugt dagegen einen anderen Cache-Schluessel, und
 * die Seite muss frisch geholt werden.
 */
export function forceReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}
