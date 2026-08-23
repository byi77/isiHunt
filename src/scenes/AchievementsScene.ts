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
    const rowStep = 145;
    pageAchievements.forEach((achievement, index) => {
      const column = index < 5 ? 0 : 1;
      const row = column === 0 ? index : index - 5;
      const isUnlocked = save.unlockedAchievements.includes(achievement.id);
      const accent = isUnlocked ? Palette.goldHex : 0x69738d;
      const x = columnX[column];
      const y = rowTop + row * rowStep;

      const progress = getAchievementProgress(achievement, save);
      createPanel(this, x, y, 316, 124, accent, {
        alpha: isUnlocked ? 0.58 : 0.38,
        radius: 14,
      });
      addTrophy(this, x - 134, y - 4, isUnlocked);

      const rankBadge = this.add.graphics();
      rankBadge.fillStyle(isUnlocked ? Palette.goldHex : 0x69738d, isUnlocked ? 0.2 : 0.16);
      rankBadge.lineStyle(1.5, isUnlocked ? Palette.goldHex : 0x69738d, 0.75);
      rankBadge.fillRoundedRect(x - 104, y - 49, 92, 28, 8);
      rankBadge.strokeRoundedRect(x - 104, y - 49, 92, 28, 8);

      this.add
        .text(
          x - 94,
          y - 35,
          `RANG ${achievement.rank} · +${achievement.coinReward}`,
          textStyle(FontSize.small, isUnlocked ? Palette.gold : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5);
      if (nextAchievement?.id === achievement.id) {
        this.add
          .text(
            x + 8,
            y - 13,
            'NÄCHSTES ZIEL',
            textStyle(FontSize.tiny, Palette.gold, { fontStyle: 'bold' }),
          )
          .setOrigin(0, 0.5);
      }
      this.add
        .text(
          x + 8,
          y - 35,
          achievementCategoryLabel(progress.category),
          textStyle(FontSize.tiny, isUnlocked ? Palette.gold : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5);
      const nameText = this.add
        .text(
          x - 102,
          y - 6,
          achievement.name,
          textStyle(FontSize.small, isUnlocked ? Palette.ink : Palette.inkDim, {
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
          nameText.y + nameText.height + 2,
          achievement.description,
          textStyle(FontSize.tiny, isUnlocked ? Palette.ink : Palette.inkDim),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(230)
        .setLineSpacing(2);
      this.add
        .text(
          x - 102,
          y + 48,
          progress.trackable ? `FORTSCHRITT  ${progress.label}` : progress.label,
          textStyle(FontSize.tiny, isUnlocked ? Palette.gold : Palette.inkDim, {
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

/** Detaillierter Pokal als Vektor-Element, damit er auf jedem Geraet sauber bleibt. */
function addTrophy(scene: Phaser.Scene, x: number, y: number, unlocked: boolean): void {
  const primary = unlocked ? 0xf0b52f : 0x69738d;
  const secondary = unlocked ? 0xb87316 : 0x4b556d;
  const highlight = unlocked ? 0xfff0a0 : 0xaeb6c7;
  const trophy = scene.add.container(x, y);

  const glow = scene.add.graphics();
  glow.fillStyle(primary, unlocked ? 0.13 : 0.06);
  glow.fillCircle(0, 0, 27);

  const shadow = scene.add.graphics();
  shadow.fillStyle(0x050817, 0.34);
  shadow.fillEllipse(0, 21, 34, 7);

  const cup = scene.add.graphics();
  cup.fillGradientStyle(highlight, primary, highlight, secondary, unlocked ? 1 : 0.78);
  cup.fillPoints(
    [
      { x: -14, y: -20 },
      { x: 14, y: -20 },
      { x: 11, y: -8 },
      { x: 7, y: 0 },
      { x: 3, y: 6 },
      { x: -3, y: 6 },
      { x: -7, y: 0 },
      { x: -11, y: -8 },
    ],
    true,
  );
  cup.fillStyle(primary, unlocked ? 1 : 0.78);
  cup.fillRoundedRect(-16, -23, 32, 5, 2);
  cup.fillGradientStyle(primary, secondary, primary, secondary, unlocked ? 1 : 0.78);
  cup.fillRoundedRect(-4, 5, 8, 11, 2);
  cup.fillRoundedRect(-10, 14, 20, 5, 2);
  cup.fillRoundedRect(-17, 19, 34, 6, 2);

  cup.lineStyle(4, primary, unlocked ? 1 : 0.78);
  cup.beginPath();
  cup.moveTo(-12, -18);
  cup.lineTo(-20, -18);
  cup.lineTo(-20, -9);
  cup.lineTo(-12, -4);
  cup.moveTo(12, -18);
  cup.lineTo(20, -18);
  cup.lineTo(20, -9);
  cup.lineTo(12, -4);
  cup.strokePath();

  const detail = scene.add.graphics();
  detail.lineStyle(2, highlight, unlocked ? 0.9 : 0.55);
  detail.beginPath();
  detail.moveTo(-9, -17);
  detail.lineTo(-7, -8);
  detail.lineTo(-4, -2);
  detail.strokePath();
  detail.lineStyle(2, secondary, unlocked ? 0.9 : 0.55);
  detail.beginPath();
  detail.moveTo(9, -17);
  detail.lineTo(7, -8);
  detail.lineTo(4, -2);
  detail.strokePath();
  detail.lineStyle(2, highlight, unlocked ? 0.95 : 0.6);
  detail.beginPath();
  detail.moveTo(-13, 22);
  detail.lineTo(13, 22);
  detail.strokePath();

  const emblem = scene.add.graphics();
  emblem.fillStyle(highlight, unlocked ? 0.95 : 0.5);
  emblem.fillPoints(
    [
      { x: 0, y: -13 },
      { x: 3, y: -7 },
      { x: 9, y: -7 },
      { x: 4, y: -3 },
      { x: 6, y: 3 },
      { x: 0, y: 0 },
      { x: -6, y: 3 },
      { x: -4, y: -3 },
      { x: -9, y: -7 },
      { x: -3, y: -7 },
    ],
    true,
  );

  const sparkles = scene.add.graphics();
  sparkles.fillStyle(highlight, unlocked ? 0.9 : 0.35);
  sparkles.fillPoints(
    [
      { x: -25, y: -17 },
      { x: -23, y: -12 },
      { x: -18, y: -10 },
      { x: -23, y: -8 },
      { x: -25, y: -3 },
      { x: -27, y: -8 },
      { x: -32, y: -10 },
      { x: -27, y: -12 },
    ],
    true,
  );
  sparkles.fillPoints(
    [
      { x: 25, y: -12 },
      { x: 27, y: -8 },
      { x: 31, y: -6 },
      { x: 27, y: -4 },
      { x: 25, y: 0 },
      { x: 23, y: -4 },
      { x: 19, y: -6 },
      { x: 23, y: -8 },
    ],
    true,
  );

  trophy.add([glow, shadow, cup, detail, emblem, sparkles]);
}
