/**
 * Einstiegspunkt: Phaser konfigurieren und starten.
 *
 * Skalierung: Das Spiel rendert immer intern in GAME_WIDTH x GAME_HEIGHT
 * (720x1280, Hochformat). Phaser skaliert das per FIT auf das Geraet und
 * zentriert es. Dadurch gilt jede Koordinate im Code auf jedem Handy gleich -
 * es gibt keine geraetabhaengigen Layout-Sonderfaelle.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { keepCanvasBoundsFresh } from '@/core/viewport';
import { BootScene } from '@/scenes/BootScene';
import { ChallengeScene } from '@/scenes/ChallengeScene';
import { GameScene } from '@/scenes/GameScene';
import { HudScene } from '@/scenes/HudScene';
import { MenuScene } from '@/scenes/MenuScene';
import { ResultScene } from '@/scenes/ResultScene';
import { Palette } from '@/ui/theme';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: Palette.backdrop,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    // Runde Pixel: verhindert flimmernde Kanten bei nicht-ganzzahliger Skalierung.
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 3,
  },
  // Ohne Physik-Engine: Kollision ist ein Distanztest (siehe GameScene).
  scene: [BootScene, MenuScene, GameScene, HudScene, ResultScene, ChallengeScene],
};

const game = new Phaser.Game(config);

// Ohne das liegen Trefferflaechen auf dem iPhone neben dem, was man sieht -
// die Begruendung steht in core/viewport.ts.
keepCanvasBoundsFresh(game);

// Im Dev-Build ueber die Browser-Konsole erreichbar (`isiHunt.scale`,
// `isiHunt.scene.getScene('Game')`). Im Production-Build entfaellt der Block.
//
// Bewusst NICHT `window.game`: Browser legen fuer jedes Element mit id einen
// gleichnamigen Verweis auf window an, und index.html enthaelt <div id="game">.
// `window.game` waere also schon belegt - der Name haette je nach Ladezeitpunkt
// mal das Spiel und mal das DIV geliefert.
if (import.meta.env.DEV) {
  (window as unknown as { isiHunt: Phaser.Game }).isiHunt = game;
}
