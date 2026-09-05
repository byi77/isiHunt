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
  ONLINE_DUEL_LIVE_STALE_MS,
  ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS,
} from '@/config/onlineDuel';
import { CHALLENGE_DURATION_MS } from '@/config/challenge';
import {
  COMBO_GRACE_MS,
  COUNTDOWN_STEP_MS,
  COUNTDOWN_STEPS,
  DEBUG_ENABLED,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_BASE_COLLECT_RADIUS,
  PLAYER_BASE_SPEED,
  PLAYFIELD_PADDING_BOTTOM,
  PLAYFIELD_PADDING_TOP,
  PLAYFIELD_PADDING_X,
  RARITY_IMPACT_MIN_POINTS,
  RUN_DURATION_MS,
  WORLD_BRAKE_DURATION_MS,
  WORLD_BRAKE_FACTOR,
  WORLD_INERTIA_FACTOR,
  WORLD_PENALTY_MS,
} from '@/config/GameConfig';
import { XP_GLOBAL_MULTIPLIER } from '@/config/balance';
import type { RarityDef } from '@/config/rarities';
import { resolveStats, talentMaxRank } from '@/config/talents';
import type { PlayerStats } from '@/config/talents';
import { getWorld } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { eventBus, GameEvent } from '@/core/EventBus';
import { Collectible } from '@/entities/Collectible';
import { Obstacle } from '@/entities/Obstacle';
import { Player } from '@/entities/Player';
import { DebugKeys } from '@/input/DebugKeys';
import { InputController } from '@/input/InputController';
import { SceneKey } from '@/scenes/SceneKey';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import { PerformanceMonitor } from '@/systems/PerformanceSystem';
import type { PerformanceReport } from '@/systems/PerformanceSystem';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { ScoreSystem, trailTierForSeries } from '@/systems/ScoreSystem';
import { SpawnSystem } from '@/systems/SpawnSystem';
import { Depth } from '@/ui/depth';
import { shipAuraAssetId, shipAuraIndex, shipHullTint, shipTint } from '@/config/shop';
import { threeDAssetForId } from '@/ui/egoAssets';
import { planetTextureForVariant, playerTextureForShape } from '@/ui/textures';
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
import type { ChallengeState, RunMode } from '@/types';

export interface GameSceneData {
  worldId: string;
  /** Fehlt der Modus, ist es ein normaler Solo-Run. */
  mode?: RunMode;
}

type RunPhase = 'countdown' | 'running' | 'ended';

/** Kompakte Live-Anzeige der tatsaechlich aktiven Talentverstaerkungen. */
function activeTalentSummary(stats: PlayerStats): string {
  const active: string[] = [];
  const ranks = stats.talentRanks;
  const reach = stats.collectRadius - PLAYER_BASE_COLLECT_RADIUS;
  const speed = Math.round((stats.moveSpeed / PLAYER_BASE_SPEED - 1) * 100);
  const run = Math.round((stats.runDurationMs - RUN_DURATION_MS) / 1000);
  const combo = Math.round(stats.comboGraceMs - COMBO_GRACE_MS);
  const promotion = Math.round(stats.rarityPromotionChance * 100);
  const xp = Math.round((stats.xpMultiplier - 1) * 100);
  const score = Math.round((stats.scoreMultiplier - 1) * 100);
  const resonance = stats.seriesMultiplierBonus.toFixed(2).replace('.', ',');
  const shield = Math.round(stats.obstacleResistance * 100);

  if (reach > 0) active.push(`REICH R${ranks.reach} +${reach}`);
  if (speed > 0) active.push(`TEMPO R${ranks.swiftness} +${speed}%`);
  if (stats.magnetRadius > 0) active.push(`MAGNET R${ranks.magnetism} +${stats.magnetRadius}`);
  if (run > 0) active.push(`AUSDAUER R${ranks.endurance} +${run}s`);
  if (combo > 0) active.push(`FOKUS R${ranks.focus} +${combo}ms`);
  if (promotion > 0) active.push(`SPÜRSINN R${ranks.prospector} +${promotion}%`);
  if (xp > 0) active.push(`XP R${ranks.insight} +${xp}%`);
  if (score > 0) active.push(`PUNKTE R${ranks.fortune} +${score}%`);
  if (stats.seriesMultiplierBonus > 0) active.push(`RESONANZ R${ranks.resonance} +${resonance}x`);
  if (shield > 0) active.push(`SCHUTZFELD R${ranks.shield} -${shield}%`);

  return active.length > 0 ? `AKTIV · ${active.join(' · ')}` : '';
}

export class GameScene extends Phaser.Scene {
  private world!: WorldDef;
  private stats!: PlayerStats;
  private player!: Player;
  private input_!: InputController;
  private spawner!: SpawnSystem;
  private scoring!: ScoreSystem;

