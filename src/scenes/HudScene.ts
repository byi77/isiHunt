/**
 * Das HUD laeuft als eigene Scene ueber der GameScene.
 *
 * Warum getrennt: Die Anzeige braucht kein Spiellogik-Wissen und die Logik
 * kein Anzeige-Wissen. Kommunikation ausschliesslich ueber den EventBus. So
 * laesst sich das HUD komplett umbauen, ohne GameScene anzufassen - und die
 * GameScene liesse sich sogar headless testen.
 */

import Phaser from 'phaser';

import { GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { eventBus, GameEvent } from '@/core/EventBus';
import { SceneKey } from '@/scenes/SceneKey';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import type { BarHandle } from '@/ui/widgets';
import { createBar } from '@/ui/widgets';
import type { RunMode } from '@/types';

export interface HudSceneData {
  worldId: string;
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

  constructor() {
    super({ key: SceneKey.Hud, active: false });
  }

  create(data: HudSceneData): void {
    const world = getWorld(data.worldId);
    this.accent = world.accent;
    this.scoreToBeat = data.scoreToBeat ?? null;
    this.hasOvertaken = false;

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
      .text(GAME_WIDTH - 60, 40, '60', textStyle(FontSize.small, Palette.inkDim))
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

    this.registerEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregisterEvents());
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

    this.targetText?.setText('IN FUEHRUNG').setColor(Palette.gold);

    const banner = this.add
      .text(
        GAME_WIDTH / 2,
        210,
        'UEBERHOLT!',
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

  private registerEvents(): void {
    eventBus.onEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.onEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.onEvent(GameEvent.TimerChanged, this.onTimer);
  }

  /**
   * Pflicht: ohne Abmelden wuerden die Listener nach einem Restart der Scene
   * doppelt feuern und auf zerstoerte Text-Objekte zugreifen.
   */
  private unregisterEvents(): void {
    eventBus.offEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.offEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.offEvent(GameEvent.TimerChanged, this.onTimer);
  }
}
