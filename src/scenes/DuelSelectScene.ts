/** Auswahl des Gegners vor einem Duell. */

import Phaser from 'phaser';

import { CHALLENGE_BOT_DEFAULT_DIFFICULTY } from '@/config/challenge';
import { GAME_WIDTH } from '@/config/GameConfig';
import { DEFAULT_WORLD_ID, getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createSpatialPlanet } from '@/ui/spatialPlanet';
import { planetTextureForVariant } from '@/ui/textures';
import { createBackButton, createButton, createPanel, createSceneBackdrop } from '@/ui/widgets';

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
        'WÄHLE GEGNER',
        textStyle(FontSize.heading, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.add
      .text(
        GAME_WIDTH / 2,
        212,
        `Welt: ${world.name}`,
        textStyle(FontSize.small, toCss(world.accent)),
      )
      .setOrigin(0.5);

    createSpatialPlanet(
      this,
      GAME_WIDTH / 2,
      290,
      120,
      world.spaceVariant,
      false,
      undefined,
      planetTextureForVariant(world.spaceVariant),
    );

    // Zwei Karten, je Gegner eine. Bis 28.10.2026 stand der Bot-Knopf in der
    // Karte "Online-Duell - Spiele online mit zwei bis vier Spielern" und
    // gehoerte damit scheinbar dazu.
    this.buildOpponentCard(
      470,
      'ONLINE',
      'Zwei bis vier Spieler, jeder auf seinem Gerät.',
      'Online-Duell',
      () => this.scene.start(SceneKey.OnlineDuel, { worldId: world.id }),
    );
    this.buildOpponentCard(
      730,
      'BOT',
      'Ein Lauf gegen einen mittelstarken Bot.',
      'Gegen Bot',
      () => void this.startBotChallenge(world.id),
    );

    createBackButton(this, () => this.scene.start(SceneKey.Menu));
  }

  private buildOpponentCard(
    centerY: number,
    title: string,
    description: string,
    action: string,
    onClick: () => void,
  ): void {
    const height = 230;
    const top = centerY - height / 2;
    createPanel(this, GAME_WIDTH / 2, centerY, GAME_WIDTH - 100, height, Palette.panelBorder, {
      alpha: 0.28,
    });
    this.add
      .text(
        GAME_WIDTH / 2,
        top + 40,
        title,
        textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.add
      .text(GAME_WIDTH / 2, top + 82, description, textStyle(FontSize.small, Palette.inkDim))
      .setOrigin(0.5);
    createButton(this, GAME_WIDTH / 2, top + 160, action, onClick, {
      width: 430,
      height: 92,
      fontSize: FontSize.large,
    });
  }

  private async startBotChallenge(worldId: string): Promise<void> {
    let botMatchId: string | undefined;
    if (AuthSystem.isSignedIn()) {
      const started = await CloudSystem.startBotMatch();
      if (started.ok) botMatchId = started.value;
    }
    if (!this.scene.isActive()) return;
    ChallengeSystem.startBot(worldId, CHALLENGE_BOT_DEFAULT_DIFFICULTY, undefined, botMatchId);
    this.scene.start(SceneKey.Challenge);
  }
}
