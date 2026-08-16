/**
 * Einstellungen für Dinge, die nicht in den schnellen Spielstart gehören.
 *
 * Die Sprache bleibt bewusst kindgerecht: Die technische Funktion "Sync-Code"
 * heisst hier "Profil auf anderes Gerät". Der eigentliche Vergleich beider
 * Spielstaende bleibt im bestehenden Sync-Bildschirm erhalten.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
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

    createPanel(this, GAME_WIDTH / 2, 390, GAME_WIDTH - 120, 330, world.accent, {
      alpha: 0.58,
      radius: 20,
    });

    this.add
      .text(GAME_WIDTH / 2, 275, 'PROFIL & SYNCHRONISATION', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.add
      .text(
        GAME_WIDTH / 2,
        340,
        'Melde dich auf iPhone und iPad mit demselben Profil an.\nOhne Login bleibt dein Spiel vollständig offline nutzbar.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center');

    const accountButton = createButton(
      this,
      GAME_WIDTH / 2,
      465,
      AuthSystem.isSignedIn() ? 'PROFIL ÖFFNEN' : 'ANMELDEN / PROFIL ANLEGEN',
      () => this.scene.start(SceneKey.Account),
      { width: 460, height: 76, accent: world.accent, fontSize: FontSize.small },
    );

    if (!AuthSystem.isConfigured()) {
      accountButton.setEnabled(false);
      this.add
        .text(
          GAME_WIDTH / 2,
          530,
          'Das Online-Profil ist gerade nicht verfügbar.',
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

    createPanel(this, GAME_WIDTH / 2, 985, GAME_WIDTH - 120, 240, world.accent, {
      alpha: 0.5,
      radius: 20,
    });

    this.add
      .text(GAME_WIDTH / 2, 900, 'IMPRESSUM', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(3);

    this.add
      .text(
        GAME_WIDTH / 2,
        942,
        'PROGRAMMIERT VON  YAVUZ ISIK',
        textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        1025,
        'BESONDERER DANK AN EMRE UND SIMAY\n' +
          'Für eure aussergewöhnliche Unterstützung bei der Planung,\n' +
          'mit Vorschlägen und Ideen, beim Testen und Bugfixen.\n' +
          'Eure Neugier und ehrlichen Rückmeldungen machen isiHunt\n' +
          'mutiger, schöner und immer ein bisschen besser.',
        textStyle(FontSize.small, Palette.inkDim, { lineSpacing: 3 }),
      )
      .setOrigin(0.5)
      .setAlign('center');

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 180,
        'Dein Spielstand wird automatisch lokal gespeichert.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }
}
