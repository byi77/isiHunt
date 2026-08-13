/**
 * Die eigentliche Simulation eines Runs.
 *
 * Verantwortung strikt begrenzt: Spielfeld aufbauen, Objekte bewegen, Treffer
 * erkennen, Zeit herunterzaehlen, Events feuern. Punkte-/Combo-Regeln liegen in
 * ScoreSystem, Spawn-Regeln in SpawnSystem, Level/XP in ProgressionSystem, und
 * die gesamte Anzeige in HudScene. Diese Scene rendert bewusst KEIN HUD.
 */

import Phaser from 'phaser';

import { CHALLENGE_DURATION_MS, challengePlayerLabel } from '@/config/challenge';
import {
  COUNTDOWN_STEP_MS,
  COUNTDOWN_STEPS,
  DEBUG_ENABLED,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYFIELD_PADDING_BOTTOM,
  PLAYFIELD_PADDING_TOP,
  PLAYFIELD_PADDING_X,
  RARITY_IMPACT_MIN_POINTS,
} from '@/config/GameConfig';
import type { RarityDef } from '@/config/rarities';
import { resolveStats } from '@/config/talents';
import type { PlayerStats } from '@/config/talents';
import { getWorld } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { eventBus, GameEvent } from '@/core/EventBus';
import { Collectible } from '@/entities/Collectible';
import { Player } from '@/entities/Player';
import { DebugKeys } from '@/input/DebugKeys';
import { InputController } from '@/input/InputController';
import { SceneKey } from '@/scenes/SceneKey';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { ScoreSystem } from '@/systems/ScoreSystem';
import { SpawnSystem } from '@/systems/SpawnSystem';
import { Depth } from '@/ui/depth';
import { planetTextureForVariant, playerTextureForLevel } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  burst,
  createAmbientMotes,
  createDriftLayers,
  createVignette,
  createWorldBackdrop,
  floatingScore,
  shockwave,
} from '@/ui/widgets';
import type { RunMode } from '@/types';

export interface GameSceneData {
  worldId: string;
  /** Fehlt der Modus, ist es ein normaler Solo-Run. */
  mode?: RunMode;
}

type RunPhase = 'countdown' | 'running' | 'ended';

export class GameScene extends Phaser.Scene {
  private world!: WorldDef;
  private stats!: PlayerStats;
  private player!: Player;
  private input_!: InputController;
  private spawner!: SpawnSystem;
  private scoring!: ScoreSystem;

  private collectibles: Collectible[] = [];
  private playfield!: Phaser.Geom.Rectangle;
  private playerPosition = new Phaser.Math.Vector2();

  private phase: RunPhase = 'countdown';
  private remainingMs = 0;
  private totalMs = 0;
  private mode: RunMode = 'solo';
  private playerIndex = 0;

  constructor() {
    super(SceneKey.Game);
  }

