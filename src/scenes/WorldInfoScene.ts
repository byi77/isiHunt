/**
 * Detailansicht einer einzelnen Welt: Besonderheit, Hindernisse, Belohnung.
 *
 * `plannedModifier` steht bereits in `config/worlds.ts`, war bisher aber
 * nirgends sichtbar - das Weltenkarussell im Menue zeigt nur `flavor`, den
 * reinen Stimmungstext ohne Mechanik-Angabe.
 *
 * Zwischenstopp vor jedem Run: JAGD, DUELL und TAGESLAUF fuehren alle erst
 * hierher, bevor der eigentliche Modus beginnt. `mode` legt fest, was der
 * START-Knopf danach anstoesst - diese Scene startet selbst keinen
 * Duell-/Tageslauf-Zustand, das bleibt Aufgabe von `ChallengeSystem`.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as BoostedRunSession from '@/systems/BoostedRunSession';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createButton, createMenuLayout, createPanel, createSceneBackdrop } from '@/ui/widgets';

export type WorldInfoMode = 'jagd' | 'duell' | 'tageslauf';

const MODE_TITLES: Record<WorldInfoMode, string> = {
  jagd: 'JAGD STARTEN',
  duell: 'DUELL STARTEN',
  tageslauf: 'TAGESLAUF STARTEN',
};

/** Kindgerechte Kurzfassung des Hindernismodus - `obstacleMode` ist nur technisch benannt. */
function describeObstacles(world: WorldDef): string {
  if (world.obstacleMode === 'none') return 'Keine Hindernisse in dieser Welt.';
  if (world.obstacleMode === 'brake') return 'Hindernisse bremsen dich kurz aus.';
  return 'Hindernisse kosten dich wertvolle Zeit.';
}

/** Prozentsatz gegenueber der Grundwelt, ohne die interne Nachkommastelle zu zeigen. */
function describeBonus(world: WorldDef): string {
  const scorePercent = Math.round((world.scoreMultiplier - 1) * 100);
  const xpPercent = Math.round((world.xpMultiplier - 1) * 100);
  if (scorePercent === 0 && xpPercent === 0) return 'Keine zusaetzliche Belohnung - die Lernzone.';
  return `+${scorePercent}% Punkte und +${xpPercent}% Erfahrung gegenueber der ersten Welt.`;
}

