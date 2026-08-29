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
import * as AuthSystem from '@/systems/AuthSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { accessibleRarityLabel } from '@/systems/AccessibilitySystem';
import { getLevelUpRewardSummary } from '@/systems/LevelUpPresentationSystem';
import { getNextGoal } from '@/systems/NextGoalSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { planetTextureForVariant, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBar,
  createButton,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';
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
    SafeAreaSystem.showStatic('RUN BEENDET');
    const { stats, progression } = data;
    const world = getWorld(stats.worldId);

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    // Abdunkeln, damit die Zahlen im Vordergrund stehen.
    this.add
      .image(0, 0, TextureKey.Pixel)
      .setOrigin(0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x000000)
      .setAlpha(0.45);

    this.buildScoreHeader(stats, progression, world.accent);
    const progressionBottom = this.buildProgression(stats, progression, world.accent);
    const nextGoalBottom = this.buildNextGoal(world.accent, progressionBottom + 18);
    this.buildBreakdown(stats, world.spaceVariant, nextGoalBottom + 42);
    ProgressSyncSystem.enqueueRun(stats, progression);
    // Fuer eingeloggte Scores muss das zugehoerige Progress-Event zuerst
    // serverseitig akzeptiert sein; die Bestenliste bleibt dadurch kein
    // unabhaengiger Schreibpfad fuer dieselben Client-Zahlen.
    void ProgressSyncSystem.flush().then(() => this.submitLeaderboardScore(stats));
    this.uploadSave();
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

  /** Wie viele Relikte je Seltenheit - optionale Details unter dem Ziel. */
  private buildBreakdown(stats: RunStats, spaceVariant: number, y: number): void {
    this.add.text(60, y, 'AUSBEUTE', textStyle(FontSize.tiny, Palette.inkDim)).setLetterSpacing(6);

    RARITIES.forEach((rarity, index) => {
      const rowY = y + 42 + index * 32;
      const count = stats.collected[rarity.id];

      this.add
        .image(72, rowY, planetTextureForVariant(spaceVariant))
        .setDisplaySize(23, 23)
        .setAlpha(count > 0 ? 1 : 0.28);

      this.add
        .text(
          104,
          rowY,
          accessibleRarityLabel(rarity.id, rarity.label),
          textStyle(FontSize.tiny, count > 0 ? toCss(rarity.color) : Palette.inkDim),
        )
        .setOrigin(0, 0.5);

      this.add
        .text(
          GAME_WIDTH - 60,
          rowY,
          String(count),
          textStyle(FontSize.tiny, count > 0 ? Palette.ink : Palette.inkDim, {
            fontStyle: count > 0 ? 'bold' : 'normal',
          }),
        )
        .setOrigin(1, 0.5);
    });
  }

  /** Belohnung zuerst: XP, Coins und unmittelbare Freischaltungen. */
  private buildProgression(
    stats: RunStats,
    progression: ProgressionResult,
    accent: number,
  ): number {
    const save = SaveSystem.load();
    const levelProgress = ProgressionSystem.getLevelProgress(save);
    const levelUp = getLevelUpRewardSummary(save, progression);
    const panelTop = 300;
    const panelHeight = levelUp.isLevelUp ? 314 : 238;
    createPanel(
      this,
      GAME_WIDTH / 2,
      panelTop + panelHeight / 2,
      GAME_WIDTH - 120,
      panelHeight,
      accent,
      {
        alpha: 0.58,
        radius: 18,
      },
    );

    if (levelUp.isLevelUp) {
      const levelUpLabel = this.add
        .text(
          GAME_WIDTH / 2,
          panelTop + 27,
          'LEVEL-UP!',
          textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setLetterSpacing(5)
        .setScale(0.8);
      this.tweens.add({
        targets: levelUpLabel,
        scale: 1,
        alpha: 1,
        duration: 360,
        ease: 'Back.Out',
      });
      this.add
        .text(
          GAME_WIDTH / 2,
          panelTop + 58,
          `Stufe ${levelUp.level} erreicht`,
          textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5);
    } else {
      this.add
        .text(60, panelTop + 27, 'BELOHNUNG', textStyle(FontSize.tiny, Palette.inkDim))
        .setLetterSpacing(6);
    }

    const y = panelTop + (levelUp.isLevelUp ? 94 : 67);

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
        `+${stats.xpGained.toLocaleString('de-DE')} XP`,
        textStyle(FontSize.tiny, Palette.ink),
      )
      .setOrigin(1, 0.5);

    const bar = createBar(this, 60, y + 28, GAME_WIDTH - 120, 10, accent);
    bar.setRatio(levelProgress.ratio);
    this.tweens.addCounter({
      from: 0,
      to: levelProgress.ratio,
      duration: 900,
      delay: 300,
      ease: 'Quad.Out',
      onUpdate: (tween) => bar.setRatio(tween.getValue() ?? 0),
    });

    this.add
      .text(
        60,
        y + 48,
        levelProgress.xpNeeded === 0
          ? 'MAX LEVEL'
          : `${levelProgress.xpInLevel} / ${levelProgress.xpNeeded} XP im aktuellen Level`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0, 0.5);

    const highlightY = y + (levelUp.isLevelUp ? 92 : 78);

    const highlights: { text: string; color: string }[] = [];

    if (levelUp.isLevelUp) {
      highlights.push({
        text: `+${levelUp.levelCoins} Coins fuer den Levelaufstieg`,
        color: Palette.gold,
      });
      highlights.push({
        text: `Du hast jetzt ${levelUp.totalCoins.toLocaleString('de-DE')} Coins`,
        color: Palette.ink,
      });
    } else if (progression.coinsGained > 0) {
      highlights.push({
        text: '+' + progression.coinsGained + ' Coins gesammelt',
        color: Palette.gold,
      });
    }

    for (const worldName of levelUp.unlockedWorldNames) {
      highlights.push({ text: `Neue Welt: ${worldName}`, color: Palette.success });
    }

    for (const auraName of levelUp.availableAuraNames) {
      highlights.push({ text: `Neue Optik im Shop: ${auraName}`, color: Palette.success });
    }

    for (const achievementId of progression.unlockedAchievementIds) {
      const achievement = ACHIEVEMENT_BY_ID[achievementId];
      if (achievement) {
        highlights.push({
          text: `Erfolg: ${achievement.name} · +${achievement.coinReward} Coins`,
          color: Palette.gold,
        });
      }
    }

    highlights.slice(0, levelUp.isLevelUp ? 4 : 3).forEach((entry, index) => {
      const label = this.add
        .text(
          GAME_WIDTH / 2,
          highlightY + index * 28,
          entry.text,
          textStyle(FontSize.tiny, entry.color),
        )
        .setOrigin(0.5)
        .setAlpha(0);

      this.tweens.add({
        targets: label,
        alpha: 1,
        duration: 260,
        delay: 500 + index * 180,
      });
    });

    return panelTop + panelHeight;
  }

  /** Genau eine Handlungsempfehlung, zentral aus dem fertigen Spielstand. */
  private buildNextGoal(accent: number, panelTop: number): number {
    const goal = getNextGoal(SaveSystem.load());
    const panelHeight = 148;
    createPanel(
      this,
      GAME_WIDTH / 2,
      panelTop + panelHeight / 2,
      GAME_WIDTH - 120,
      panelHeight,
      accent,
      {
        alpha: 0.66,
        radius: 18,
      },
    );

    this.add
      .text(60, panelTop + 25, 'NÄCHSTES ZIEL', textStyle(FontSize.tiny, Palette.inkDim))
      .setLetterSpacing(6);
    this.add
      .text(
        GAME_WIDTH / 2,
        panelTop + 65,
        goal.title,
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 170)
      .setAlign('center');
    this.add
      .text(GAME_WIDTH / 2, panelTop + 108, goal.detail, textStyle(FontSize.tiny, Palette.ink))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 170)
      .setAlign('center');

    return panelTop + panelHeight;
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
      'ZUM MENÜ',
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
    if (
      !CloudSystem.isAvailable() ||
      SaveSystem.isTestProfileActive() ||
      !AuthSystem.isSignedIn()
    ) {
      return;
    }

    const name = CloudSystem.sanitizePlayerName(SaveSystem.load().playerName);
    if (!name) return;

    // Anonyme Score-Submission bleibt bewusst aus: Ein Gast kann keinen
    // serverseitig akzeptierten Progress-Nachweis fuer die Bestenliste tragen.
    const playerId = AuthSystem.currentUserId();
    if (!playerId) return;
    void CloudSystem.submitScoreSafely(
      playerId,
      name,
      stats.worldId,
      SaveSystem.load().level,
      stats.score,
      stats.bestCombo,
      stats.durationMs ?? 0,
      stats.collected,
      stats.completedAt ?? new Date().toISOString(),
    );
  }

  /**
   * Der Run ist bereits lokal gespeichert. Der Cloud-Versuch darf bei
   * schlechtem oder fehlendem Netz weder den Ergebnisbildschirm noch den Run
   * beeinflussen; MenuScene prueft beim naechsten Start erneut.
   */
  private uploadSave(): void {
    if (!CloudSystem.isAvailable() || SaveSystem.isTestProfileActive()) return;
    // Ein namenloser Gast spielt vollständig lokal. Erst ein Name oder ein
    // Login macht einen späteren Cloud-Abgleich sinnvoll.
    if (!AuthSystem.isSignedIn() && !SaveSystem.load().playerName) return;
    void ProgressSyncSystem.flush();
    if (!AuthSystem.isSignedIn()) void CloudSystem.syncSaveSafely();
  }
}
