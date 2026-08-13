/**
 * Ergebnisbildschirm.
 *
 * Zweck ist nicht Statistik, sondern Belohnung: erst die Zahl, dann was sie
 * gebracht hat (Level, Welten, Achievements), dann sofort wieder rein. Der
 * "Nochmal"-Knopf liegt bewusst dort, wo beim Spielen der Daumen ohnehin war.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { ACHIEVEMENT_BY_ID } from '@/config/achievements';
import { RARITIES } from '@/config/rarities';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createBar, createButton, createVignette, createWorldBackdrop } from '@/ui/widgets';
import type { ProgressionResult, RunStats } from '@/types';

export interface ResultSceneData {
  stats: RunStats;
  progression: ProgressionResult;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Result);
  }

  create(data: ResultSceneData): void {
    const { stats, progression } = data;
    const world = getWorld(stats.worldId);

    createWorldBackdrop(this, GAME_WIDTH, GAME_HEIGHT, world.bgTop, world.bgBottom, world.accent);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    // Abdunkeln, damit die Zahlen im Vordergrund stehen.
    this.add
      .image(0, 0, TextureKey.Pixel)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x000000)
      .setAlpha(0.45);

    this.buildScoreHeader(stats, progression, world.accent);
    this.buildBreakdown(stats);
    this.buildProgression(progression, world.accent);
    this.submitLeaderboardScore(stats);
    this.buildButtons(stats.worldId, world.accent);
  }

  private buildScoreHeader(stats: RunStats, progression: ProgressionResult, accent: number): void {
    this.add
      .text(GAME_WIDTH / 2, 96, 'RUN BEENDET', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(8);

    const score = this.add
      .text(
        GAME_WIDTH / 2,
        168,
        stats.score.toLocaleString('de-DE'),
        textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setScale(0.4);

    this.tweens.add({ targets: score, scale: 1, duration: 420, ease: 'Back.Out' });

    if (progression.isNewBestScore) {
      this.add
        .text(
          GAME_WIDTH / 2,
          224,
          'NEUER BESTWERT',
          textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5);
    }

    this.add
      .text(
        GAME_WIDTH / 2,
        268,
        `${stats.totalCollected} Relikte  ·  beste Kette ${stats.bestCombo}  ·  max x${stats.bestMultiplier}`,
        textStyle(FontSize.small, toCss(accent)),
      )
      .setOrigin(0.5);
  }

  /** Wie viele Relikte je Seltenheit - die Zeile mit dem Sammel-Kick. */
  private buildBreakdown(stats: RunStats): void {
    const y = 336;

    this.add.text(60, y, 'AUSBEUTE', textStyle(FontSize.tiny, Palette.inkDim)).setLetterSpacing(6);

    RARITIES.forEach((rarity, index) => {
      const rowY = y + 44 + index * 40;
      const count = stats.collected[rarity.id];

      this.add
        .image(72, rowY, TextureKey.Orb)
        .setTint(rarity.color)
        .setScale(0.33)
        .setAlpha(count > 0 ? 1 : 0.28);

      this.add
        .text(
          104,
          rowY,
          rarity.label,
          textStyle(FontSize.small, count > 0 ? toCss(rarity.color) : Palette.inkDim),
        )
        .setOrigin(0, 0.5);

      this.add
        .text(
          GAME_WIDTH - 60,
          rowY,
          String(count),
          textStyle(FontSize.small, count > 0 ? Palette.ink : Palette.inkDim, {
            fontStyle: count > 0 ? 'bold' : 'normal',
          }),
        )
        .setOrigin(1, 0.5);
    });
  }

  /** XP-Zuwachs, Levelaufstiege, neue Welten und Achievements. */
  private buildProgression(progression: ProgressionResult, accent: number): void {
    const save = SaveSystem.load();
    const levelProgress = ProgressionSystem.getLevelProgress(save);
    let y = 622;

    this.add
      .text(
        60,
        y,
        `Level ${levelProgress.level}`,
        textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    this.add
      .text(
        GAME_WIDTH - 60,
        y,
        levelProgress.xpNeeded === 0
          ? 'MAX LEVEL'
          : `${levelProgress.xpInLevel} / ${levelProgress.xpNeeded} XP`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(1, 0.5);

    const bar = createBar(this, 60, y + 28, GAME_WIDTH - 120, 10, accent);
    bar.setRatio(0);
    this.tweens.addCounter({
      from: 0,
      to: levelProgress.ratio,
      duration: 900,
      delay: 300,
      ease: 'Quad.Out',
      onUpdate: (tween) => bar.setRatio(tween.getValue() ?? 0),
    });

    y += 66;

    const highlights: { text: string; color: string }[] = [];

    if (progression.levelsGained > 0) {
      highlights.push({
        text: `Levelaufstieg! +${progression.talentPointsGained} Talentpunkt${progression.talentPointsGained === 1 ? '' : 'e'}`,
        color: Palette.gold,
      });
    }

    for (const worldId of progression.unlockedWorldIds) {
      highlights.push({ text: `Neue Welt: ${getWorld(worldId).name}`, color: Palette.success });
    }

    for (const achievementId of progression.unlockedAchievementIds) {
      const achievement = ACHIEVEMENT_BY_ID[achievementId];
      if (achievement) {
        highlights.push({ text: `Erfolg: ${achievement.name}`, color: Palette.gold });
      }
    }

    highlights.slice(0, 4).forEach((entry, index) => {
      const label = this.add
        .text(GAME_WIDTH / 2, y + index * 34, entry.text, textStyle(FontSize.small, entry.color))
        .setOrigin(0.5)
        .setAlpha(0);

      this.tweens.add({
        targets: label,
        alpha: 1,
        duration: 260,
        delay: 500 + index * 180,
      });
    });
  }

  private buildButtons(worldId: string, accent: number): void {
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 172,
      'NOCHMAL',
      () => this.scene.start(SceneKey.Game, { worldId }),
      { width: 440, accent, fontSize: FontSize.large },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 76,
      'ZUM MENUE',
      () => this.scene.start(SceneKey.Menu),
      { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
  }

  /**
   * Jeder Solo-Run wird automatisch eingetragen, sofern ein Name vorhanden
   * ist. Ohne Namen oder ohne Backend bleibt der Bildschirm unveraendert.
   * Fehler sind bewusst still: Die Bestenliste ist eine Zugabe, kein Teil des
   * Runs.
   */
  private submitLeaderboardScore(stats: RunStats): void {
    if (!CloudSystem.isAvailable()) return;

    const name = CloudSystem.sanitizePlayerName(SaveSystem.load().playerName);
    if (!name) return;

    const playerId = SaveSystem.ensureCloudId();
    void CloudSystem.submitScore(playerId, name, stats.worldId, stats.score, stats.bestCombo).catch(
      () => {
        // Online-Eintraege duerfen den Ergebnisbildschirm niemals stoeren.
      },
    );
  }
}
