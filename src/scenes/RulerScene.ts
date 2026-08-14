/**
 * Pixel-Lineal über dem gesamten Browserfenster.
 *
 * Das Raster verwendet bewusst CSS-Pixel statt Spielkoordinaten. Seine
 * Koordinate 0 liegt dadurch am tatsächlichen oberen Viewport-Rand – also
 * hinter Uhr und Dynamic Island – und die letzte Linie am unteren Rand.
 * Canvas, Laufzeile und sichere Ränder werden als zusätzliche Marken gezeigt.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { measureLayout } from '@/core/layoutReport';
import { SceneKey } from '@/scenes/SceneKey';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { FontSize } from '@/ui/theme';
import { createButton } from '@/ui/widgets';

const MAJOR_STEP = 100;
const MINOR_STEP = 50;
const RULER_ID = 'screen-pixel-ruler';

export class RulerScene extends Phaser.Scene {
  private rulerCanvas: HTMLCanvasElement | null = null;

  private readonly redrawRuler = (): void => {
    this.drawViewportGrid();
  };

  constructor() {
    super(SceneKey.Ruler);
  }

  create(): void {
    SafeAreaSystem.showStatic('PIXEL-LINEAL');
    this.installViewportRuler();

    // Das Menü läuft darunter weiter und bleibt bedienbar. Die DOM-Auflage
    // ignoriert Zeigerereignisse, damit dieser Phaser-Knopf erreichbar bleibt.
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 70,
      'LINEAL SCHLIESSEN',
      () => this.scene.stop(),
      { width: 400, height: 68, accent: 0x9aa3bd, fontSize: FontSize.small },
    ).container.setDepth(Depth.Overlay + 10);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeViewportRuler());
  }

  /** Legt das Raster außerhalb des Phaser-Canvas direkt über den Viewport. */
  private installViewportRuler(): void {
    document.getElementById(RULER_ID)?.remove();

    const canvas = document.createElement('canvas');
    canvas.id = RULER_ID;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100dvh',
      pointerEvents: 'none',
      zIndex: '2147483000',
    });

    document.documentElement.appendChild(canvas);
    this.rulerCanvas = canvas;
    this.drawViewportGrid();

    window.addEventListener('resize', this.redrawRuler);
    window.visualViewport?.addEventListener('resize', this.redrawRuler);
    window.visualViewport?.addEventListener('scroll', this.redrawRuler);
  }

  private removeViewportRuler(): void {
    window.removeEventListener('resize', this.redrawRuler);
    window.visualViewport?.removeEventListener('resize', this.redrawRuler);
    window.visualViewport?.removeEventListener('scroll', this.redrawRuler);
    this.rulerCanvas?.remove();
    this.rulerCanvas = null;
  }

  /** Zeichnet von Bildschirmkante 0 bis zur exakten unteren Bildschirmkante. */
  private drawViewportGrid(): void {
    const canvas = this.rulerCanvas;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineWidth = 1;
    context.font = '700 12px "Trebuchet MS", sans-serif';
    context.textBaseline = 'top';

    // Halbe Pixel sorgen bei einer 1-Pixel-Linie für eine scharfe Kante.
    for (let y = 0; y <= height; y += MINOR_STEP) {
      const major = y % MAJOR_STEP === 0;
      this.horizontalLine(context, y, width, major ? 0.62 : 0.26);
      if (major) this.drawYLabel(context, y, width, height);
    }

    // Die Displayhöhe ist selten durch 100 teilbar. Deshalb bekommt auch die
    // tatsächliche Unterkante eine eigene Linie und ihren exakten Wert.
    if (height % MAJOR_STEP !== 0) {
      this.horizontalLine(context, height, width, 0.9);
      this.drawYLabel(context, height, width, height);
    }

    const xLabelY = Math.max(18, Math.min(height - 20, Math.round(height / 2)));
    for (let x = 0; x <= width; x += MINOR_STEP) {
      const major = x % MAJOR_STEP === 0;
      const drawX = Math.min(width - 0.5, x + 0.5);
      context.strokeStyle = `rgba(0, 255, 136, ${major ? 0.48 : 0.2})`;
      context.beginPath();
      context.moveTo(drawX, 0);
      context.lineTo(drawX, height);
      context.stroke();

      if (major && x > 0 && x < width) {
        this.outlinedText(context, String(x), x + 4, xLabelY, '#00ff88', 'left');
      }
    }

    this.drawLayoutMarkers(context, width, height);
  }

  private horizontalLine(
    context: CanvasRenderingContext2D,
    y: number,
    width: number,
    alpha: number,
  ): void {
    const drawY = Math.min(window.innerHeight - 0.5, y + 0.5);
    context.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
    context.beginPath();
    context.moveTo(0, drawY);
    context.lineTo(width, drawY);
    context.stroke();
  }

  private drawYLabel(
    context: CanvasRenderingContext2D,
    y: number,
    width: number,
    height: number,
  ): void {
    const labelY = y === height ? Math.max(0, height - 16) : Math.min(height - 16, y + 3);
    this.outlinedText(context, String(Math.round(y)), 6, labelY, '#00ff88', 'left');
    this.outlinedText(context, String(Math.round(y)), width - 6, labelY, '#00ff88', 'right');
  }

  /** Ergänzt messbare System-, Safe-Area- und Spielfeldgrenzen. */
  private drawLayoutMarkers(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const report = measureLayout(this.game.canvas);

    this.marker(context, report.safeTop, width, height, 'SAFE TOP', '#ffd479');
    this.marker(context, height - report.safeBottom, width, height, 'SAFE BOTTOM', '#ffd479');
    this.marker(context, report.canvasTop, width, height, 'SPIELFELD START', '#66cfff');
    this.marker(
      context,
      report.canvasTop + report.canvasHeight,
      width,
      height,
      'SPIELFELD ENDE',
      '#66cfff',
    );

    context.font = '700 11px "Trebuchet MS", sans-serif';
    this.outlinedText(
      context,
      `${width} × ${height} CSS-px`,
      width / 2,
      Math.max(4, height - 18),
      '#ffffff',
      'center',
    );
  }

  private marker(
    context: CanvasRenderingContext2D,
    y: number,
    width: number,
    height: number,
    label: string,
    color: string,
  ): void {
    if (y < 0 || y > height) return;

    const drawY = Math.min(height - 1.5, Math.max(1.5, y));
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.setLineDash([8, 5]);
    context.beginPath();
    context.moveTo(0, drawY);
    context.lineTo(width, drawY);
    context.stroke();
    context.restore();

    const labelY = drawY > height - 22 ? drawY - 17 : drawY + 3;
    this.outlinedText(context, `${label} ${Math.round(y)}`, width / 2, labelY, color, 'center');
  }

  /** Schwarze Kontur hält Zahlen vor jeder Weltfarbe lesbar. */
  private outlinedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    align: CanvasTextAlign,
  ): void {
    context.save();
    context.textAlign = align;
    context.lineJoin = 'round';
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    context.strokeText(text, x, y);
    context.fillStyle = color;
    context.fillText(text, x, y);
    context.restore();
  }
}
