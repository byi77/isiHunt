/**
 * Bilder fuer Freischaltungen im Ergebnis: neue Welt, neue Optik, Erfolg.
 *
 * Eine Freischaltung stand bisher nur als Textzeile in einer Karte - genauso
 * gross wie die Ausbeute darunter. Das Bild daneben dreht sich einmal auf und
 * macht sie zum Moment, statt zu einer weiteren Zeile.
 */

import Phaser from 'phaser';

import { UNLOCK_SHOWCASE } from '@/config/effectVisuals';
import type { AchievementCategory } from '@/systems/AchievementProgressSystem';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { createAchievementBadge } from '@/ui/achievementBadge';
import { planetTextureForVariant, TextureKey } from '@/ui/textures';
import { Palette } from '@/ui/theme';

export type UnlockVisual =
  | { kind: 'world'; spaceVariant: number; accent: number }
  | { kind: 'aura' }
  | { kind: 'achievement'; category: AchievementCategory; rank: number };

/** Baut das Bild um (0, 0) in der Kantenlaenge `size`. */
export function createUnlockVisual(
  scene: Phaser.Scene,
  visual: UnlockVisual,
  size: number,
): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  switch (visual.kind) {
    case 'world': {
      const halo = scene.add
        .image(0, 0, TextureKey.Glow)
        .setTint(visual.accent)
        .setDisplaySize(size * 1.5, size * 1.5)
        .setAlpha(0.45)
        .setBlendMode(Phaser.BlendModes.ADD);
      const planet = scene.add
        .image(0, 0, planetTextureForVariant(visual.spaceVariant))
        .setDisplaySize(size, size);
      root.add([halo, planet]);
      break;
    }
    case 'aura': {
      const ring = scene.add
        .image(0, 0, TextureKey.PlayerHalo)
        .setTint(Palette.goldHex)
        .setDisplaySize(size, size);
      const core = scene.add
        .image(0, 0, TextureKey.PlayerCore)
        .setDisplaySize(size * 0.55, size * 0.55);
      root.add([ring, core]);
      break;
    }
    case 'achievement':
      root.add(createAchievementBadge(scene, 0, 0, visual.category, visual.rank, true, size / 2));
      break;
  }
  return root;
}

/**
 * Dreht das Bild einmal auf: aus der Kante in die Flaeche, wie eine Muenze,
 * die sich zum Betrachter wendet. Mehrere Freischaltungen folgen versetzt.
 */
export function spinInUnlock(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  order: number,
): void {
  if (prefersReducedMotion()) return;
  const s = UNLOCK_SHOWCASE;
  target.setScale(0, 0.7);
  scene.tweens.add({
    targets: target,
    scaleX: 1,
    scaleY: 1,
    duration: s.spinMs,
    delay: s.delayMs + order * s.staggerMs,
    ease: 'Back.easeOut',
  });
}