  create(data: GameSceneData): void {
    const save = SaveSystem.load();

    this.mode = data.mode ?? 'solo';
    this.world = getWorld(data.worldId ?? save.lastWorldId);

    // Im Duell mit Grundwerten spielen: Talente des Geraetebesitzers waeren ein
    // Vorteil, den der Gast nicht ausgleichen kann (config/challenge.ts).
    this.stats = resolveStats(this.mode === 'challenge' ? {} : save.talents);

    const challenge = this.mode === 'challenge' ? ChallengeSystem.getState() : null;
    this.playerIndex = challenge ? ChallengeSystem.currentPlayerIndex() : 0;

    this.totalMs = this.mode === 'challenge' ? CHALLENGE_DURATION_MS : this.stats.runDurationMs;
    this.remainingMs = this.totalMs;
    this.phase = 'countdown';
    this.collectibles = [];

    this.playfield = new Phaser.Geom.Rectangle(
      PLAYFIELD_PADDING_X,
      PLAYFIELD_PADDING_TOP,
      GAME_WIDTH - PLAYFIELD_PADDING_X * 2,
      GAME_HEIGHT - PLAYFIELD_PADDING_TOP - PLAYFIELD_PADDING_BOTTOM,
    );

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.world.bgTop,
      this.world.bgBottom,
      this.world.accent,
      this.world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, this.world.spaceVariant);
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.world.accent);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    this.player = new Player(
      this,
      GAME_WIDTH / 2,
      this.playfield.centerY,
      this.stats,
      this.world.accent,
      this.mode === 'challenge' ? undefined : playerTextureForLevel(save.level),
    );

    this.input_ = new InputController(this);
    this.scoring = new ScoreSystem(
      this.stats.comboGraceMs,
      this.stats.scoreMultiplier,
      this.stats.xpMultiplier,
    );

    // Nur im Duell wird geseedet - beide Spieler bekommen dieselbe Abfolge.
    // Solo bleibt jeder Run eine neue Jagd.
    this.spawner = new SpawnSystem(
      challenge
        ? new Phaser.Math.RandomDataGenerator([challenge.seed])
        : new Phaser.Math.RandomDataGenerator(),
      this.playfield,
    );

    // HUD als eigene Scene parallel starten - siehe Kommentar in EventBus.ts.
    this.scene.launch(SceneKey.Hud, {
      worldId: this.world.id,
      mode: this.mode,
      durationMs: this.totalMs,
      playerLabel: this.mode === 'challenge' ? challengePlayerLabel(this.playerIndex) : null,
      scoreToBeat: this.mode === 'challenge' ? ChallengeSystem.scoreToBeat() : null,
    });

    if (DEBUG_ENABLED) this.installDebugKeys();

    eventBus.onEvent(GameEvent.PauseRequested, this.onPauseRequested);
    eventBus.onEvent(GameEvent.AbortRequested, this.onAbortRequested);

    this.runCountdown();

    // Aufraeumen bei Scene-Restart, damit keine Objekte oder Listener leaken.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // --- Anfragen aus dem HUD -------------------------------------------------

  // Als Klassenfelder, damit `offEvent` dieselbe Referenz bekommt wie
  // `onEvent` - sonst wird nicht abgemeldet (CODE_STYLE.md 1.4).
  private readonly onPauseRequested = (): void => this.togglePause();
  private readonly onAbortRequested = (): void => this.abortRun();

  update(_time: number, delta: number): void {
    if (this.phase !== 'running') return;

    const dtSec = delta / 1000;

    this.updatePlayer(dtSec);
    this.updateCombo(delta);
    this.updateCollectibles(dtSec, delta);
    this.updateSpawning(delta);
    this.updateTimer(delta);
  }

  // --- Update-Schritte ------------------------------------------------------

  private updatePlayer(dtSec: number): void {
    const direction = this.input_.getDirection(this.player.x, this.player.y);
    this.player.move(dtSec, direction, this.playfield);
    this.playerPosition.set(this.player.x, this.player.y);
  }

  private updateCombo(deltaMs: number): void {
    const { comboReset } = this.scoring.update(deltaMs);
    if (comboReset) {
      eventBus.emitEvent(GameEvent.ComboChanged, { combo: 0, multiplier: 1 });
    }
  }

  private updateCollectibles(dtSec: number, deltaMs: number): void {
    const magnetSource = this.stats.magnetRadius > 0 ? this.playerPosition : null;

    // Rueckwaerts iterieren: wir entfernen waehrend des Durchlaufs aus dem Array.
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const orb = this.collectibles[i];
      if (!orb) continue;

      if (orb.isCollected) continue;

      orb.tick(dtSec, deltaMs, this.playfield, magnetSource, this.stats.magnetRadius);

      if (this.isTouching(orb)) {
        this.collect(orb, i);
        continue;
      }

      if (orb.isExpired) {
        this.miss(orb, i);
      }
    }
  }

  private updateSpawning(deltaMs: number): void {
    const progress = 1 - this.remainingMs / this.totalMs;
    const request = this.spawner.update(
      deltaMs,
      progress,
      this.collectibles.length,
      this.player.x,
      this.player.y,
    );

    if (request) this.spawnCollectible(request.x, request.y, request.rarity);
  }

  private updateTimer(deltaMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    eventBus.emitEvent(GameEvent.TimerChanged, {
      remainingMs: this.remainingMs,
      totalMs: this.totalMs,
    });

    if (this.remainingMs <= 0) this.endRun();
  }

  // --- Spielhandlungen ------------------------------------------------------

  private spawnCollectible(x: number, y: number, rarity: RarityDef): void {
    this.collectibles.push(
      new Collectible(this, x, y, rarity, planetTextureForVariant(this.world.spaceVariant)),
    );
  }

  /** Distanztest statt Physik-Body - exakt, billig und leicht nachvollziehbar. */
  private isTouching(orb: Collectible): boolean {
    const reach = this.player.collectRadius + orb.radius;
    return (
      Phaser.Math.Distance.Squared(this.player.x, this.player.y, orb.x, orb.y) <= reach * reach
    );
  }

  private collect(orb: Collectible, index: number): void {
    const outcome = this.scoring.registerCollect(orb.rarity);
    this.collectibles.splice(index, 1);

    orb.collect(() => orb.destroy());

    const isImpact = orb.rarity.points >= RARITY_IMPACT_MIN_POINTS;

    burst(this, orb.x, orb.y, orb.rarity.color, isImpact ? 26 : 12);
    shockwave(this, orb.x, orb.y, orb.rarity.color, isImpact ? 1.5 : 0.85);
    floatingScore(this, orb.x, orb.y, `+${outcome.awardedPoints}`, orb.rarity.color);
    this.player.pulse(orb.rarity.color);

    // Kamera-Ruckler skaliert mit dem Wert - Legendaeres soll sich fett anfuehlen.
    if (isImpact) {
      this.cameras.main.shake(180, 0.006);
      this.cameras.main.flash(140, 255, 255, 255, false);
    }

    eventBus.emitEvent(GameEvent.Collected, {
      rarityId: orb.rarity.id,
      basePoints: orb.rarity.points,
      awardedPoints: outcome.awardedPoints,
      combo: outcome.combo,
      multiplier: outcome.multiplier,
      x: orb.x,
      y: orb.y,
    });

    eventBus.emitEvent(GameEvent.ScoreChanged, { score: this.scoring.currentScore });
    eventBus.emitEvent(GameEvent.ComboChanged, {
      combo: outcome.combo,
      multiplier: outcome.multiplier,
    });
  }

  private miss(orb: Collectible, index: number): void {
    this.scoring.registerMiss();
    this.collectibles.splice(index, 1);
    eventBus.emitEvent(GameEvent.Missed, { rarityId: orb.rarity.id });
    orb.destroy();
  }

  private runCountdown(): void {
    // Im Duell zuerst zeigen, wer gerade spielt - nach der Geraeteuebergabe ist
    // das die wichtigste Information auf dem Bildschirm.
    if (this.mode === 'challenge') {
      this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 110,
          challengePlayerLabel(this.playerIndex).toUpperCase(),
          textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setDepth(Depth.Overlay)
        .setLetterSpacing(4);
    }

    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', textStyle(FontSize.title, Palette.gold))
      .setOrigin(0.5)
      .setDepth(Depth.Overlay);

    let step = COUNTDOWN_STEPS;

    const tick = () => {
      if (step > 0) {
        label.setText(String(step));
      } else {
        label.setText('LOS!');
      }

      label.setScale(1.6).setAlpha(1);
      this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.Out' });

      if (step <= 0) {
        this.tweens.add({ targets: label, alpha: 0, duration: 300, delay: 200 });
        this.startRun();
        return;
      }

      step -= 1;
      this.time.delayedCall(COUNTDOWN_STEP_MS, tick);
    };

    tick();
  }

  private startRun(): void {
    // Der Countdown laeuft ueber `delayedCall` und laesst sich nicht
    // zurueckrufen. Wer waehrenddessen abbricht, hat `phase` bereits auf
    // 'ended' gesetzt - ohne diese Pruefung startete der Run danach trotzdem,
    // und zwar unsichtbar unter dem schon gewechselten Bildschirm.
    if (this.phase === 'ended') return;

    this.phase = 'running';
    this.spawner.reset();
    eventBus.emitEvent(GameEvent.RunStarted, {
      worldId: this.world.id,
      durationMs: this.totalMs,
    });
  }

  private endRun(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';

    const stats = this.scoring.toRunStats(this.world.id);

    // Ein Duell-Durchgang laesst den Spielstand unberuehrt: die Haelfte der
    // Durchgaenge spielt jemand, dem er nicht gehoert (config/challenge.ts).
    if (this.mode === 'challenge') {
      ChallengeSystem.submitRound(stats);

      this.time.delayedCall(450, () => {
        this.scene.stop(SceneKey.Hud);
        this.scene.start(SceneKey.Challenge);
      });
      return;
    }

    const progression = ProgressionSystem.applyRun(stats);
    eventBus.emitEvent(GameEvent.RunEnded, { stats, progression });

    // Kurz stehen lassen, damit der letzte Fang noch ausklingt.
    this.time.delayedCall(450, () => {
      this.scene.stop(SceneKey.Hud);
      this.scene.start(SceneKey.Result, { stats, progression });
    });
  }

  /**
   * Haelt den Run an oder setzt ihn fort.
   *
   * Oeffentlich, weil die HudScene den Pause-Knopf traegt: Sie kennt diese
   * Scene nicht und ruft nicht direkt hier an - der Weg geht ueber den
   * EventBus, und `HudScene` loest ihn nur aus.
   *
   * Im Duell haelt die Simulation nicht an (Begruendung unten), der Bildschirm
   * erscheint aber trotzdem - denn Aussteigen muss auch dort moeglich sein.
   */
  togglePause(): void {
    // Waehrend des Countdowns gibt es nichts anzuhalten, und nach dem Ende ist
    // die Scene bereits auf dem Weg zum naechsten Bildschirm.
    if (this.phase !== 'running') return;

    // Im Duell wird der Bildschirm gezeigt, die Simulation laeuft aber weiter:
    // Wer anhalten koennte, waehrend ein legendaeres Relikt erscheint, duerfte
    // in Ruhe zielen - das bricht die Fairness gegenueber dem ersten Spieler
    // (config/challenge.ts). Aussteigen bleibt moeglich.
    if (this.mode === 'challenge') {
      eventBus.emitEvent(GameEvent.RunPaused, undefined);
      return;
    }

    if (this.scene.isPaused()) {
      this.scene.resume();
      eventBus.emitEvent(GameEvent.RunResumed, undefined);
    } else {
      this.scene.pause();
      eventBus.emitEvent(GameEvent.RunPaused, undefined);
    }
  }

  /**
   * Bricht den laufenden Run ab, ohne ihn zu werten.
   *
   * Kein XP, kein Bestwert, kein Erfolg: Ein abgebrochener Run ist kein
   * Ergebnis. Wer bei schlechtem Lauf abbrechen und es dennoch gewertet
   * bekommen koennte, haette einen Grund, jeden mittelmaessigen Run
   * wegzuwerfen - das waere kein Spiel mehr, sondern eine Auslese.
   */
  abortRun(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';

    // Die Scene laeuft moeglicherweise pausiert - sonst bleibt sie es auch
    // nach dem Wechsel und der naechste Run startet eingefroren.
    if (this.scene.isPaused()) this.scene.resume();

    // Ein abgebrochenes Duell wird ganz verworfen, nicht bei der Uebergabe
    // fortgesetzt: Ohne den Durchgang des Aussteigers gibt es nichts zu
    // vergleichen, und ein halber Zustand schickte die ChallengeScene in die
    // falsche Phase.
    if (this.mode === 'challenge') ChallengeSystem.clear();

    this.scene.stop(SceneKey.Hud);
    this.scene.start(SceneKey.Menu);
  }

  private cleanup(): void {
    eventBus.offEvent(GameEvent.PauseRequested, this.onPauseRequested);
    eventBus.offEvent(GameEvent.AbortRequested, this.onAbortRequested);

    for (const orb of this.collectibles) orb.destroy();
    this.collectibles = [];
  }

  // --- Debug ----------------------------------------------------------------

  private installDebugKeys(): void {
    new DebugKeys(this, {
      spawnRarity: (rarity) => {
        const request = this.spawner.forceSpawn(rarity, this.player.x, this.player.y);
        this.spawnCollectible(request.x, request.y, rarity);
      },
      grantLevel: () => {
        ProgressionSystem.grantLevels(1);
        console.warn('[debug] +1 Level');
      },
      addTime: (ms) => {
        this.remainingMs = Math.min(this.remainingMs + ms, this.totalMs);
      },
      endRun: () => this.endRun(),
      // Dieselbe Methode wie der Pause-Knopf im HUD: zwei Wege in denselben
      // Zustand waeren zwei Wege, ihn kaputtzumachen.
      togglePause: () => this.togglePause(),
      resetSave: () => {
        SaveSystem.reset();
        console.warn('[debug] Spielstand zurueckgesetzt');
      },
    });
  }
}
