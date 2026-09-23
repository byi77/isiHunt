/** Übersicht aller Erfolge und ihres aktuellen Fortschritts. */

import Phaser from 'phaser';

import { ACHIEVEMENTS } from '@/config/achievements';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import {
  achievementCategoryLabel,
  getNextAchievement,
  getAchievementProgress,
} from '@/systems/AchievementProgressSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { createAchievementBadge } from '@/ui/achievementBadge';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createMenuLayout,
  createPanel,
  createSceneBackdrop,
} from '@/ui/widgets';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Achievements);
  }

  create(data: { page?: number } = {}): void {
    SafeAreaSystem.showStatic('ERFOLGE');
    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);

    createSceneBackdrop(this, world);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    const sections = createMenuLayout().sections;
    const unlocked = save.unlockedAchievements.filter((id) =>
      ACHIEVEMENTS.some((achievement) => achievement.id === id),
    ).length;
    this.add
      .text(
        GAME_WIDTH / 2,
        sections.next(30),
        `${unlocked} von ${ACHIEVEMENTS.length} freigeschaltet`,
        textStyle(FontSize.body, toCss(world.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    const pageSize = 10;
    const pageCount = Math.ceil(ACHIEVEMENTS.length / pageSize);
    const page = Math.min(pageCount - 1, Math.max(0, data.page ?? 0));
    const pageAchievements = ACHIEVEMENTS.slice(page * pageSize, (page + 1) * pageSize);
    const nextAchievement = getNextAchievement(ACHIEVEMENTS, save);
    const columnX = [190, 530] as const;
    const rowTop = sections.next(112);
    const rowStep = 195;
    pageAchievements.forEach((achievement, index) => {
      const column = index < 5 ? 0 : 1;
      const row = column === 0 ? index : index - 5;
      const isUnlocked = save.unlockedAchievements.includes(achievement.id);
      const accent = isUnlocked ? Palette.goldHex : 0x69738d;
      const x = columnX[column];
      const y = rowTop + row * rowStep;

      const progress = getAchievementProgress(achievement, save);
      createPanel(this, x, y, 316, 180, accent, {
        alpha: isUnlocked ? 0.58 : 0.38,
        radius: 14,
      });
      createAchievementBadge(
        this,
        x - 131,
        y - 4,
        progress.category,
        achievement.rank,
        isUnlocked,
        22,
      );

      // Der Rahmen folgt der gemessenen Schriftbreite. Mit fester Breite von
      // 92 px lief schon "RANG 1 · +20" hinaus - die Breite haengt an Rang,
      // Praemie und der Systemschrift des Geraets, keiner davon ist fest.
      const rankLabel = this.add
        .text(
          x - 94,
          y - 64,
          `RANG ${achievement.rank} · +${achievement.coinReward}`,
          textStyle(FontSize.tiny, isUnlocked ? Palette.gold : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5);
      const rankBadge = this.add.graphics();
      rankBadge.fillStyle(isUnlocked ? Palette.goldHex : 0x69738d, isUnlocked ? 0.2 : 0.16);
      rankBadge.lineStyle(1.5, isUnlocked ? Palette.goldHex : 0x69738d, 0.75);
      const rankWidth = Math.ceil(rankLabel.width) + 20;
      rankBadge.fillRoundedRect(x - 104, y - 78, rankWidth, 28, 8);
      rankBadge.strokeRoundedRect(x - 104, y - 78, rankWidth, 28, 8);
      // Der Rahmen entsteht nach der Schrift, muss aber unter ihr liegen.
      rankLabel.setDepth(1);
      const categoryLabel = this.add
        .text(
          x + 140,
          y - 64,
          nextAchievement?.id === achievement.id
            ? 'NÄCHSTES ZIEL'
            : achievementCategoryLabel(progress.category),
          textStyle(
            FontSize.tiny,
            nextAchievement?.id === achievement.id || isUnlocked ? Palette.gold : Palette.inkDim,
            {
              fontStyle: 'bold',
            },
          ),
        )
        .setOrigin(1, 0.5);
      // Rangrahmen und Kategorie teilen sich eine Zeile. Wird es eng - etwa
      // "NAECHSTES ZIEL" neben einer dreistelligen Praemie -, gibt die
      // Kategorie nach: Der Rang ist die haeufiger gesuchte Angabe.
      const categoryRoom = x + 140 - (x - 104 + rankWidth + 8);
      if (categoryLabel.width > categoryRoom) {
        categoryLabel.setFontSize(Math.floor((FontSize.tiny * categoryRoom) / categoryLabel.width));
      }
      const nameText = this.add
        .text(
          x - 102,
          y - 35,
          achievement.name,
          textStyle(FontSize.tiny, isUnlocked ? Palette.ink : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(230);
      // Bei freigeschalteten Erfolgen ist die Beschreibung Bestaetigung, bei
      // gesperrten das eigentliche Ziel - in beiden Faellen keine Dekoration,
      // die neben Rang und Name verblasst. Nur der Name-Farbverlauf oben
      // bleibt als alleiniges Sperr-Signal.
      //
      // Die Beschreibung folgt direkt unter der tatsaechlichen Namenshoehe
      // (nameText.height nach dem Zeilenumbruch), statt mit festem Versatz zu
      // rechnen - ein zweizeiliger Name wuerde sonst von der Beschreibung
      // ueberlappt.
      this.add
        .text(
          x - 102,
          nameText.y + nameText.height + 3,
          achievement.description,
          textStyle(FontSize.tiny, isUnlocked ? Palette.ink : Palette.inkDim),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(230)
        .setLineSpacing(2);
      this.add
        .text(
          x - 102,
          y + 66,
          progress.trackable ? `FORTSCHRITT  ${progress.label}` : progress.label,
          textStyle(14, isUnlocked ? Palette.gold : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(230);
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
