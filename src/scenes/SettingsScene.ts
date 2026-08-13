/**
 * Einstellungen fuer Dinge, die nicht in den schnellen Spielstart gehoeren.
 *
 * Die Sprache bleibt bewusst kindgerecht: Die technische Funktion "Sync-Code"
 * heisst hier "Profil auf anderes Geraet". Der eigentliche Vergleich beider
 * Spielstaende bleibt im bestehenden Sync-Bildschirm erhalten.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Settings);
  }

  create(): void {
    SafeAreaSystem.showStatic('EINSTELLUNGEN');
    const world = getWorld(SaveSystem.load().lastWorldId);

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
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    this.add
      .text(GAME_WIDTH / 2, 140, 'EINSTELLUNGEN', textStyle(FontSize.heading, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(4);

    this.add
      .text(
        GAME_WIDTH / 2,
        190,
        'Dein Spiel und dein Profil',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    createPanel(this, GAME_WIDTH / 2, 430, GAME_WIDTH - 120, 380, world.accent, {
      alpha: 0.58,
      radius: 20,
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        300,
        'PROFIL AUF ANDERES GERAET',
        textStyle(FontSize.body, Palette.gold),
      )
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.add
      .text(
        GAME_WIDTH / 2,
        380,
        'Nimm deinen Spielstand mit auf ein anderes Handy.\nDu bekommst einen kurzen Code und entscheidest selbst,\nwelcher Spielstand behalten wird.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center');

    const transferButton = createButton(
      this,
      GAME_WIDTH / 2,
      540,
      'PROFIL UEBERTRAGEN',
      () => this.scene.start(SceneKey.Sync),
      { width: 440, height: 82, accent: world.accent, fontSize: FontSize.body },
    );

    if (!CloudSystem.isAvailable()) {
      transferButton.setEnabled(false);
      this.add
        .text(
          GAME_WIDTH / 2,
          640,
          'Die Profiluebertragung ist gerade nicht verfuegbar.',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setAlign('center');
    }

    createPanel(this, GAME_WIDTH / 2, 760, GAME_WIDTH - 120, 180, world.accent, {
      alpha: 0.5,
      radius: 20,
    });

    this.add
      .text(GAME_WIDTH / 2, 700, 'TON', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(3);

    const soundButton = createButton(
      this,
      GAME_WIDTH / 2,
      770,
      SoundSystem.isEnabled() ? 'TON: AN' : 'TON: AUS',
      () => {
        const enabled = !SoundSystem.isEnabled();
        SoundSystem.setEnabled(enabled);
        soundButton.setLabel(enabled ? 'TON: AN' : 'TON: AUS');
      },
      { width: 360, height: 70, accent: world.accent, fontSize: FontSize.body },
    );

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 120,
        'Dein Spielstand wird automatisch lokal gespeichert.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }
}
