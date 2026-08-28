/**
 * Das HUD laeuft als eigene Scene ueber der GameScene.
 *
 * Warum getrennt: Die Anzeige braucht kein Spiellogik-Wissen und die Logik
 * kein Anzeige-Wissen. Kommunikation ausschliesslich ueber den EventBus. So
 * laesst sich das HUD komplett umbauen, ohne GameScene anzufassen - und die
 * GameScene liesse sich sogar headless testen.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { eventBus, GameEvent } from '@/core/EventBus';
import { SceneKey } from '@/scenes/SceneKey';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import type { BarHandle } from '@/ui/widgets';
import { burst, createBar, createButton, createPanel } from '@/ui/widgets';
import type { RunMode } from '@/types';

/**
 * Layout-Koordinaten fuer die kompakten Laufzeitinformationen.
 *
 * Der Gegnerstand steht links unterhalb der Timerleiste, Serie und
 * Multiplikator rechts darunter. Dadurch bleibt der eigene Punktestand in der
 * Mitte frei und alle drei Informationen koennen dauerhaft sichtbar bleiben.
 */
const DUEL_OPPONENT_X = 60;
const DUEL_OPPONENT_Y = 48;

/**
 * Abstand zwischen Gegnerstand und Trennmeldung.
 *
 * Eine volle Zeilenhoehe fuer die kleine Warnschrift plus Luft: beide Zeilen
 * koennen gleichzeitig sichtbar sein - "Freund 0 · Verbindung weg" und
 * "Verbindung zum Freund unterbrochen" traten am Geraet genau so zusammen
 * auf (2026-08-23), damals uebereinander gedruckt.
 */
const DUEL_LINE_HEIGHT = 30;

/** Rechte obere Ecke fuer Serie und Multiplikator. */
const DUEL_STATS_X = GAME_WIDTH - 60;
const DUEL_STATS_Y = 76;
const DUEL_STATS_GAP = 32;

export interface HudSceneData {
  worldId: string;
  durationMs: number;
  mode?: RunMode;
  /** Im Duell: wer gerade spielt. Sonst null. */
  playerLabel?: string | null;
  /** Im Duell ab Durchgang zwei: die Vorlage des Gegners. Sonst null. */
  scoreToBeat?: number | null;
  /** Kompakte Anzeige der aktiven Talentverstaerkungen im laufenden Run. */
  talentSummary?: string;
  /** Nur im Netzwerk-Duell: Name des Gegners fuer die Live-Zeile. */
  opponentLabel?: string | null;
  /**
   * Nur im Netzwerk-Duell: dann zeigt das HUD den laufenden Stand des
   * Gegners. Als Flag vom Aufrufer statt per `ChallengeSystem`-Abfrage -
   * dieselbe Linie wie `playerLabel`/`scoreToBeat`: das HUD stellt dar, es
   * entscheidet nicht, welche Duell-Art laeuft (ADR-0003).
   */
  showOpponentLive?: boolean;
}

