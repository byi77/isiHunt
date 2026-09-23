/**
 * Effektstufe: volle Zierde oder sparsam fuer schwache Geraete.
 *
 * Getrennt von `prefersReducedMotion`: Jene Einstellung fragt nach Bewegung,
 * diese nach Rechenlast. Ein Leuchtshader bewegt nichts, kostet aber auf
 * einem alten Handy Bildrate - und wer ruhige Bewegung will, hat deshalb
 * nicht zwingend ein langsames Geraet.
 *
 * Was spielrelevant ist (Restzeitbogen, Warnrand, Hindernisse), haengt nie
 * an dieser Stufe. Sie schaltet nur ab, was man nicht vermisst.
 */

import * as SaveSystem from '@/systems/SaveSystem';
import type { EffectsQuality } from '@/types';

export function current(): EffectsQuality {
  return SaveSystem.load().effectsQuality;
}

export function isFull(): boolean {
  return current() === 'full';
}

export function setQuality(quality: EffectsQuality): void {
  SaveSystem.update((data) => {
    data.effectsQuality = quality;
  });
}
