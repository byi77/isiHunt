/**
 * Prueft, ob der Browser WebGL bereitstellt, und erklaert es sonst im DOM.
 *
 * Seit Phaser 4 laeuft isiHunt nur noch unter WebGL (ADR-0035): Masken,
 * Leuchten und alle neuen Effekte sind Filter, die es im Canvas-Renderer
 * nicht gibt. Ohne diese Pruefung saehe ein Geraet ohne WebGL nur einen
 * schwarzen Bildschirm. Der Hinweis steht im DOM, weil Phaser dann gar nicht
 * erst startet - wie die Versionsnummer.
 */

export function supportsWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export const NO_WEBGL_MESSAGE =
  'Dein Browser stellt kein WebGL bereit. isiHunt braucht es zum Zeichnen. ' +
  'Bitte die Hardwarebeschleunigung einschalten oder einen aktuellen Browser nutzen.';

/** Ersetzt den Ladehinweis durch die Erklaerung. */
export function showNoWebGL(doc: Document = document): void {
  const boot = doc.getElementById('boot');
  if (!boot) return;
  boot.textContent = NO_WEBGL_MESSAGE;
  // Der Ladehinweis ist als einzeilige Versalzeile gestaltet; ein ganzer Satz
  // braucht normale Schreibung und Rand.
  boot.style.textTransform = 'none';
  boot.style.letterSpacing = 'normal';
  boot.style.padding = '0 24px';
  boot.style.textAlign = 'center';
  boot.setAttribute('role', 'alert');
}