export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private multiplierBurstText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private targetText: Phaser.GameObjects.Text | null = null;
  private opponentDisconnectedText!: Phaser.GameObjects.Text;
  /** Nur im Netzwerk-Duell: laufender Stand des Gegners. */
  private opponentLiveText: Phaser.GameObjects.Text | null = null;
  private multiplierText!: Phaser.GameObjects.Text;
  private opponentLabel = 'Freund';
  private opponentScore = 0;
  /** Eigener Stand, gespiegelt fuer den Abstandsvergleich in der Gegnerzeile. */
  private lastOwnScore = 0;
  private lastOpponentActivity: 'playing' | 'away' | 'left' | 'finished' | 'gone' = 'playing';
  private timerBar!: BarHandle;
  private accent = 0xffffff;
  private scoreToBeat: number | null = null;
  private hasOvertaken = false;
  private mode: RunMode = 'solo';
  private lastComboMultiplier = 1;
  /** Alle Teile des Pause-Bildschirms - zusammen ein- und ausgeblendet. */
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: SceneKey.Hud, active: false });
  }

  create(data: HudSceneData): void {
    const world = getWorld(data.worldId);
    this.accent = world.accent;
    this.scoreToBeat = data.scoreToBeat ?? null;
    this.hasOvertaken = false;
    this.mode = data.mode ?? 'solo';
    this.opponentLabel = data.opponentLabel?.trim() || 'Freund';
    this.lastComboMultiplier = 1;
    this.pauseOverlay = [];

    // Dunkle Kappe hinter der Kopfzeile: der Punktestand muss auch dann lesbar
    // bleiben, wenn gerade ein helles Relikt darunter treibt.
    this.add
      .image(GAME_WIDTH / 2, 0, TextureKey.Glow)
      .setDisplaySize(GAME_WIDTH * 1.6, 300)
      .setTint(0x000000)
      .setAlpha(0.55)
      .setOrigin(0.5, 0.35)
      .setDepth(Depth.Backdrop);

    this.worldText = this.add
      .text(
        GAME_WIDTH / 2,
        34,
        (data.playerLabel ?? world.name).toUpperCase(),
        textStyle(FontSize.tiny, data.playerLabel ? Palette.gold : Palette.inkDim),
      )
      .setOrigin(0.5, 0);
    this.worldText.setLetterSpacing(6);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 62, '0', textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5, 0);

    this.comboText = this.add
      .text(
        DUEL_STATS_X,
        DUEL_STATS_Y,
        'SERIE 0',
        textStyle(FontSize.body, toCss(this.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(1, 0);

    this.multiplierText = this.add
      .text(
        DUEL_STATS_X,
        DUEL_STATS_Y + DUEL_STATS_GAP,
        '×1',
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(1, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        168,
        data.talentSummary ?? '',
        textStyle(FontSize.tiny, Palette.gold, {
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }),
      )
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(GAME_WIDTH - 90)
      .setLineSpacing(2)
      .setAlpha(data.talentSummary ? 1 : 0);

    this.multiplierBurstText = this.add
      .text(
        GAME_WIDTH / 2,
        250,
        '',
        textStyle(FontSize.title, toCss(this.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay)
      .setAlpha(0);

    this.timerBar = createBar(this, 60, 24, GAME_WIDTH - 120, 8, this.accent);
    this.timerBar.setRatio(1);

    // Live-Spielstand ohne Panel-Unterlage - braucht den hellen Standardton,
    // nicht den gedaempften: er muss auf jedem der zehn Welt-Hintergruende
    // lesbar bleiben, nicht nur auf dunklen Panels.
    this.timerText = this.add
      .text(
        GAME_WIDTH - 60,
        40,
        String(Math.ceil(data.durationMs / 1000)),
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(1, 0);

    // Im zweiten Duell-Durchgang steht links, was zu schlagen ist. Ohne diese
    // Zahl waere der zweite Spieler bis zum Ergebnisbildschirm blind.
    if (this.scoreToBeat !== null) {
      this.targetText = this.add
        .text(
          60,
          40,
          `Ziel ${this.scoreToBeat.toLocaleString('de-DE')}`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0, 0);
    }

    // Netzwerk-Duell: links oben, damit die Gegnerinfo nicht mehr mit der
    // Serienanzeige oder dem eigenen Punktestand konkurriert. Die Anzeige
    // bleibt bis zum ersten Stand unsichtbar; eine vorgezogene "0" waere
    // nicht von einem tatsaechlich bei null stehenden Gegner zu unterscheiden.
    if (data.showOpponentLive) {
      this.opponentLiveText = this.add
        .text(DUEL_OPPONENT_X, DUEL_OPPONENT_Y, '', textStyle(FontSize.small, Palette.inkDim))
        .setOrigin(0, 0)
        .setAlpha(0);
    }

    // Nur beim Netzwerk-Duell relevant, deshalb erst bei Bedarf eingeblendet
    // statt fest reserviertem Platz - ein Verbindungsabbruch soll auffallen,
    // aber im Normalfall (keine Trennung) nicht staendig Raum beanspruchen.
    this.opponentDisconnectedText = this.add
      .text(
        DUEL_OPPONENT_X,
        DUEL_OPPONENT_Y + DUEL_LINE_HEIGHT,
        '',
        textStyle(FontSize.tiny, Palette.danger),
      )
      .setOrigin(0, 0)
      .setAlpha(0);

    this.buildPauseButton();

    this.registerEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregisterEvents());
  }

  // --- Pause ----------------------------------------------------------------

  /**
   * Pause-Knopf unten rechts.
   *
   * Nicht oben: Dort stehen Punktestand, Timer und im Duell die Vorlage - und
   * oben ist die Ecke, in die man beim Spielen schaut. Unten rechts liegt er in
   * Daumenreichweite und trotzdem ausserhalb des Spielfelds
   * (PLAYFIELD_PADDING_BOTTOM haelt die unteren 120 px frei).
   */
  private buildPauseButton(): void {
    createButton(this, GAME_WIDTH - 92, GAME_HEIGHT - 58, 'II', () => this.requestPause(), {
      width: 96,
      height: 60,
      accent: 0x9aa3bd,
      fontSize: FontSize.small,
    }).container.setDepth(Depth.Overlay);
  }

  private requestPause(): void {
    // Nur bitten - ausgefuehrt wird es in der GameScene, die als einzige weiss,
    // ob der Run ueberhaupt laeuft (Countdown, Ende).
    eventBus.emitEvent(GameEvent.PauseRequested, undefined);
  }

  /**
   * Der Pause-Bildschirm.
   *
   * Wird beim Ereignis `RunPaused` aufgebaut und bei `RunResumed` wieder
   * abgeraeumt - nicht beim Tippen auf den Knopf. Dadurch erscheint er genau
   * dann, wenn die Simulation wirklich steht, und nicht schon, wenn sie darum
   * gebeten wurde.
   */
  private showPauseOverlay(reason: 'manual' | 'interrupted' = 'manual'): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const shade = this.add
      .image(cx, cy, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x000000)
      .setAlpha(0.72)
      .setDepth(Depth.Overlay)
      // Faengt Tipps ab, die sonst neben den Knoepfen ins Spielfeld gingen.
      .setInteractive();

    const panel = createPanel(this, cx, cy - 20, GAME_WIDTH - 140, 440, Palette.goldHex, {
      alpha: 0.85,
    });
    panel.setDepth(Depth.Overlay);

    // Wer selbst auf Pause getippt hat, weiss warum. Wer aus einem Anruf
    // zurueckkommt, sieht sonst nur einen stehenden Bildschirm - genau das
    // wirkte im Test wie ein Absturz.
    const title = this.add
      .text(
        cx,
        cy - 190,
        reason === 'interrupted' ? 'ANGEHALTEN' : 'PAUSE',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay);
    title.setLetterSpacing(6);

    this.pauseOverlay.push(shade, panel, title);

    if (reason === 'interrupted' && this.mode !== 'challenge') {
      const why = this.add
        .text(
          cx,
          cy - 130,
          'Die App war kurz im Hintergrund.',
          textStyle(FontSize.small, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setDepth(Depth.Overlay);
      this.pauseOverlay.push(why);
    }

    // Im Duell gibt es kein Fortsetzen: Wer pausiert, waehrend ein legendaeres
    // Relikt erscheint, koennte in Ruhe zielen - das bricht die Fairness
    // (config/challenge.ts). Aussteigen darf man trotzdem.
    //
    // Bei einer Unterbrechung ist der Text ein anderer: "laesst sich nicht
    // pausieren" waere dort eine Antwort auf eine Frage, die der Spieler nie
    // gestellt hat - er hat nicht getippt, sein Geraet hat entschieden.
    if (this.mode === 'challenge') {
      const note = this.add
        .text(
          cx,
          cy - 90,
          reason === 'interrupted'
            ? 'Die App war kurz im Hintergrund.\nIm Duell läuft der Durchgang weiter.'
            : 'Im Duell lässt sich nicht pausieren.\nDer Durchgang läuft weiter.',
          textStyle(FontSize.small, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setAlign('center')
        .setLineSpacing(6)
        .setDepth(Depth.Overlay);
      this.pauseOverlay.push(note);
    }

    // Im Duell laeuft die Simulation weiter, es gibt also nichts fortzusetzen -
    // der Bildschirm wird nur wieder zugeklappt. Ein `PauseRequested` wuerde
    // dort ein zweites `RunPaused` ausloesen und das Overlay verdoppeln.
    const resume = createButton(
      this,
      cx,
      cy + 10,
      this.mode === 'challenge' ? 'ZURÜCK INS SPIEL' : 'WEITER',
      () => (this.mode === 'challenge' ? this.closeDuelPause() : this.requestPause()),
      {
        width: 400,
        height: 88,
        accent: Palette.goldHex,
        fontSize: FontSize.body,
      },
    );
    resume.container.setDepth(Depth.Overlay);
    this.pauseOverlay.push(resume.container);

    const quit = createButton(
      this,
      cx,
      cy + 118,
      this.mode === 'challenge' ? 'DUELL ABBRECHEN' : 'RUN VERLASSEN',
      () => eventBus.emitEvent(GameEvent.AbortRequested, undefined),
      { width: 400, height: 76, accent: 0x9aa3bd, fontSize: FontSize.small },
    );
    quit.container.setDepth(Depth.Overlay);
    this.pauseOverlay.push(quit.container);

    const warning = this.add
      .text(
        cx,
        cy + 180,
        'Ein abgebrochener Run wird nicht gewertet.',
        textStyle(FontSize.tiny, Palette.danger),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay);
    this.pauseOverlay.push(warning);
  }

  /**
   * Klappt den Duell-Pausenbildschirm zu und meldet das weiter.
   *
   * `RunResumed` obwohl nie etwas angehalten war: das Ereignis bedeutet hier
   * "der Bildschirm ist wieder frei, es wird wieder hingeschaut". Die
   * `GameScene` braucht diese Meldung, um dem Gegner den Wechsel von
   * "schaut nicht hin" zurueck auf "spielt" zu senden - ohne sie bliebe die
   * Anzeige beim anderen bis zum Rundenende auf `away` stehen.
   */
  private closeDuelPause(): void {
    this.hidePauseOverlay();
    eventBus.emitEvent(GameEvent.RunResumed, undefined);
  }

  private hidePauseOverlay(): void {
    for (const part of this.pauseOverlay) part.destroy();
    this.pauseOverlay = [];
  }

  // --- Event-Anbindung ------------------------------------------------------

  private readonly onScore = ({ score }: { score: number }): void => {
    this.lastOwnScore = score;
    // Der Abstand in der Gegnerzeile haengt an BEIDEN Staenden - ohne dieses
    // Nachziehen bliebe er stehen, bis der Gegner das naechste Mal sendet.
    if (this.opponentLiveText && this.opponentLiveText.alpha > 0) {
      this.renderOpponentLive(this.lastOpponentActivity);
    }
    this.scoreText.setText(score.toLocaleString('de-DE'));
    // Kurzer Pop bei jeder Aenderung - macht Punktzuwachs spuerbar.
    this.scoreText.setScale(1.12);
    this.tweens.add({ targets: this.scoreText, scale: 1, duration: 180, ease: 'Quad.Out' });

    this.checkOvertake(score);
  };

  /** Der Moment, in dem die Vorlage des Gegners faellt - einmalig gefeiert. */
  private checkOvertake(score: number): void {
    if (this.scoreToBeat === null || this.hasOvertaken || score <= this.scoreToBeat) return;

    this.hasOvertaken = true;

    this.targetText?.setText('IN FÜHRUNG').setColor(Palette.gold);

    const banner = this.add
      .text(
        GAME_WIDTH / 2,
        210,
        'ÜBERHOLT!',
        textStyle(FontSize.large, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(Depth.Overlay);

    this.tweens.add({
      targets: banner,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.7, to: 1 },
      duration: 240,
      ease: 'Back.Out',
      yoyo: true,
      hold: 700,
      onComplete: () => banner.destroy(),
    });
  }

  private readonly onCombo = ({
    combo,
    multiplier,
  }: {
    combo: number;
    multiplier: number;
  }): void => {
    this.comboText.setText(`SERIE ${Math.max(0, combo)}`);
    this.multiplierText.setText(
      `×${multiplier.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`,
    );

    if (combo < 2) {
      this.lastComboMultiplier = 1;
      return;
    }

    this.comboText.setScale(1.2);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.Out' });

    if (multiplier <= this.lastComboMultiplier) return;
    this.lastComboMultiplier = multiplier;
    this.showMultiplierBurst(multiplier);
  };

  private showMultiplierBurst(multiplier: number): void {
    const label = `×${multiplier.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`;
    this.tweens.killTweensOf(this.multiplierBurstText);
    this.multiplierBurstText
      .setText(label)
      .setPosition(GAME_WIDTH / 2, 250)
      .setScale(0.45)
      .setAlpha(0);
    burst(this, GAME_WIDTH / 2, 250, this.accent, 28);
    this.tweens.add({
      targets: this.multiplierBurstText,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.45, to: 1.25 },
      duration: 210,
      ease: 'Back.Out',
      yoyo: true,
      hold: 420,
      onComplete: () => this.multiplierBurstText.setAlpha(0),
    });
  }

  private readonly onTimer = ({
    remainingMs,
    totalMs,
  }: {
    remainingMs: number;
    totalMs: number;
  }): void => {
    const seconds = Math.ceil(remainingMs / 1000);
    this.timerText.setText(String(seconds));
    this.timerBar.setRatio(remainingMs / totalMs);

    // Letzte 10 Sekunden rot - klare Warnung ohne zusaetzliches UI-Element.
    const isCritical = seconds <= 10;
    this.timerBar.setTint(isCritical ? 0xff6b6b : this.accent);
    this.timerText.setColor(isCritical ? Palette.danger : Palette.ink);
  };

  // Schutz gegen doppeltes Aufbauen: Ein zweites `RunPaused` - etwa durch die
  // Debug-Taste bei bereits offenem Bildschirm - wuerde sonst einen zweiten
  // Satz Knoepfe uebereinanderlegen, und der untere bliebe fuer immer stehen.
  private readonly onPaused = (payload: { reason: 'manual' | 'interrupted' }): void => {
    if (this.pauseOverlay.length > 0) return;
    this.showPauseOverlay(payload.reason);
  };
  private readonly onResumed = (): void => this.hidePauseOverlay();
  private readonly onOpponentDisconnected = (): void => {
    this.opponentDisconnectedText
      .setText(`Verbindung zu ${this.opponentLabel} unterbrochen`)
      .setAlpha(1);
    // Der Punktestand bleibt stehen, aber als letzter bekannter - sonst
    // wirkte er wie ein aktueller.
    this.renderOpponentLive('gone');
  };

  private readonly onOpponentLive = ({
    score,
    activity,
  }: {
    score: number;
    activity: 'playing' | 'away' | 'left' | 'finished' | 'gone';
  }): void => {
    this.opponentScore = score;

    // Eine wieder eintreffende Meldung hebt den Trennungshinweis auf: ein
    // kurzes Funkloch soll nicht bis zum Rundenende als Abbruch stehen
    // bleiben.
    if (activity !== 'gone') this.opponentDisconnectedText.setAlpha(0);

    this.renderOpponentLive(activity);
  };

  private readonly onOpponentName = ({ name }: { name: string }): void => {
    const cleanName = name.trim();
    if (!cleanName) return;
    this.opponentLabel = cleanName;
    if (this.opponentDisconnectedText.alpha > 0) {
      this.opponentDisconnectedText.setText(`Verbindung zu ${this.opponentLabel} unterbrochen`);
    }
    if (this.opponentLiveText && this.opponentLiveText.alpha > 0) {
      this.renderOpponentLive(this.lastOpponentActivity);
    }
  };

  /**
   * Schreibt die Gegner-Zeile.
   *
   * `away` wird bewusst NICHT "pausiert" genannt: im Duell laeuft die
   * Simulation weiter (Fairness-Regel in `GameScene.togglePause`), die
   * Punktzahl daneben steigt also sichtbar weiter. "Pausiert" wuerde dem
   * widersprechen und wie ein Anzeigefehler wirken.
   */
  private renderOpponentLive(activity: 'playing' | 'away' | 'left' | 'finished' | 'gone'): void {
    if (!this.opponentLiveText) return;
    this.lastOpponentActivity = activity;

    const points = this.opponentScore.toLocaleString('de-DE');
    const diff = this.opponentScore - this.lastOwnScore;

    const label =
      activity === 'left'
        ? `${this.opponentLabel} ausgestiegen`
        : activity === 'gone'
          ? `${this.opponentLabel} ${points} · Verbindung weg`
          : activity === 'finished'
            ? `${this.opponentLabel} ${points} · fertig`
            : activity === 'away'
              ? `${this.opponentLabel} ${points} · schaut gerade nicht hin`
              : `${this.opponentLabel} ${points}${diff === 0 ? '' : diff > 0 ? ` · ${diff} vorn` : ` · ${-diff} zurueck`}`;

    // Aussteiger und Verbindungsverlust in Warnfarbe, alles andere gedaempft:
    // die Zeile soll beim Spielen nicht um Aufmerksamkeit konkurrieren,
    // ausser wenn sich etwas Endgueltiges geaendert hat.
    const color = activity === 'left' || activity === 'gone' ? Palette.danger : Palette.inkDim;

    this.opponentLiveText.setText(label).setColor(color).setAlpha(1);
  }

  private registerEvents(): void {
    eventBus.onEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.onEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.onEvent(GameEvent.TimerChanged, this.onTimer);
    eventBus.onEvent(GameEvent.RunPaused, this.onPaused);
    eventBus.onEvent(GameEvent.RunResumed, this.onResumed);
    eventBus.onEvent(GameEvent.OpponentDisconnected, this.onOpponentDisconnected);
    eventBus.onEvent(GameEvent.OpponentLiveState, this.onOpponentLive);
    eventBus.onEvent(GameEvent.OpponentNameChanged, this.onOpponentName);
  }

  /**
   * Pflicht: ohne Abmelden wuerden die Listener nach einem Restart der Scene
   * doppelt feuern und auf zerstoerte Text-Objekte zugreifen.
   */
  private unregisterEvents(): void {
    eventBus.offEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.offEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.offEvent(GameEvent.TimerChanged, this.onTimer);
    eventBus.offEvent(GameEvent.RunPaused, this.onPaused);
    eventBus.offEvent(GameEvent.RunResumed, this.onResumed);
    eventBus.offEvent(GameEvent.OpponentDisconnected, this.onOpponentDisconnected);
    eventBus.offEvent(GameEvent.OpponentLiveState, this.onOpponentLive);
    eventBus.offEvent(GameEvent.OpponentNameChanged, this.onOpponentName);
  }
}
