/** Übersicht aller Erfolge und ihres aktuellen Fortschritts. */

import Phaser from 'phaser';

import { ACHIEVEMENTS } from '@/config/achievements';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Achievements);
  }

  create(): void {
    SafeAreaSystem.showStatic('ERFOLGE');
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
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    this.add
      .text(
        GAME_WIDTH / 2,
        118,
        'ERFOLGE',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(4);

    const unlocked = save.unlockedAchievements.filter((id) =>
      ACHIEVEMENTS.some((achievement) => achievement.id === id),
    ).length;
    this.add
      .text(
        GAME_WIDTH / 2,
        165,
        `${unlocked} von ${ACHIEVEMENTS.length} freigeschaltet`,
        textStyle(FontSize.small, toCss(world.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    const columnX = [190, 530] as const;
    const rowTop = 250;
    const rowStep = 112;
    ACHIEVEMENTS.forEach((achievement, index) => {
      const column = index < 8 ? 0 : 1;
      const row = column === 0 ? index : index - 8;
      const isUnlocked = save.unlockedAchievements.includes(achievement.id);
      const accent = isUnlocked ? Palette.goldHex : 0x69738d;
      const x = columnX[column];
      const y = rowTop + row * rowStep;

      createPanel(this, x, y, 316, 92, accent, { alpha: isUnlocked ? 0.58 : 0.38, radius: 14 });
      this.add
        .text(x - 136, y - 27, isUnlocked ? '✓' : '○', textStyle(FontSize.body, toCss(accent)))
        .setOrigin(0, 0.5);
      this.add
        .text(
          x - 102,
          y - 25,
          achievement.name,
          textStyle(FontSize.tiny, isUnlocked ? Palette.ink : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(230);
      this.add
        .text(x - 102, y + 14, achievement.description, textStyle(14, Palette.inkDim))
        .setOrigin(0, 0.5)
        .setWordWrapWidth(230)
        .setLineSpacing(2);
    });
  }
}
