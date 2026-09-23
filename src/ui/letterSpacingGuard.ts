/**
 * Schutz fuer Emojis in Texten mit Buchstabenabstand.
 *
 * Phaser zeichnet Text mit `letterSpacing` Zeichen fuer Zeichen und zerlegt
 * die Zeile dafuer per `split('')` - in UTF-16-Einheiten, nicht in Zeichen
 * (Text.js, `updateText`). Alles ausserhalb der Grundebene, also fast jedes
 * Emoji, besteht aus zwei solchen Einheiten und erscheint dann als "��".
 * So geschehen in der Weltinfo mit 💥 und 🎁 (2026-09-24).
 *
 * Statt jede der rund vierzig Stellen mit Buchstabenabstand einzeln zu
 * bewachen - und bei jeder neuen daran zu denken -, setzt dieser Schutz den
 * Abstand fuer genau die Dauer eines Neuaufbaus auf 0, wenn der Text ein
 * solches Paar enthaelt. Der Text verliert dann seinen Abstand, das Emoji
 * bleibt heil. Das gilt auch fuer Texte, die erst zur Laufzeit ankommen
 * (Namen von Kampagnen oder Belohnungen vom Server).
 */

import Phaser from 'phaser';

/** Enthaelt der Text ein Surrogatpaar, also ein Zeichen ausserhalb der Grundebene? */
export function hasAstralCharacter(text: string): boolean {
  return /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(text);
}

let installed = false;

export function installLetterSpacingGuard(): void {
  if (installed) return;
  installed = true;
  const prototype = Phaser.GameObjects.Text.prototype as unknown as {
    updateText: (this: Phaser.GameObjects.Text) => Phaser.GameObjects.Text;
  };
  const original = prototype.updateText;
  prototype.updateText = function (this: Phaser.GameObjects.Text) {
    if (this.letterSpacing === 0 || !hasAstralCharacter(this.text ?? '')) {
      return original.call(this);
    }
    const spacing = this.letterSpacing;
    this.letterSpacing = 0;
    try {
      return original.call(this);
    } finally {
      this.letterSpacing = spacing;
    }
  };
}
