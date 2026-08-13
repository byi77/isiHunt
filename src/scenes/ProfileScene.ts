/**
 * Profilbildschirm.
 *
 * Der Name gehoert zum Spieler und nicht zur Bestenliste. Beim ersten Start
 * ist er Pflicht, spaeter kann er hier jederzeit geaendert werden. Das Icon
 * ist bewusst die Lichtfigur aus dem Spiel - kein zweites Avatar-System fuer
 * eine Information, die bereits eine klare visuelle Sprache hat.
 */

import Phaser from 'phaser';

import { PLAYER_NAME_MAX_LENGTH } from '@/config/backend';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { playerTextureForLevel, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

export interface ProfileSceneData {
  firstStart?: boolean;
}

export class ProfileScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Profile);
  }

  create(data: ProfileSceneData = {}): void {
    const save = SaveSystem.load();
    const firstStart = data.firstStart ?? false;
    const world = getWorld(save.lastWorldId);
    const levelProgress = ProgressionSystem.getLevelProgress(save);

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

    if (!firstStart) createBackButton(this, () => this.scene.start(SceneKey.Menu));

    this.add
      .text(
        GAME_WIDTH / 2,
        firstStart ? 132 : 140,
        firstStart ? 'WILLKOMMEN' : 'DEIN PROFIL',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);

    this.add
      .text(
        GAME_WIDTH / 2,
        firstStart ? 188 : 196,
        firstStart ? 'Wie soll dein Licht heissen?' : 'Name fuer Spiel und Bestenliste',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    createPanel(this, GAME_WIDTH / 2, 430, GAME_WIDTH - 120, 430, world.accent, {
      alpha: 0.62,
      radius: 20,
    });

    this.add
      .image(GAME_WIDTH / 2, 310, TextureKey.PlayerHalo)
      .setTint(world.accent)
      .setScale(1.15)
      .setAlpha(0.8);

    this.add
      .image(GAME_WIDTH / 2, 310, playerTextureForLevel(save.level))
      .setTint(Palette.goldHex)
      .setScale(0.82);

    this.add
      .text(GAME_WIDTH / 2, 505, 'DEIN NAME', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(5);

    this.add
      .text(
        GAME_WIDTH / 2,
        410,
        `LEVEL ${levelProgress.level}`,
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0.5)
      .setLetterSpacing(2);

    this.add
      .text(
        GAME_WIDTH / 2,
        447,
        `BESTWERT ${save.bestScore.toLocaleString('de-DE')}`,
        textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        480,
        `COINS ${save.coins.toLocaleString('de-DE')}`,
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5, 0.5);

    let saveButton: ButtonHandle | null = null;
    const status = this.add
      .text(GAME_WIDTH / 2, 620, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');

    const updateButton = (): void => {
      const name = CloudSystem.sanitizePlayerName(input.getValue());
      saveButton?.setEnabled(name.length > 0);
      if (name.length > 0) status.setText('');
    };

    const saveProfile = (): void => {
      const name = CloudSystem.sanitizePlayerName(input.getValue());
      if (!name) {
        status.setText('Bitte gib einen Namen ein.').setColor(Palette.gold);
        return;
      }

      SaveSystem.setPlayerName(name);
      if (CloudSystem.isAvailable()) void CloudSystem.syncSaveSafely();
      this.scene.start(SceneKey.Menu);
    };

    const input = createTextInput(this, GAME_WIDTH / 2, 565, {
      placeholder: 'Name eingeben',
      maxLength: PLAYER_NAME_MAX_LENGTH,
      width: 420,
      accent: world.accent,
      onSubmit: saveProfile,
    });

    input.setValue(save.playerName);
    input.element.node.addEventListener('input', updateButton);
    input.element.node.addEventListener('blur', () => {
      input.setValue(CloudSystem.sanitizePlayerName(input.getValue()));
    });

    saveButton = createButton(
      this,
      GAME_WIDTH / 2,
      760,
      firstStart ? "LOS GEHT'S" : 'SPEICHERN',
      saveProfile,
      { width: 440, accent: world.accent, fontSize: FontSize.large },
    );
    updateButton();

    if (firstStart) {
      status.setText('Der Name wird in der Bestenliste angezeigt.').setColor(toCss(world.accent));
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        680,
        levelProgress.xpNeeded === 0
          ? `Level ${levelProgress.level}  ·  MAX LEVEL`
          : `Level ${levelProgress.level}  ·  ${levelProgress.xpInLevel} / ${levelProgress.xpNeeded} XP`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        830,
        firstStart
          ? 'Du kannst ihn spaeter im Profil aendern.'
          : 'Aenderungen gelten fuer neue Eintraege.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }
}
