/**
 * Der Laden: hier werden Muenzen wieder ausgegeben.
 *
 * Noch ohne Ware. Der Bildschirm existiert bereits, damit der SHOP-Knopf im
 * Menue nicht ins Leere fuehrt und die Navigation (Menue -> Shop -> zurueck)
 * schon getestet werden kann. Die Skins und Boosts kommen als eigener
 * Schritt - Planung in `docs/ROADMAP.md`.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Shop);
  }

  create(): void {
    SafeAreaSystem.showStatic('SHOP');
    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, world.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    const guthabenY = 250;
    createPanel(this, GAME_WIDTH / 2, guthabenY, GAME_WIDTH - 120, 120, Palette.goldHex, {
      alpha: 0.58,
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        guthabenY - 22,
        'DEIN GUTHABEN',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        guthabenY + 18,
        save.coins.toLocaleString('de-DE'),
        textStyle(FontSize.large, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 40,
        'Hier gibt es bald etwas zu kaufen.',
        textStyle(FontSize.body, Palette.ink),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 90,
        'Neue Anzüge für deine Lichtgestalt\nund Boosts für die nächste Jagd.',
        textStyle(FontSize.small, Palette.inkDim, { align: 'center' }),
      )
      .setOrigin(0.5);

    createBackButton(this, () => this.scene.start(SceneKey.Menu));
  }
}