export class WorldInfoScene extends Phaser.Scene {
  private boostedBusy = false;
  private boostedStatus: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKey.WorldInfo);
  }

  create(data: { worldId: string; mode: WorldInfoMode }): void {
    const world = getWorld(data.worldId);
    const mode = data.mode;
    const save = SaveSystem.load();
    const isUnlocked = world.unlockLevel <= save.level;

    SafeAreaSystem.showStatic(world.name.toUpperCase());

    createSceneBackdrop(this, world);
    const layout = createMenuLayout(24);
    const sections = layout.sections;

    this.add
      .text(GAME_WIDTH / 2, sections.next(30), world.name, {
        ...textStyle(FontSize.heading, toCss(world.accent), { fontStyle: 'bold' }),
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        sections.next(56),
        isUnlocked ? world.flavor : `Freigeschaltet ab Level ${world.unlockLevel}`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center');

    if (isUnlocked) {
      const cardWidth = GAME_WIDTH - 120;
      const cardHeight = 110;
      this.buildInfoCard(
        sections.next(cardHeight),
        cardWidth,
        cardHeight,
        world.accent,
        '⚡ BESONDERHEIT',
        world.plannedModifier,
      );
      this.buildInfoCard(
        sections.next(cardHeight),
        cardWidth,
        cardHeight,
        world.accent,
        '💥 HINDERNISSE',
        describeObstacles(world),
      );
      this.buildInfoCard(
        sections.next(cardHeight),
        cardWidth,
        cardHeight,
        world.accent,
        '🎁 BELOHNUNG',
        describeBonus(world),
      );
    }

    this.buildButtons(world.id, world.accent, mode);
  }

  private buildInfoCard(
    y: number,
    width: number,
    height: number,
    accent: number,
    title: string,
    body: string,
  ): void {
    createPanel(this, GAME_WIDTH / 2, y, width, height, accent, { alpha: 0.16 });

    this.add
      .text(
        GAME_WIDTH / 2,
        y - height / 2 + 26,
        title,
        textStyle(FontSize.small, toCss(accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(1);

    this.add
      .text(GAME_WIDTH / 2, y + 6, body, textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5)
      .setWordWrapWidth(width - 64)
      .setAlign('center')
      .setLineSpacing(4);
  }

  private buildButtons(worldId: string, accent: number, mode: WorldInfoMode): void {
    const hasBoostButton = mode === 'jagd' && AuthSystem.isSignedIn();
    this.boostedStatus = hasBoostButton
      ? this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 116, '', textStyle(FontSize.tiny, Palette.inkDim))
          .setOrigin(0.5)
          .setWordWrapWidth(GAME_WIDTH - 120)
          .setAlign('center')
      : null;

    if (hasBoostButton) {
      createButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT - 248,
        'BONUS-XP-RUN STARTEN',
        () => void this.startBoostedMode(worldId),
        { width: 460, accent: 0xd7a93b, fontSize: FontSize.small },
      );
    }
    createButton(
      this,
      GAME_WIDTH / 2,
      hasBoostButton ? GAME_HEIGHT - 184 : GAME_HEIGHT - 172,
      MODE_TITLES[mode],
      () => void this.startMode(worldId, mode),
      { width: 460, accent, fontSize: FontSize.large },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 76,
      '‹  ZURÜCK',
      () => this.scene.start(SceneKey.Menu),
      { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
  }

  private async startBoostedMode(worldId: string): Promise<void> {
    if (this.boostedBusy || !this.scene.isActive()) return;
    this.boostedBusy = true;
    this.boostedStatus?.setText('Bonusrecht wird serverseitig reserviert …');
    await ProgressSyncSystem.flush();
    if (!this.scene.isActive()) return;
    if (ProgressSyncSystem.hasPendingData()) {
      this.boostedBusy = false;
      this.boostedStatus
        ?.setText('Ausstehende Läufe zuerst synchronisieren.')
        .setColor(Palette.gold);
      return;
    }
    const pending =
      BoostedRunSession.readPendingStart(worldId) ?? BoostedRunSession.prepareStart(worldId);
    const result = await CloudSystem.startBoostedRun(worldId, pending.requestId);
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.boostedBusy = false;
      this.boostedStatus?.setText(result.error).setColor(Palette.gold);
      return;
    }
    const effectRun = await CloudSystem.startRewardEffectRun(worldId);
    if (!this.scene.isActive()) return;
    BoostedRunSession.clearStart();
    this.scene.start(SceneKey.Game, {
      worldId,
      boostedRun: result.value,
      rewardEffects: effectRun.ok ? (effectRun.value ?? undefined) : undefined,
    });
  }

  /** Loest je nach Modus genau den Zustandsaufbau aus, den der Zielbildschirm erwartet. */
  private async startMode(worldId: string, mode: WorldInfoMode): Promise<void> {
    if (mode === 'jagd') {
      const effectRun = await CloudSystem.startRewardEffectRun(worldId);
      if (!this.scene.isActive()) return;
      this.scene.start(SceneKey.Game, {
        worldId,
        rewardEffects: effectRun.ok ? (effectRun.value ?? undefined) : undefined,
      });
      return;
    }
    if (mode === 'duell') {
      if (!this.scene.isActive()) return;
      ChallengeSystem.start(worldId);
      this.scene.start(SceneKey.Challenge);
      return;
    }
    if (!this.scene.isActive()) return;
    ChallengeSystem.startDaily(worldId);
    this.scene.start(SceneKey.Challenge);
  }
}
