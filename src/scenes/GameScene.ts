/**
 * Die eigentliche Simulation eines Runs.
 *
 * Verantwortung strikt begrenzt: Spielfeld aufbauen, Objekte bewegen, Treffer
 * erkennen, Zeit herunterzaehlen, Events feuern. Punkte-/Combo-Regeln liegen in
 * ScoreSystem, Spawn-Regeln in SpawnSystem, Level/XP in ProgressionSystem, und
 * die gesamte Anzeige in HudScene. Diese Scene rendert bewusst KEIN HUD.
 */

import Phaser from 'phaser';

import {
  COUNTDOWN_STEP_MS,
  COUNTDOWN_STEPS,
  DEBUG_ENABLED,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYFIELD_PADDING_BOTTOM,
  PLAYFIELD_PADDING_TOP,
  PLAYFIELD_PADDING_X,
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
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { ScoreSystem } from '@/systems/ScoreSystem';
import { SpawnSystem } from '@/systems/SpawnSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import { burst, createAmbientMotes, createWorldBackdrop, floatingScore } from '@/ui/widgets';

export interface GameSceneData {
  worldId: string;
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

  constructor() {
    super(SceneKey.Game);
  }

  create(data: GameSceneData): void {
    const save = SaveSystem.load();

    this.world = getWorld(data.worldId ?? save.lastWorldId);
    this.stats = resolveStats(save.talents);

    this.totalMs = this.stats.runDurationMs;
    this.remainingMs = this.totalMs;
    this.phase = 'countdown';
    this.collectibles = [];

    this.playfield = new Phaser.Geom.Rectangle(
      PLAYFIELD_PADDING_X,
      PLAYFIELD_PADDING_TOP,
      GAME_WIDTH - PLAYFIELD_PADDING_X * 2,
      GAME_HEIGHT - PLAYFIELD_PADDING_TOP - PLAYFIELD_PADDING_BOTTOM,
    );

    createWorldBackdrop(this, GAME_WIDTH, GAME_HEIGHT, this.world.bgTop, this.world.bgBottom);
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.world.accent);

    this.player = new Player(
      this,
      GAME_WIDTH / 2,
      this.playfield.centerY,
      this.stats,
      this.world.accent,
    );

    this.input_ = new InputController(this);
    this.scoring = new ScoreSystem(
      this.stats.comboGraceMs,
      this.stats.scoreMultiplier,
      this.stats.xpMultiplier,
    );
    this.spawner = new SpawnSystem(new Phaser.Math.RandomDataGenerator(), this.playfield);

    // HUD als eigene Scene parallel starten - siehe Kommentar in EventBus.ts.
    this.scene.launch(SceneKey.Hud, { worldId: this.world.id });

    if (DEBUG_ENABLED) this.installDebugKeys();

    this.runCountdown();

    // Aufraeumen bei Scene-Restart, damit keine Objekte oder Listener leaken.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

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
    this.collectibles.push(new Collectible(this, x, y, rarity));
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

    burst(this, orb.x, orb.y, orb.rarity.color, orb.rarity.points >= 50 ? 26 : 12);
    floatingScore(this, orb.x, orb.y, `+${outcome.awardedPoints}`, orb.rarity.color);
    this.player.pulse(orb.rarity.color);

    // Kamera-Ruckler skaliert mit dem Wert - Legendaeres soll sich fett anfuehlen.
    if (orb.rarity.points >= 50) {
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
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', textStyle(FontSize.title, Palette.gold))
      .setOrigin(0.5)
      .setDepth(200);

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
    const progression = ProgressionSystem.applyRun(stats);

    eventBus.emitEvent(GameEvent.RunEnded, { stats, progression });

    // Kurz stehen lassen, damit der letzte Fang noch ausklingt.
    this.time.delayedCall(450, () => {
      this.scene.stop(SceneKey.Hud);
      this.scene.start(SceneKey.Result, { stats, progression });
    });
  }

  private cleanup(): void {
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
      togglePause: () => {
        if (this.scene.isPaused()) {
          this.scene.resume();
          eventBus.emitEvent(GameEvent.RunResumed, undefined);
        } else {
          this.scene.pause();
          eventBus.emitEvent(GameEvent.RunPaused, undefined);
        }
      },
      resetSave: () => {
        SaveSystem.reset();
        console.warn('[debug] Spielstand zurueckgesetzt');
      },
    });
  }
}