  private collectibles: Collectible[] = [];
  private obstacles: Obstacle[] = [];
  private playfield!: Phaser.Geom.Rectangle;
  private playerPosition = new Phaser.Math.Vector2();

  private phase: RunPhase = 'countdown';
  private remainingMs = 0;
  private totalMs = 0;
  private mode: RunMode = 'solo';
  private playerIndex = 0;
  /** Nur im Netzwerk-Duell gesetzt - Taktgeber fuer den eigenen Live-Stand. */
  private liveBroadcastTimer: Phaser.Time.TimerEvent | null = null;
  /** Was die anderen Spieler zuletzt gemeldet haben - je Slot getrennt. */
  private opponentLastSeenAt = new Map<number, number>();
  private opponentGone = new Set<number>();
  /** Nach `finished`/`left` ist Schweigen je Slot normal. */
  private opponentTerminal = new Set<number>();
  /**
   * Wird auf `away` gesetzt, sobald dieses Geraet den Pause-Bildschirm zeigt
   * oder in den Hintergrund geht. Der Run laeuft dabei weiter (Fairness-Regel
   * in `togglePause`), deshalb ist das ausdruecklich kein Pausenzustand,
   * sondern nur "sieht gerade nicht hin".
   */
  private localActivity: NetworkDuelSystem.DuelOpponentActivity = 'playing';
  private challenge: ChallengeState | null = null;
  private readonly performanceMonitor: PerformanceMonitor | null = DEBUG_ENABLED
    ? new PerformanceMonitor()
    : null;

  constructor() {
    super(SceneKey.Game);
  }

  create(data: GameSceneData): void {
    SafeAreaSystem.hide();
    const save = SaveSystem.load();

    this.mode = data.mode ?? 'solo';
    this.world = getWorld(data.worldId ?? save.lastWorldId);
    const isChallengeMode = this.mode !== 'solo';
    const challenge = isChallengeMode ? ChallengeSystem.getState() : null;
    this.playerIndex = challenge ? ChallengeSystem.currentPlayerIndex() : 0;

    // Solo und Tageslauf verwenden den permanenten Talentbaum. Duelle,
    // Bot-Runden und Netzwerk-Duelle verwenden nur den temporaeren Build aus
    // dem Vormatch; ohne diesen bleiben sie bei den Grundwerten.
    const usesTalents =
      this.mode === 'solo' ||
      this.mode === 'daily' ||
      challenge?.kind === 'duel' ||
      challenge?.kind === 'bot' ||
      challenge?.kind === 'duel-online';
    const duelTalentRanks = challenge ? ChallengeSystem.duelTalentDraftFor(this.playerIndex) : {};
    this.stats = resolveStats(
      usesTalents
        ? this.mode === 'solo' || this.mode === 'daily'
          ? save.talents
          : duelTalentRanks
        : {},
    );

    // Kosmetik ist eine andere Frage als Spielvorteil.
    //
    // Die Fairness-Regeln in `config/challenge.ts` gelten dem Duell: zwei
    // Personen an EINEM Geraet. Dort darf die gekaufte Form nicht verraten,
    // wer gerade dran ist, und der Geraetebesitzer soll keinen Vorteil haben.
    //
    // Der Tageslauf ist Einzelspiel. Verglichen wird ueber den gemeinsamen
    // Seed (Regel 1), nicht ueber das Aussehen - eine Aura macht kein Relikt
    // schneller. Wer eine Form gekauft hat, soll sie deshalb auch hier tragen.
    const versteckeKosmetik = isChallengeMode && this.mode !== 'daily';

    this.challenge = challenge;
    this.opponentLastSeenAt.clear();
    this.opponentGone.clear();
    this.opponentTerminal.clear();
    this.localActivity = 'playing';

    this.totalMs = usesTalents ? this.stats.runDurationMs : CHALLENGE_DURATION_MS;
    this.remainingMs = this.totalMs;
    this.phase = 'countdown';
    this.collectibles = [];
    this.obstacles = [];

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
      // Im Duell traegt jeder die Weltfarbe: Gekaufte Farben duerfen die
      // beiden Spieler nicht unterscheidbar machen, sonst wird aus dem
      // fairen Vergleich eine Frage des Guthabens (config/challenge.ts).
      versteckeKosmetik ? this.world.accent : shipTint(save, this.world.accent),
      versteckeKosmetik ? undefined : playerTextureForShape(save.shipShape),
      versteckeKosmetik ? 0xffffff : shipHullTint(save),
      versteckeKosmetik ? undefined : threeDAssetForId(save.shipShape),
    );
    // Aus demselben Grund wie die Farbe: Im Duell traegt niemand eine Aura.
    // Eine flackernde Figur neben einer ruhigen waere auf einen Blick
    // zuzuordnen - der Vergleich soll am Spiel haengen, nicht am Guthaben.
    this.player.setAura(
      versteckeKosmetik ? null : shipAuraIndex(save),
      versteckeKosmetik ? undefined : shipAuraAssetId(save),
    );
    this.player.setWorldInertia(this.world.modifier === 'inertia' ? WORLD_INERTIA_FACTOR : 1);

