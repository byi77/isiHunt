/** Auswahl der Besetzung vor einem Duell. */

import Phaser from 'phaser';

import {
  CHALLENGE_BOT_DEFAULT_DIFFICULTY,
  CHALLENGE_MAX_PLAYER_COUNT,
  CHALLENGE_MIN_PLAYER_COUNT,
} from '@/config/challenge';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { DEFAULT_WORLD_ID, getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createButton, createPanel, createSceneBackdrop } from '@/ui/widgets';

interface DuelSelectSceneData {
  worldId?: string;
}

export class DuelSelectScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.DuelSelect);
  }

  create(data: DuelSelectSceneData = {}): void {
    const world = getWorld(data.worldId ?? SaveSystem.load().lastWorldId ?? DEFAULT_WORLD_ID);

    SafeAreaSystem.showStatic('DUELL');
    createSceneBackdrop(this, world);

    this.add
      .text(
        GAME_WIDTH / 2,
        150,
        'DUELL',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.add
      .text(
        GAME_WIDTH / 2,
        212,
        `Welt: ${world.name}  |  WER SPIELT?`,
        textStyle(FontSize.small, toCss(world.accent)),
      )
      .setOrigin(0.5);

    createPanel(this, GAME_WIDTH / 2, 610, GAME_WIDTH - 100, 680, world.accent, {
      alpha: 0.28,
    });
    this.add
      .text(
        GAME_WIDTH / 2,
        315,
        'AN EINEM GERÄT',
        textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        355,
        'Jeder spielt dieselbe Reliktfolge.',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    const countY = 455;
    const countGap = 190;
    for (
      let playerCount = CHALLENGE_MIN_PLAYER_COUNT;
      playerCount <= CHALLENGE_MAX_PLAYER_COUNT;
      playerCount += 1
    ) {
      createButton(
        this,
        GAME_WIDTH / 2 + (playerCount - 3) * countGap,
        countY,
        `${playerCount} SPIELER`,
        () => {
          ChallengeSystem.start(world.id, undefined, playerCount);
          this.scene.start(SceneKey.Challenge);
        },
        { width: 166, height: 86, accent: world.accent, fontSize: FontSize.small },
      );
    }

    createButton(
      this,
      GAME_WIDTH / 2,
      620,
      'GEGEN BOT',
      () => {
        ChallengeSystem.startBot(world.id, CHALLENGE_BOT_DEFAULT_DIFFICULTY);
        this.scene.start(SceneKey.Challenge);
      },
      { width: 430, height: 92, accent: Palette.goldHex, fontSize: FontSize.large },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      770,
      'ONLINE-SPIELER',
      () => this.scene.start(SceneKey.OnlineDuel, { worldId: world.id }),
      { width: 430, height: 92, accent: 0x38bdf8, fontSize: FontSize.body },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 76,
      'ZURUECK',
      () => this.scene.start(SceneKey.Menu),
      { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
  }
}
