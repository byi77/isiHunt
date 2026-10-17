/**
 * Erzeugt eine UUID v4 - auch ohne sicheren Kontext.
 *
 * `crypto.randomUUID` gibt es nur in sicheren Kontexten (HTTPS, localhost).
 * Beim Testen ueber die Netzwerkadresse des Dev-Servers (http://192.168.x.x)
 * fehlt die Funktion. Am 2026-09-29 blieb deshalb auf einem iPhone jeder
 * Jagdstart stehen: `startRewardEffectRun` rief `crypto.randomUUID()` direkt
 * auf, der Fehler verschwand in einem `await`, und das Menue reagierte nicht
 * mehr. `getRandomValues` steht dagegen ueberall zur Verfuegung.
 *
 * Vorher hatten `SaveSystem`, `RewardCodeSystem` und `ProgressSyncSystem` je
 * eine eigene Kopie dieses Ersatzes, fuenf andere Stellen gar keinen.
 */
export function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Version 4 und Variante 1 nach RFC 4122 setzen.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
