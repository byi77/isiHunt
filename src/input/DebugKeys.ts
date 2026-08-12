/**
 * Tastenkuerzel zum Testen am Rechner.
 *
 * NUR im Dev-Build aktiv (`DEBUG_ENABLED`, siehe GameConfig.ts). Im
 * Production-Build wird diese Klasse nie instanziiert, die Tasten existieren
 * dort schlicht nicht.
 *
 * Belegung (auch in README.md dokumentiert):
 *   1 - 6  Relikt der jeweiligen Seltenheit sofort spawnen (1 = schlicht ... 6 = legendaer)
 *   L      Ein Charakterlevel gewaehren
 *   K      +10 Sekunden Restzeit
 *   J      Run sofort beenden
 *   P      Pause an/aus
 *   0      Spielstand komplett zuruecksetzen
 */

import Phaser from 'phaser';

import { RARITIES } from '@/config/rarities';
import type { RarityDef } from '@/config/rarities';

export interface DebugActions {
  spawnRarity(rarity: RarityDef): void;
  grantLevel(): void;
  addTime(ms: number): void;
  endRun(): void;
  togglePause(): void;
  resetSave(): void;
}

export class DebugKeys {
  constructor(scene: Phaser.Scene, actions: DebugActions) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;

    const Codes = Phaser.Input.Keyboard.KeyCodes;
    const digitCodes = [Codes.ONE, Codes.TWO, Codes.THREE, Codes.FOUR, Codes.FIVE, Codes.SIX];

    digitCodes.forEach((code, index) => {
      keyboard.addKey(code).on('down', () => {
        const rarity = RARITIES[index];
        if (rarity) actions.spawnRarity(rarity);
      });
    });

    keyboard.addKey(Codes.L).on('down', () => actions.grantLevel());
    keyboard.addKey(Codes.K).on('down', () => actions.addTime(10_000));
    keyboard.addKey(Codes.J).on('down', () => actions.endRun());
    keyboard.addKey(Codes.P).on('down', () => actions.togglePause());
    keyboard.addKey(Codes.ZERO).on('down', () => actions.resetSave());
  }
}
