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
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Achievements);
  }

  create(data: { page?: number } = {}): void {
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
        textStyle(FontSize.body, toCss(world.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    const pageSize = 10;
    const pageCount = Math.ceil(ACHIEVEMENTS.length / pageSize);
    const page = Math.min(pageCount - 1, Math.max(0, data.page ?? 0));
    const pageAchievements = ACHIEVEMENTS.slice(page * pageSize, (page + 1) * pageSize);
    const columnX = [190, 530] as const;
    const rowTop = 285;
    const rowStep = 145;
    pageAchievements.forEach((achievement, index) => {
      const column = index < 5 ? 0 : 1;
      const row = column === 0 ? index : index - 5;
      const isUnlocked = save.unlockedAchievements.includes(achievement.id);
      const accent = isUnlocked ? Palette.goldHex : 0x69738d;
      const x = columnX[column];
      const y = rowTop + row * rowStep;

      createPanel(this, x, y, 316, 112, accent, { alpha: isUnlocked ? 0.58 : 0.38, radius: 14 });
      this.add
        .text(x - 136, y - 27, isUnlocked ? '✓' : '○', textStyle(FontSize.body, toCss(accent)))
        .setOrigin(0, 0.5);
      this.add
        .text(
          x - 102,
          y - 25,
          `RANG ${achievement.rank} · ${achievement.name}`,
          textStyle(FontSize.tiny, isUnlocked ? Palette.ink : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(230);
      this.add
        .text(x - 102, y + 17, achievement.description, textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0, 0.5)
        .setWordWrapWidth(230)
        .setLineSpacing(2);
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 190,
        `SEITE ${page + 1} / ${pageCount}`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    const previous = createButton(
      this,
      GAME_WIDTH / 2 - 145,
      GAME_HEIGHT - 190,
      '‹',
      () => this.scene.restart({ page: page - 1 }),
      { width: 76, height: 64, accent: world.accent, fontSize: FontSize.heading },
    );
    previous.setEnabled(page > 0);

    const next = createButton(
      this,
      GAME_WIDTH / 2 + 145,
      GAME_HEIGHT - 190,
      '›',
      () => this.scene.restart({ page: page + 1 }),
      { width: 76, height: 64, accent: world.accent, fontSize: FontSize.heading },
    );
    next.setEnabled(page < pageCount - 1);
  }
}
