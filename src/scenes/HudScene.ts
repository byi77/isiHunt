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
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import type { BarHandle } from '@/ui/widgets';
import { createBar } from '@/ui/widgets';

export interface HudSceneData {
  worldId: string;
}

export class HudScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private timerBar!: BarHandle;
  private accent = 0xffffff;

  constructor() {
    super({ key: SceneKey.Hud, active: false });
  }

  create(data: HudSceneData): void {
    const world = getWorld(data.worldId);
    this.accent = world.accent;

    this.worldText = this.add
      .text(GAME_WIDTH / 2, 34, world.name.toUpperCase(), textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5, 0);
    this.worldText.setLetterSpacing(6);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 62, '0', textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5, 0);

    this.comboText = this.add
      .text(GAME_WIDTH / 2, 138, '', textStyle(FontSize.body, toCss(this.accent), { fontStyle: 'bold' }))
      .setOrigin(0.5, 0);

    this.timerBar = createBar(this, 60, 24, GAME_WIDTH - 120, 8, this.accent);
    this.timerBar.setRatio(1);

    this.timerText = this.add
      .text(GAME_WIDTH - 60, 40, '60', textStyle(FontSize.small, Palette.inkDim))
      .setOrigin(1, 0);

    this.registerEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregisterEvents());
  }

  // --- Event-Anbindung ------------------------------------------------------

  private readonly onScore = ({ score }: { score: number }): void => {
    this.scoreText.setText(score.toLocaleString('de-DE'));
    // Kurzer Pop bei jeder Aenderung - macht Punktzuwachs spuerbar.
    this.scoreText.setScale(1.12);
    this.tweens.add({ targets: this.scoreText, scale: 1, duration: 180, ease: 'Quad.Out' });
  };

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
