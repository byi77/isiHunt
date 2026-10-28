/**
 * Laeuft das Spiel in der nativen App-Huelle (Capacitor, ADR-0015)?
 *
 * Bewusst ohne Import von `@capacitor/core`: Die native Huelle legt
 * `window.Capacitor` selbst an, bevor das Bundle laeuft. Der Web-Build bleibt
 * so frei von Capacitor-Code, und im Browser ist die Antwort ohne jede
 * Abhaengigkeit `false`.
 */
export function isNativeApp(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}
