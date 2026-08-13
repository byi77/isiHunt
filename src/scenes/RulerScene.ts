/**
 * Pixel-Lineal ueber dem Spielfeld.
 *
 * ## Wofuer
 *
 * Layout-Fehler auf einem fremden Geraet zu beschreiben ist muehsam: "oben ist
 * ein Balken", "der Knopf sitzt zu tief" - solche Saetze lassen sich nicht
 * nachrechnen, und jede Rueckfrage kostet eine Runde.
 *
 * Mit einem Lineal wird daraus eine Zahl: "von 0 bis 160 ist schwarz", "der
 * Knopf sitzt bei 890, sollte aber bei 830 sein". Das ist pruefbar, ohne dass
 * jemand raten muss (docs/CODE_STYLE.md 1.8).
 *
 * ## Was es zeigt
 *
 * - Waagerechte Linien alle 100 Spielpixel, beschriftet
 * - Feinere Striche alle 50
 * - Senkrechte Linien alle 100 - fuer Aussagen ueber links und rechts
 * - Die Grenzen der sicheren Raender als farbige Linien
 * - Wo das Spielfeld anfaengt und aufhoert
 *
 * Der Bildschirm laesst sich ueber den Wartungsbildschirm oeffnen und legt sich
 * ueber das Menue, damit man beides zugleich sieht.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { measureLayout } from '@/core/layoutReport';
import { SceneKey } from '@/scenes/SceneKey';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import { createButton } from '@/ui/widgets';

/** Abstand der beschrifteten Linien in Spielpixeln. */
const MAJOR_STEP = 100;
/** Abstand der feinen Striche. */
const MINOR_STEP = 50;

export class RulerScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Ruler);
  }

  create(): void {
    SafeAreaSystem.showStatic('PIXEL-LINEAL');
    this.drawGrid();
    this.drawSafeAreaMarkers();

    // Das Menue laeuft darunter weiter und bleibt bedienbar - das Lineal ist
    // eine Auflage, kein eigener Bildschirm. Schliessen heisst deshalb nur:
    // diese Scene beenden.
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 70,
      'LINEAL SCHLIESSEN',
      () => this.scene.stop(),
      { width: 400, height: 68, accent: 0x9aa3bd, fontSize: FontSize.small },
    ).container.setDepth(Depth.Overlay + 10);
  }

  /** Das Raster selbst - waagerecht beschriftet, senkrecht nur als Linie. */
  private drawGrid(): void {
    const g = this.add.graphics().setDepth(Depth.Overlay);

    // Feine Striche zuerst, damit die beschrifteten darueber liegen.
    g.lineStyle(1, 0x00ff88, 0.22);
    for (let y = MINOR_STEP; y < GAME_HEIGHT; y += MINOR_STEP) {
      if (y % MAJOR_STEP === 0) continue;
      g.lineBetween(0, y, GAME_WIDTH, y);
    }

    g.lineStyle(1, 0x00ff88, 0.55);
    for (let y = 0; y <= GAME_HEIGHT; y += MAJOR_STEP) {
      g.lineBetween(0, y, GAME_WIDTH, y);

      this.add
        .text(6, y + 2, String(y), textStyle(14, '#00ff88'))
        .setOrigin(0, 0)
        .setDepth(Depth.Overlay);

      // Zweite Beschriftung rechts: Am linken Rand verdeckt sie sonst genau
      // das, was man beurteilen will.
      this.add
        .text(GAME_WIDTH - 6, y + 2, String(y), textStyle(14, '#00ff88'))
        .setOrigin(1, 0)
        .setDepth(Depth.Overlay);
    }

    g.lineStyle(1, 0x00ff88, 0.3);
    for (let x = MAJOR_STEP; x < GAME_WIDTH; x += MAJOR_STEP) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);

      this.add
        .text(x + 3, GAME_HEIGHT / 2, String(x), textStyle(13, '#00ff88'))
        .setOrigin(0, 0.5)
        .setDepth(Depth.Overlay);
    }
  }

  /**
   * Wo die sicheren Raender liegen - in Spielkoordinaten umgerechnet.
   *
   * Sie sind der haeufigste Grund fuer "da ist ein Balken": Alles ausserhalb
   * gehoert dem System, nicht dem Spiel.
   */
  private drawSafeAreaMarkers(): void {
    const report = measureLayout(this.game.canvas);
    const g = this.add.graphics().setDepth(Depth.Overlay + 1);

    // CSS-Pixel in Spielkoordinaten: Der sichere Rand liegt oberhalb des
    // Spielfelds, ein positiver Wert bedeutet also einen Streifen darueber.
    const safeTopInGame = (report.safeTop - report.canvasTop) / report.scale;
    const safeBottomInGame =
      GAME_HEIGHT +
      (report.viewportHeight - report.safeBottom - (report.canvasTop + report.canvasHeight)) /
        report.scale;

    g.lineStyle(3, 0xffd479, 0.9);

    if (safeTopInGame > 0 && safeTopInGame < GAME_HEIGHT) {
      g.lineBetween(0, safeTopInGame, GAME_WIDTH, safeTopInGame);
      this.label(safeTopInGame, 'sicherer Rand oben', Palette.gold);
    }

    if (safeBottomInGame > 0 && safeBottomInGame < GAME_HEIGHT) {
      g.lineBetween(0, safeBottomInGame, GAME_WIDTH, safeBottomInGame);
      this.label(safeBottomInGame, 'sicherer Rand unten', Palette.gold);
    }

    // Kopfzeile mit den Rohwerten - dieselbe Quelle wie im Wartungsbildschirm.
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 130,
        `Balken oben ${report.barTop.toFixed(0)} CSS-px  ·  unten ${report.barBottom.toFixed(0)} CSS-px  ·  Massstab ${report.scale.toFixed(3)}`,
        textStyle(FontSize.tiny, Palette.ink),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay);
  }

  private label(y: number, text: string, color: string): void {
    this.add
      .text(GAME_WIDTH / 2, y - 12, text, textStyle(14, color))
      .setOrigin(0.5, 1)
      .setDepth(Depth.Overlay + 1);
  }
}
