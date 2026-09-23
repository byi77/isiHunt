/**
 * Ueberblendungen zwischen den Bildschirmen des Spielablaufs.
 *
 * Vorher war jeder Wechsel ein harter Schnitt - Menue, Jagd und Ergebnis
 * wirkten wie drei getrennte Programme. Die Blende laeuft ueber den Grundton
 * statt ueber Schwarz, damit beim Wechsel kein Loch aufblitzt.
 *
 * Kein Zustand ueberlebt die Scene: Phaser zerstoert beim `SHUTDOWN` alle
 * Kameras samt laufender Blende und schaltet die Eingabe beim naechsten Start
 * wieder ein (CameraManager.shutdown, InputPlugin.start). Eine abgebrochene
 * Blende kann eine Scene deshalb nicht schwarz oder taub zuruecklassen.
 */

import Phaser from 'phaser';

import { SCENE_TRANSITION } from '@/config/effectVisuals';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { Palette } from '@/ui/theme';

export type LeaveStyle = 'fade' | 'dive';

/** Scenes, die gerade ausblenden - ein zweiter Tipp startet nichts doppelt. */
const leaving = new WeakSet<Phaser.Scene>();

function blendColor(): { r: number; g: number; b: number } {
  // Grundton statt Schwarz, damit beim Wechsel kein Loch aufblitzt.
  const c = Phaser.Display.Color.IntegerToColor(Palette.backdrop);
  return { r: c.red, g: c.green, b: c.blue };
}

/** Blendet eine gerade aufgebaute Scene aus dem Grundton ein. */
export function enterScene(scene: Phaser.Scene): void {
  if (prefersReducedMotion()) return;
  const { r, g, b } = blendColor();
  scene.cameras.main.fadeIn(SCENE_TRANSITION.inMs, r, g, b);
}

/**
 * Blendet aus und ruft danach `go` - dort steht der eigentliche Wechsel.
 *
 * `dive` faehrt zusaetzlich leicht auf die Bildmitte zu: der Sprung in die
 * Jagd. Waehrend der Blende nimmt die Scene keine Eingaben mehr an; ein
 * zweiter Tipp auf "Start" wuerde sonst einen zweiten Wechsel ausloesen.
 *
 * Bei reduzierter Bewegung wird sofort gewechselt.
 */
export function leaveScene(scene: Phaser.Scene, go: () => void, style: LeaveStyle = 'fade'): void {
  if (leaving.has(scene)) return;
  if (prefersReducedMotion()) {
    go();
    return;
  }
  leaving.add(scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => leaving.delete(scene));
  scene.input.enabled = false;

  const camera = scene.cameras.main;
  const durationMs = style === 'dive' ? SCENE_TRANSITION.diveMs : SCENE_TRANSITION.outMs;
  if (style === 'dive') camera.zoomTo(SCENE_TRANSITION.diveZoom, durationMs, 'Cubic.easeIn');
  const { r, g, b } = blendColor();
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    leaving.delete(scene);
    go();
  });
  camera.fadeOut(durationMs, r, g, b);
}

/**
 * Nur die Blende, ohne Wechsel - fuer eine parallel laufende Scene wie das
 * HUD, die mit ihrer Hauptscene verschwindet und nicht selbst wechselt.
 */
export function fadeOutAlongside(scene: Phaser.Scene): void {
  if (prefersReducedMotion()) return;
  const { r, g, b } = blendColor();
  scene.cameras.main.fadeOut(SCENE_TRANSITION.outMs, r, g, b);
}

/** Kurzform fuer den haeufigsten Fall: ausblenden, dann `scene.start`. */
export function transitionTo(
  scene: Phaser.Scene,
  key: string,
  data?: object,
  style: LeaveStyle = 'fade',
): void {
  leaveScene(scene, () => scene.scene.start(key, data), style);
}
