/**
 * Warnrand der Schlussphase: ein roter Rahmen, der mit jeder vollen Sekunde
 * einmal anschlaegt.
 *
 * Der Takt kommt aus der Restzeit selbst, nicht aus einem Tween. So bleibt er
 * mit der Sekundenanzeige im HUD deckungsgleich, haelt in der Pause mit an und
 * folgt allein dem `delta` (Regel 5). Kein Aufblitzen: Der Schlag faellt von
 * seiner Spitze weich ab, die Grundhelligkeit bleibt stehen.
 */

import Phaser from 'phaser';

import { FINAL_SECONDS } from '@/config/effectVisuals';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { Depth } from '@/ui/depth';
import { finalSecondsAlpha } from '@/ui/finalSecondsPulse';
import { TextureKey } from '@/ui/textures';
import { Palette } from '@/ui/theme';

export class FinalSecondsWarning {
  private readonly edge: Phaser.GameObjects.Image;
  /** Einblenden ueber die erste Warnsekunde, damit der Rand nicht einspringt. */
  private shownMs = 0;

  constructor(scene: Phaser.Scene, width: number, height: number) {
    this.edge = scene.add
      .image(width / 2, height / 2, TextureKey.EdgeGlow)
      .setDisplaySize(width, height)
      .setTint(Palette.dangerHex)
      // Additiv: Rot legt sich als Schein auf den dunklen Rand, statt ihn
      // nur zu faerben - normal gemischt ging es im Nachthimmel unter.
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.Vignette)
      .setAlpha(0)
      .setVisible(false);
  }

  update(remainingMs: number, deltaMs: number): void {
    const alpha = finalSecondsAlpha(remainingMs, prefersReducedMotion());
    if (alpha <= 0) {
      this.shownMs = 0;
      this.edge.setVisible(false);
      return;
    }
    this.shownMs = Math.min(FINAL_SECONDS.fadeInMs, this.shownMs + deltaMs);
    this.edge.setVisible(true).setAlpha(alpha * (this.shownMs / FINAL_SECONDS.fadeInMs));
  }
}