    this.input_ = new InputController(this);
    this.scoring = new ScoreSystem(
      this.stats.comboGraceMs,
      this.stats.scoreMultiplier * this.world.scoreMultiplier,
      this.stats.xpMultiplier * this.world.xpMultiplier * XP_GLOBAL_MULTIPLIER,
      this.stats.seriesMultiplierBonus,
    );

    // Nur im Duell wird geseedet - beide Spieler bekommen dieselbe Abfolge.
    // Solo bleibt jeder Run eine neue Jagd.
    this.spawner = new SpawnSystem(
      challenge
        ? new Phaser.Math.RandomDataGenerator([challenge.seed])
        : new Phaser.Math.RandomDataGenerator(),
      this.playfield,
      this.world.modifier,
      this.world.obstacleMode,
      this.world.difficultyScale,
      Boolean(challenge),
      this.stats.rarityPromotionChance,
    );

    // HUD als eigene Scene parallel starten - siehe Kommentar in EventBus.ts.
    this.scene.launch(SceneKey.Hud, {
      worldId: this.world.id,
      mode: this.mode,
      durationMs: this.totalMs,
      playerLabel: isChallengeMode ? ChallengeSystem.playerLabel(this.playerIndex) : null,
      scoreToBeat: isChallengeMode ? ChallengeSystem.scoreToBeat() : null,
      talentSummary: usesTalents ? activeTalentSummary(this.stats) : '',
      showOpponentLive: challenge?.kind === 'duel-online',
      localPlayerIndex:
        challenge?.kind === 'duel-online' ? challenge.online?.localPlayerIndex : undefined,
      playerCount: challenge?.kind === 'duel-online' ? challenge.playerCount : undefined,
      opponentLabels:
        challenge?.kind === 'duel-online' ? (challenge.online?.playerNames ?? []) : undefined,
    });

    if (DEBUG_ENABLED) this.installDebugKeys();

    eventBus.onEvent(GameEvent.PauseRequested, this.onPauseRequested);
    eventBus.onEvent(GameEvent.AbortRequested, this.onAbortRequested);
    eventBus.onEvent(GameEvent.RunResumed, this.onRunResumed);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Waehrend eines Netzwerk-Duells soll ein Verbindungsabbruch des Gegners
    // sichtbar werden, ohne den eigenen Run zu unterbrechen (Planungsnotiz:
    // "Solo-Fortsetzung statt Abbruch"). Die Handler auf dem Kanal wechseln
    // hier auf diese Scene - die Lobby-Handler aus OnlineDuelScene waren nur
    // fuer die Wartephase gedacht und wuerden sonst weiterhin (mit ihrer
    // eigenen `started`-Sperre) leer laufen, ohne dass irgendwer reagiert.
    if (challenge?.kind === 'duel-online') {
      NetworkDuelSystem.updateHandlers({
        onOpponentDisconnected: (playerIndex) => {
          if (playerIndex === this.playerIndex || this.opponentTerminal.has(playerIndex)) return;
          this.opponentGone.add(playerIndex);
          eventBus.emitEvent(GameEvent.OpponentDisconnected, { playerIndex });
        },
        // Uebersetzt vom Kanal auf den EventBus: `systems/` kennt Phaser
        // nicht (Regel 6) und das HUD soll keine Netzwerkverbindung kennen
        // (ADR-0003) - diese Scene sitzt als einzige zwischen beiden.
        onOpponentLiveState: ({ score, activity }, playerIndex) => {
          if (playerIndex === this.playerIndex) return;
          this.opponentLastSeenAt.set(playerIndex, this.time.now);
          this.opponentGone.delete(playerIndex);
          if (activity === 'finished' || activity === 'left') {
            this.opponentTerminal.add(playerIndex);
          }
          eventBus.emitEvent(GameEvent.OpponentLiveState, { score, activity, playerIndex });
        },
      });

      this.startLiveBroadcast();
    }

    // Der Messpunkt beginnt nach dem Scene-Aufbau. So misst startupMs den
    // sichtbaren Weg bis "LOS!" und nicht die Boot-/Asset-Ladezeit aller
    // bereits registrierten Phaser-Scenes.
    this.performanceMonitor?.reset();
    this.runCountdown();

