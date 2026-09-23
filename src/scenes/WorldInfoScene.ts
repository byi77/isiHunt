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
import { enterScene, transitionTo } from '@/ui/sceneTransition';
import { createButton, createMenuLayout, createPanel, createSceneBackdrop } from '@/ui/widgets';

export type WorldInfoMode = 'jagd' | 'duell' | 'tageslauf';

const MODE_TITLES: Record<WorldInfoMode, string> = {
  jagd: 'JAGD STARTEN',
  duell: 'DUELL STARTEN',
  tageslauf: 'TAGESLAUF STARTEN',
};

/**
 * Lage des Bonusknopfs ueber dem Startknopf (Mitte H-172, Hoehe 92, also
 * Oberkante H-218): 22 px Luft, dann der 76 px hohe Bonusknopf.
 */
const WORLD_INFO_LAYOUT = { boostOffset: 278, boostHeight: 76, statusGap: 10 } as const;

/** 2 -> "2", 1.5 -> "1,5" - Faktoren in deutscher Schreibweise ohne Nullen. */
function formatFactor(factor: number): string {
  return String(Math.round(factor * 100) / 100).replace('.', ',');
}

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
    enterScene(this);
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
      // Ohne Buchstabenabstand: Phaser zerlegt Text mit Abstand per
      // `split('')` in UTF-16-Einheiten und zerreisst dabei jedes Emoji
      // ausserhalb der Grundebene - 💥 und 🎁 erschienen als "��".
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, y + 6, body, textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5)
      .setWordWrapWidth(width - 64)
      .setAlign('center')
      .setLineSpacing(4);
  }

  private buildButtons(worldId: string, accent: number, mode: WorldInfoMode): void {
    // Der Startknopf steht immer an derselben Stelle. Der Bonusknopf kommt
    // erst nach der Abfrage dazu und darueber - so springt nichts, waehrend
    // der Daumen schon unterwegs ist. Vorher lagen beide 64 px auseinander
    // bei 92 px Knopfhoehe und ueberdeckten sich um 28 px.
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 172,
      MODE_TITLES[mode],
      () => void this.startMode(worldId, mode),
      { width: 460, accent, fontSize: FontSize.large },
    );
    if (mode === 'jagd' && AuthSystem.isSignedIn()) void this.offerBoostedRun(worldId);

    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 76,
      '‹  ZURÜCK',
      () => this.scene.start(SceneKey.Menu),
      { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
  }

  /**
   * Zeigt den Bonusknopf nur, wenn es eine Bonusrunde zu starten gibt.
   *
   * Eine Bonusrunde verbraucht ein Recht, das vorher per Belohnungscode
   * eingeloest wurde. Ohne Recht lehnt der Server mit `unavailable` ab; der
   * Knopf war dann nur eine Fehlermeldung mit Anlauf. Ein offener Start aus
   * einem abgebrochenen Versuch zaehlt mit: Sein Recht ist schon abgebucht,
   * der Bestand steht also womoeglich auf 0, und genau dieser Start muss sich
   * wieder aufnehmen lassen.
   */
  private async offerBoostedRun(worldId: string): Promise<void> {
    const pending = BoostedRunSession.readPendingStart(worldId);
    const balance = await CloudSystem.fetchBoostBalance();
    if (!this.scene.isActive()) return;
    const remaining = balance.ok ? balance.value.remaining : 0;
    if (remaining <= 0 && !pending) return;

    const buttonY = GAME_HEIGHT - WORLD_INFO_LAYOUT.boostOffset;
    const factor = balance.ok ? balance.value.nextFactor : 1;
    const label =
      remaining > 0
        ? `BONUS-XP-RUN · XP ×${formatFactor(factor)} · NOCH ${remaining}`
        : 'BONUS-XP-RUN FORTSETZEN';
    createButton(this, GAME_WIDTH / 2, buttonY, label, () => void this.startBoostedMode(worldId), {
      width: 460,
      height: WORLD_INFO_LAYOUT.boostHeight,
      accent: 0xd7a93b,
      fontSize: FontSize.small,
    });
    this.boostedStatus = this.add
      .text(
        GAME_WIDTH / 2,
        buttonY - WORLD_INFO_LAYOUT.boostHeight / 2 - WORLD_INFO_LAYOUT.statusGap,
        'Verbraucht beim Start eine Bonusrunde - auch bei Abbruch.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5, 1)
      .setWordWrapWidth(GAME_WIDTH - 120)
      .setAlign('center');
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
    transitionTo(
      this,
      SceneKey.Game,
      {
        worldId,
        boostedRun: result.value,
        rewardEffects: effectRun.ok ? (effectRun.value ?? undefined) : undefined,
      },
      'dive',
    );
  }

  /** Loest je nach Modus genau den Zustandsaufbau aus, den der Zielbildschirm erwartet. */
  private async startMode(worldId: string, mode: WorldInfoMode): Promise<void> {
    if (mode === 'jagd') {
      const effectRun = await CloudSystem.startRewardEffectRun(worldId);
      if (!this.scene.isActive()) return;
      transitionTo(
        this,
        SceneKey.Game,
        { worldId, rewardEffects: effectRun.ok ? (effectRun.value ?? undefined) : undefined },
        'dive',
      );
      return;
    }
    if (mode === 'duell') {
      if (!this.scene.isActive()) return;
      ChallengeSystem.start(worldId);
      transitionTo(this, SceneKey.Challenge);
      return;
    }
    if (!this.scene.isActive()) return;
    ChallengeSystem.startDaily(worldId);
    transitionTo(this, SceneKey.Challenge);
  }
}
