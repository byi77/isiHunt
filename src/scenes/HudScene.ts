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
import { createBar, createButton, createPanel } from '@/ui/widgets';
import type { RunMode } from '@/types';

export interface HudSceneData {
  worldId: string;
  durationMs: number;
  mode?: RunMode;
  /** Im Duell: wer gerade spielt. Sonst null. */
  playerLabel?: string | null;
  /** Im Duell ab Durchgang zwei: die Vorlage des Gegners. Sonst null. */
  scoreToBeat?: number | null;
}

export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private targetText: Phaser.GameObjects.Text | null = null;
  private timerBar!: BarHandle;
  private accent = 0xffffff;
  private scoreToBeat: number | null = null;
  private hasOvertaken = false;
  private mode: RunMode = 'solo';
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
        GAME_WIDTH / 2,
        138,
        '',
        textStyle(FontSize.body, toCss(this.accent), { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0);

    this.timerBar = createBar(this, 60, 24, GAME_WIDTH - 120, 8, this.accent);
    this.timerBar.setRatio(1);

    this.timerText = this.add
      .text(
        GAME_WIDTH - 60,
        40,
        String(Math.ceil(data.durationMs / 1000)),
        textStyle(FontSize.small, Palette.inkDim),
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
          textStyle(FontSize.small, Palette.inkDim),
        )
        .setOrigin(0, 0);
    }

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
  private showPauseOverlay(): void {
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

    const title = this.add
      .text(cx, cy - 190, 'PAUSE', textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(Depth.Overlay);
    title.setLetterSpacing(6);

    this.pauseOverlay.push(shade, panel, title);

    // Im Duell gibt es kein Fortsetzen: Wer pausiert, waehrend ein legendaeres
    // Relikt erscheint, koennte in Ruhe zielen - das bricht die Fairness
    // (config/challenge.ts). Aussteigen darf man trotzdem.
    if (this.mode === 'challenge') {
      const note = this.add
        .text(
          cx,
          cy - 90,
          'Im Duell lässt sich nicht pausieren.\nDer Durchgang läuft weiter.',
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
      () => (this.mode === 'challenge' ? this.hidePauseOverlay() : this.requestPause()),
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

  private hidePauseOverlay(): void {
    for (const part of this.pauseOverlay) part.destroy();
    this.pauseOverlay = [];
  }

  // --- Event-Anbindung ------------------------------------------------------

  private readonly onScore = ({ score }: { score: number }): void => {
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
    if (combo < 2) {
      this.comboText.setText('');
      return;
    }

    this.comboText.setText(`${combo}er Kette   x${multiplier}`);
    this.comboText.setScale(1.2);
    this.tweens.add({ targets: this.comboText, scale: 1, duration: 200, ease: 'Back.Out' });
  };

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
    this.timerText.setColor(isCritical ? Palette.danger : Palette.inkDim);
  };

  // Schutz gegen doppeltes Aufbauen: Ein zweites `RunPaused` - etwa durch die
  // Debug-Taste bei bereits offenem Bildschirm - wuerde sonst einen zweiten
  // Satz Knoepfe uebereinanderlegen, und der untere bliebe fuer immer stehen.
  private readonly onPaused = (): void => {
    if (this.pauseOverlay.length > 0) return;
    this.showPauseOverlay();
  };
  private readonly onResumed = (): void => this.hidePauseOverlay();

  private registerEvents(): void {
    eventBus.onEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.onEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.onEvent(GameEvent.TimerChanged, this.onTimer);
    eventBus.onEvent(GameEvent.RunPaused, this.onPaused);
    eventBus.onEvent(GameEvent.RunResumed, this.onResumed);
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
  }
}