    // Aufraeumen bei Scene-Restart, damit keine Objekte oder Listener leaken.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  // --- Anfragen aus dem HUD -------------------------------------------------

  // Als Klassenfelder, damit `offEvent` dieselbe Referenz bekommt wie
  // `onEvent` - sonst wird nicht abgemeldet (CODE_STYLE.md 1.4).
  private readonly onPauseRequested = (): void => this.togglePause();
  private readonly onAbortRequested = (): void => {
    void this.abortRun();
  };

  // Im Duell meldet das HUD damit, dass der Pausenbildschirm wieder zu ist -
  // angehalten war nichts (Fairness-Regel), aber der Gegner soll sehen, dass
  // hier wieder hingeschaut wird.
  private readonly onRunResumed = (): void => this.setLocalActivity('playing');

  // Kein EventBus-Handler, sondern ein DOM-Listener: Die Unterbrechung kommt
  // vom Geraet, nicht aus dem Spiel. Als Klassenfeld, damit
  // `removeEventListener` dieselbe Referenz bekommt (CODE_STYLE.md 1.4).
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.pauseForInterruption();
  };

  update(_time: number, delta: number): void {
    if (this.phase === 'ended') return;

    const dtSec = delta / 1000;

    // Die Einblendung 3-2-1-LOS bleibt bestehen, darf aber nicht wie ein
    // kaputter Touch-Start wirken. Bewegung ist bereits waehrend des Countdowns
    // aktiv; Spawns, Timer und Wertung beginnen weiterhin erst mit `running`.
    if (this.phase === 'countdown') {
      this.updatePlayer(dtSec);
      this.player.updateTalentVisuals(delta, [], 0);
      return;
    }

    this.updatePlayer(dtSec);
    this.updateCombo(delta);
    this.updateCollectibles(dtSec, delta);
    this.player.updateTalentVisuals(delta, this.collectibles, this.scoring.comboTimerRatio);
    this.updateObstacles(delta);
    this.updateSpawning(delta);
    this.updateTimer(delta);
    this.checkOpponentAlive();
    this.performanceMonitor?.recordFrame(
      delta,
      this.collectibles.length + this.obstacles.length,
      this.children.list.filter((child) => child.type === 'ParticleEmitter').length,
    );
  }

  // --- Update-Schritte ------------------------------------------------------

  private updatePlayer(dtSec: number): void {
    const direction = this.input_.getDirection(this.player.x, this.player.y);
    this.player.move(dtSec, direction, this.playfield);
    this.playerPosition.set(this.player.x, this.player.y);
    this.player.updateThreeD(dtSec * 1000);
  }

  private updateCombo(deltaMs: number): void {
    const { comboReset } = this.scoring.update(deltaMs);
    if (comboReset) {
      eventBus.emitEvent(GameEvent.ComboChanged, { combo: 0, multiplier: 1 });
      this.player.setSeriesTrail(null);
    }
  }

  private updateCollectibles(dtSec: number, deltaMs: number): void {
    const magnetSource = this.stats.magnetRadius > 0 ? this.playerPosition : null;

    // Rueckwaerts iterieren: wir entfernen waehrend des Durchlaufs aus dem Array.
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const orb = this.collectibles[i];
      if (!orb) continue;

      if (orb.isCollected) continue;

      orb.tick(
        dtSec,
        deltaMs,
        this.playfield,
        magnetSource,
        this.stats.magnetRadius,
        this.stats.magnetPullSpeed,
      );

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
      this.collectibles.length + this.obstacles.length,
      this.player.x,
      this.player.y,
    );

    if (!request) return;
    if (request.kind === 'obstacle' && request.obstacleMode) {
      this.spawnObstacle(request.x, request.y, request.obstacleMode);
    } else {
      this.spawnCollectible(request.x, request.y, request.rarity, request);
    }
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

  private spawnCollectible(
    x: number,
    y: number,
    rarity: RarityDef,
    options: {
      lifetimeScale?: number;
      driftMultiplier?: number;
      blinking?: boolean;
      driftAngle?: number;
    } = {},
  ): void {
    this.collectibles.push(
      new Collectible(
        this,
        x,
        y,
        rarity,
        planetTextureForVariant(this.world.spaceVariant),
        options,
      ),
    );
  }

  private spawnObstacle(x: number, y: number, kind: 'brake' | 'penalty'): void {
    this.obstacles.push(new Obstacle(this, x, y, kind, this.world.accent));
  }

  private updateObstacles(deltaMs: number): void {
    for (let index = this.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = this.obstacles[index];
      if (!obstacle) continue;
      obstacle.tick(deltaMs, this.playfield);

      const reach = this.player.collectRadius + obstacle.radius;
      const touching =
        Phaser.Math.Distance.Squared(this.player.x, this.player.y, obstacle.x, obstacle.y) <=
        reach * reach;
      if (!touching || !obstacle.canHit()) continue;

      obstacle.markHit();
      const obstacleEffectScale = 1 - this.stats.obstacleResistance;
      if (obstacle.kind === 'brake') {
        this.player.applySlow(
          WORLD_BRAKE_DURATION_MS * obstacleEffectScale,
          1 - (1 - WORLD_BRAKE_FACTOR) * obstacleEffectScale,
        );
        floatingScore(this, obstacle.x, obstacle.y, 'VERLANGSAMT', 0x38bdf8);
      } else {
        const penaltyMs = Math.round(WORLD_PENALTY_MS * obstacleEffectScale);
        this.remainingMs = Math.max(0, this.remainingMs - penaltyMs);
        this.scoring.registerMiss();
        const penaltyLabel = `-${(penaltyMs / 1000).toFixed(1).replace('.', ',')} s`;
        floatingScore(this, obstacle.x, obstacle.y, penaltyLabel, 0xa855f7);
        if (!prefersReducedMotion()) this.cameras.main.shake(120, 0.004);
      }
      eventBus.emitEvent(GameEvent.ObstacleHit, { kind: obstacle.kind });
      obstacle.destroy();
      this.obstacles.splice(index, 1);
    }
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
    floatingScore(this, orb.x, orb.y, `+${outcome.awardedPoints}`, orb.rarity.color, {
      bonus: outcome.streakBonus,
      bonusMultiplier: outcome.multiplier,
      intensity: this.stats.talentRanks.fortune / talentMaxRank('fortune'),
    });
    if (this.stats.talentRanks.insight > 0) {
      floatingScore(this, orb.x, orb.y + 30, `+${outcome.xpGained} XP`, 0x7ee787, {
        kind: 'xp',
        intensity: this.stats.talentRanks.insight / talentMaxRank('insight'),
      });
    }
    this.player.pulse(orb.rarity.color);
    this.player.setSeriesTrail(trailTierForSeries(outcome.combo));

    // Kamera-Ruckler skaliert mit dem Wert - Legendaeres soll sich fett anfuehlen.
    if (isImpact && !prefersReducedMotion()) {
      this.cameras.main.shake(180, 0.006);
      this.cameras.main.flash(140, 255, 255, 255, false);
    }

    eventBus.emitEvent(GameEvent.Collected, {
      rarityId: orb.rarity.id,
      basePoints: orb.rarity.points,
      awardedPoints: outcome.awardedPoints,
      combo: outcome.combo,
      multiplier: outcome.multiplier,
      sameRarityStreak: outcome.sameRarityStreak,
      streakBonus: outcome.streakBonus,
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
    if (this.mode !== 'solo') {
      this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 110,
          ChallengeSystem.playerLabel(this.playerIndex).toUpperCase(),
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

    const online = this.challenge?.kind === 'duel-online' ? this.challenge.online : null;
    if (online?.startAtServerMs !== null && online?.startAtServerMs !== undefined) {
      this.runOnlineCountdown(label, online.startAtServerMs, online.clockOffsetMs);
      return;
    }

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

  /**
   * Countdown bis zu einer fixen Zielzeit statt einer festen Schrittzahl.
   *
   * `startAtServerMs` ist die vom Gastgeber serverseitig gesetzte, fuer
   * beide Geraete gleiche Startzeit (siehe `NetworkDuelSystem.setStartTime`).
   * `localStartAt = startAtServerMs - clockOffsetMs` rechnet sie auf die
   * eigene Geraeteuhr um (`clockOffsetMs` ist positiv, wenn die Serveruhr
   * vorgeht - `NetworkDuelSystem.measureClockOffset`). Ein Tick alle
   * `COUNTDOWN_STEP_MS` zeigt die verbleibenden ganzen Sekunden, exakt beim
   * Erreichen der Zielzeit erscheint "LOS!" - unabhaengig davon, wie viele
   * Sekunden das tatsaechlich waren (der Server-Vorlauf ist
   * `ONLINE_DUEL_START_LEAD_MS`, aber diese Funktion selbst kennt und
   * braucht diesen Wert nicht, sie zaehlt nur bis zur uebergebenen Zeit).
   */
  private runOnlineCountdown(
    label: Phaser.GameObjects.Text,
    startAtServerMs: number,
    clockOffsetMs: number,
  ): void {
    const localStartAt = startAtServerMs - clockOffsetMs;

    const tick = () => {
      const remainingMs = localStartAt - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      if (remainingMs > 0) {
        label.setText(String(Math.max(1, remainingSeconds)));
        label.setScale(1.6).setAlpha(1);
        this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.Out' });
        // Kurzes Intervall statt an Sekundengrenzen auszurichten - einfacher
        // als ein Drift-freier Zeitgeber und bei einem 1s-Countdown-Text
        // nicht sichtbar ungenau.
        this.time.delayedCall(Math.min(COUNTDOWN_STEP_MS, remainingMs), tick);
        return;
      }

      label.setText('LOS!');
      label.setScale(1.6).setAlpha(1);
      this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.Out' });
      this.tweens.add({ targets: label, alpha: 0, duration: 300, delay: 200 });
      this.startRun();
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
    this.performanceMonitor?.markRunStarted();
    this.spawner.reset();
    eventBus.emitEvent(GameEvent.RunStarted, {
      worldId: this.world.id,
      durationMs: this.totalMs,
    });
  }

  private endRun(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.performanceMonitor?.finishRun();

    const stats = {
      ...this.scoring.toRunStats(this.world.id),
      durationMs: this.totalMs,
      completedAt: new Date().toISOString(),
    };

    // Ein Duell-Durchgang laesst den Spielstand unberuehrt: die Haelfte der
    // Durchgaenge spielt jemand, dem er nicht gehoert (config/challenge.ts).
    // Der Tageslauf ist die bewusste Ausnahme: gleiche Ausgangswerte sorgen
    // fuer Fairness, der fertig gespielte Lauf ist trotzdem echter Fortschritt.
    if (this.mode !== 'solo' && this.challenge?.kind !== 'duel-online') {
      ChallengeSystem.submitRound(stats);
      if (this.challenge?.kind === 'bot') {
        // Die Praemie wird lokal sofort sichtbar, muss aber auch serverseitig
        // gebucht werden: sonst loescht sie der naechste Profilabgleich wieder
        // (AUDIT_2026-09-05, Befund 6).
        const reward = ChallengeSystem.awardBotVictory();
        if (reward) ProgressSyncSystem.enqueueBotVictory(reward.matchId);
      }
      if (this.mode === 'daily') {
        const progression = ProgressionSystem.applyRun(stats);
        const eventId = ProgressSyncSystem.enqueueRun(
          stats,
          progression,
          this.challenge?.dailyKey ?? null,
        );
        ChallengeSystem.completeDaily(stats, eventId);
        void ProgressSyncSystem.flush();
      }

      this.time.delayedCall(450, () => {
        this.scene.stop(SceneKey.Hud);
        this.scene.start(SceneKey.Challenge);
      });
      return;
    }

    if (this.challenge?.kind === 'duel-online') {
      const round = {
        score: stats.score,
        bestCombo: stats.bestCombo,
        totalCollected: stats.totalCollected,
        durationMs: stats.durationMs,
        collected: stats.collected,
      };
      const playerIndex = this.playerIndex;

      // Vor dem Ergebnis: der Gegner spielt womoeglich noch und soll sofort
      // sehen, dass hier fertig gespielt ist - nicht erst, wenn er selbst
      // ankommt.
      this.localActivity = 'finished';
      NetworkDuelSystem.broadcastLiveState(playerIndex, {
        score: stats.score,
        activity: 'finished',
      });

      ChallengeSystem.submitOnlineRound(playerIndex, round);

      // Zwei Wege, absichtlich: der Broadcast ist der schnelle Fall (Gegner
      // ist schon im Ergebnisbildschirm und hoert zu), die RPC der sichere
      // (Gegner spielt noch und hat gar keinen Empfaenger). Ohne den zweiten
      // Weg blieben beide Geraete auf "WARTE AUF ERGEBNIS" stehen -
      // Testbericht v0.1.236, 2026-08-22.
      NetworkDuelSystem.broadcastRoundResult(playerIndex, round);
      const roomCode = this.challenge.online?.roomCode ?? '';
      if (roomCode) {
        // `submitRoundResult` wiederholt Transportfehler selbst. Scheitert es
        // endgueltig, wertet die Rangliste dieses Match nicht - das gehoert
        // sichtbar ins Debug-Protokoll und nicht stillschweigend verworfen
        // (AUDIT_2026-09-05, Befund 4).
        void NetworkDuelSystem.submitRoundResult(
          roomCode,
          playerIndex === 0,
          round,
          this.challenge.online?.participantToken ?? '',
        ).then((submitted) => {
          if (submitted.ok) return;
          DebugSystem.pushLogEntry({
            timestamp: Date.now(),
            kind: 'error',
            label: 'duel:result-lost',
            detail: `Ergebnis nicht gespeichert: ${submitted.error}`,
          });
        });
      }

      this.time.delayedCall(450, () => {
        this.scene.stop(SceneKey.Hud);
        this.scene.start(SceneKey.OnlineDuel, { phase: 'result' });
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

  /** Nur im DEV-Build fuer den Performance-Check sichtbar. */
  getPerformanceReport(): PerformanceReport | null {
    return this.performanceMonitor?.getReport() ?? null;
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
    if (this.mode !== 'solo') {
      // Der Gegner soll sehen, dass hier gerade niemand hinschaut - seine
      // Punktzahl steigt derweil weiter, denn die Simulation laeuft.
      this.setLocalActivity('away');
      eventBus.emitEvent(GameEvent.RunPaused, { reason: 'manual' });
      return;
    }

    if (this.scene.isPaused()) {
      this.scene.resume();
      eventBus.emitEvent(GameEvent.RunResumed, undefined);
    } else {
      this.scene.pause();
      eventBus.emitEvent(GameEvent.RunPaused, { reason: 'manual' });
    }
  }

  /**
   * Haelt den Run an, weil das Geraet die Seite verlassen hat - Anruf,
   * Bildschirmsperre, App-Wechsel.
   *
   * **Warum nicht `togglePause()`:** Das waere ein Umschalter. iOS sendet
   * `visibilitychange` mehrfach kurz hintereinander (Kontrollzentrum ueber
   * der Seite, dann echter Wechsel); ein Umschalter startete den Run beim
   * zweiten Ereignis wieder - bei ausgeschaltetem Bildschirm. Diese Methode
   * pausiert nur, sie setzt nie fort.
   *
   * **Warum kein automatisches Fortsetzen bei der Rueckkehr:** Wer aus einem
   * Anruf zurueckkommt, haelt den Finger nicht schon auf dem Glas. Ein Run,
   * der ohne Vorwarnung weiterlaeuft, kostet genau die Sekunden, die der
   * Spieler zum Ankommen braucht. Fortgesetzt wird ueber den vorhandenen
   * Knopf im Pause-Bildschirm.
   */
  pauseForInterruption(): void {
    if (this.phase !== 'running') return;

    // Im Duell laeuft die Simulation weiter (dieselbe Fairness-Regel wie im
    // Umschalter oben), der Hinweis erscheint aber trotzdem: Ohne ihn wirkt
    // ein zurueckkehrender Spieler auf einen eingefrorenen Bildschirm - genau
    // die Beobachtung, die diesen Punkt ausgeloest hat ("Bildschirm hing,
    // nichts ging mehr"). Phaser haelt die Update-Schleife im Hintergrund
    // ohnehin an; ein Vorteil entsteht durch den Hinweis also nicht.
    if (this.mode !== 'solo') {
      this.setLocalActivity('away');
      eventBus.emitEvent(GameEvent.RunPaused, { reason: 'interrupted' });
      return;
    }

    if (this.scene.isPaused()) return;
    this.scene.pause();
    eventBus.emitEvent(GameEvent.RunPaused, { reason: 'interrupted' });
  }

  /**
   * Bricht den laufenden Run ab, ohne ihn zu werten.
   *
   * Kein XP, kein Bestwert, kein Erfolg: Ein abgebrochener Run ist kein
   * Ergebnis. Wer bei schlechtem Lauf abbrechen und es dennoch gewertet
   * bekommen koennte, haette einen Grund, jeden mittelmaessigen Run
   * wegzuwerfen - das waere kein Spiel mehr, sondern eine Auslese.
   */
  async abortRun(): Promise<void> {
    if (this.phase === 'ended') return;

    // Vor dem Setzen von `ended` und vor `ChallengeSystem.clear()`: der
    // Sender prueft die Phase, und `clear()` nimmt ihm die Zuordnung. Danach
    // waere die Meldung still verschwunden, und der Gegner saehe den
    // Aussteiger bis zum Rundenende als "spielt".
    this.setLocalActivity('left');
    const onlineRoom = this.challenge?.kind === 'duel-online' ? this.challenge.online : undefined;
    this.phase = 'ended';

    // Auch beim direkten ABBRECHEN aus GameScene muss der alte Realtime-
    // Zustand verschwinden. Sonst bleiben Kanal-Handler an der beendeten
    // Scene haengen und blockieren den naechsten Netzwerk-Duell-Einstieg bis zum
    // kompletten App-Neustart.
    if (onlineRoom?.roomCode && onlineRoom.participantToken) {
      await NetworkDuelSystem.leaveRoom(onlineRoom.roomCode, onlineRoom.participantToken);
    }
    if (!this.scene.isActive()) return;
    if (onlineRoom) {
      NetworkDuelSystem.unsubscribeFromRoom();
      NetworkDuelSystem.unsubscribeFromDuelLobby();
    }

    // Die Scene laeuft moeglicherweise pausiert - sonst bleibt sie es auch
    // nach dem Wechsel und der naechste Run startet eingefroren.
    if (this.scene.isPaused()) this.scene.resume();

    // Ein abgebrochenes Duell wird ganz verworfen, nicht bei der Uebergabe
    // fortgesetzt: Ohne den Durchgang des Aussteigers gibt es nichts zu
    // vergleichen, und ein halber Zustand schickte die ChallengeScene in die
    // falsche Phase.
    if (this.mode !== 'solo') ChallengeSystem.clear();

    this.scene.stop(SceneKey.Hud);
    this.scene.start(SceneKey.Menu);
  }

  // --- Netzwerk-Duell: Live-Stand -------------------------------------------

  /**
   * Startet den Taktgeber fuer den eigenen Zwischenstand.
   *
   * Fester Takt statt "bei jeder Punktaenderung": `ScoreChanged` feuert bei
   * jedem einzelnen Fang, in einer Kette mehrmals pro Sekunde. Wichtiger ist
   * aber, dass der Takt auch dann laeuft, wenn gerade NICHTS passiert - genau
   * dann traegt er die Information "ich bin noch da". Ein ereignisgesteuerter
   * Sender waere beim Zuschauen still und vom Verbindungsabbruch nicht zu
   * unterscheiden.
   */
  private startLiveBroadcast(): void {
    const playerCount = this.challenge?.playerCount ?? 2;
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      if (playerIndex !== this.playerIndex) {
        this.opponentLastSeenAt.set(playerIndex, this.time.now);
      }
    }
    this.liveBroadcastTimer = this.time.addEvent({
      delay: ONLINE_DUEL_SCORE_BROADCAST_INTERVAL_MS,
      loop: true,
      callback: () => this.sendLiveState(),
    });
  }

  private sendLiveState(): void {
    if (this.phase === 'ended') return;
    NetworkDuelSystem.broadcastLiveState(this.playerIndex, {
      score: this.scoring.currentScore,
      activity: this.localActivity,
    });
  }

  /**
   * Meldet einen Zustandswechsel sofort, statt auf den naechsten Takt zu
   * warten.
   *
   * Bei einem Wechsel zaehlt die Unmittelbarkeit: "steigt aus" oder "schaut
   * weg" ist die Information, auf die der andere reagiert. 400ms Verzoegerung
   * waeren bei einer laufenden Punktzahl belanglos, bei einem Ausstieg aber
   * spuerbar.
   */
  private setLocalActivity(activity: NetworkDuelSystem.DuelOpponentActivity): void {
    if (this.challenge?.kind !== 'duel-online') return;
    if (this.localActivity === activity) return;
    this.localActivity = activity;
    this.sendLiveState();
  }

  /**
   * Erkennt einen Gegner, der verstummt ist.
   *
   * Presence meldet nur ein sauberes Verlassen des Kanals. Ein Funkloch, eine
   * eingefrorene App oder ein leerer Akku erzeugen kein `leave` - dort bleibt
   * es einfach still, und ohne diesen Test staende der letzte Punktestand bis
   * zum Rundenende unveraendert da, als spiele der Gegner weiter.
   */
  private checkOpponentAlive(): void {
    if (!this.liveBroadcastTimer || this.challenge?.kind !== 'duel-online') return;

    const playerCount = this.challenge.playerCount ?? 2;
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      if (playerIndex === this.playerIndex || this.opponentTerminal.has(playerIndex)) continue;
      const lastSeenAt = this.opponentLastSeenAt.get(playerIndex);
      if (lastSeenAt === undefined || this.time.now - lastSeenAt <= ONLINE_DUEL_LIVE_STALE_MS) {
        continue;
      }
      if (this.opponentGone.has(playerIndex)) continue;
      this.opponentGone.add(playerIndex);
      eventBus.emitEvent(GameEvent.OpponentDisconnected, { playerIndex });
    }
  }

  private cleanup(): void {
    if (this.liveBroadcastTimer) {
      this.liveBroadcastTimer.remove();
      this.liveBroadcastTimer = null;
    }
    eventBus.offEvent(GameEvent.PauseRequested, this.onPauseRequested);
    eventBus.offEvent(GameEvent.AbortRequested, this.onAbortRequested);
    eventBus.offEvent(GameEvent.RunResumed, this.onRunResumed);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    for (const orb of this.collectibles) orb.destroy();
    this.collectibles = [];
    for (const obstacle of this.obstacles) obstacle.destroy();
    this.obstacles = [];
  }

  // --- Debug ----------------------------------------------------------------

  private installDebugKeys(): void {
    new DebugKeys(this, {
      spawnRarity: (rarity) => {
        const request = this.spawner.forceSpawn(rarity, this.player.x, this.player.y);
        this.spawnCollectible(request.x, request.y, rarity, request);
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
        console.warn('[debug] Spielstand zurückgesetzt');
      },
    });
  }
}
