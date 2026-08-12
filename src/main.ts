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
import { BootScene } from '@/scenes/BootScene';
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
  scene: [BootScene, MenuScene, GameScene, HudScene, ResultScene],
};

const game = new Phaser.Game(config);

// Im Dev-Build ueber die Browser-Konsole erreichbar (`game.scale`, `game.scene`).
// Im Production-Build entfaellt der Block vollstaendig.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
