/**
 * Effektstufe: sparsam, mittel oder voll (ADR-0035).
 *
 * Getrennt von `prefersReducedMotion`: Jene Einstellung fragt nach Bewegung,
 * diese nach Rechenlast. Ein Leuchtshader bewegt nichts, kostet aber auf
 * einem alten Handy Bildrate - und wer ruhige Bewegung will, hat deshalb
 * nicht zwingend ein langsames Geraet.
 *
 * Was spielrelevant ist (Restzeitbogen, Warnrand, Hindernisse), haengt nie
 * an dieser Stufe. Sie schaltet nur ab, was man nicht vermisst.
 */

import { EFFECT_QUALITY_ORDER } from '@/config/effectQuality';
import * as SaveSystem from '@/systems/SaveSystem';
import type { EffectsQuality } from '@/types';

export function current(): EffectsQuality {
  return SaveSystem.load().effectsQuality;
}

/** Die volle Stufe mit den schweren Vollbild-Effekten. */
export function isFull(): boolean {
  return current() === 'full';
}

/** Ob die aktuelle Stufe mindestens `level` erreicht. */
export function atLeast(level: EffectsQuality): boolean {
  return EFFECT_QUALITY_ORDER.indexOf(current()) >= EFFECT_QUALITY_ORDER.indexOf(level);
}

/** Wahl von Hand - hebt auch den Hinweis auf eine automatische Senkung auf. */
export function setQuality(quality: EffectsQuality): void {
  SaveSystem.update((data) => {
    data.effectsQuality = quality;
    data.effectsQualityAutoLowered = false;
  });
}

/** Naechste Stufe fuer den Schalter in den Einstellungen: voll → mittel → sparsam → voll. */
export function nextManual(quality: EffectsQuality = current()): EffectsQuality {
  const index = EFFECT_QUALITY_ORDER.indexOf(quality);
  return index <= 0 ? 'full' : EFFECT_QUALITY_ORDER[index - 1]!;
}

/**
 * Senkt die Stufe um eins, weil das Geraet nicht mitkam.
 *
 * @returns `false`, wenn schon die niedrigste Stufe gilt.
 */
export function lowerAutomatically(): boolean {
  const index = EFFECT_QUALITY_ORDER.indexOf(current());
  if (index <= 0) return false;
  SaveSystem.update((data) => {
    data.effectsQuality = EFFECT_QUALITY_ORDER[index - 1]!;
    data.effectsQualityAutoLowered = true;
  });
  return true;
}

/** Ob die aktuelle Stufe automatisch gesenkt wurde (fuer den Hinweis). */
export function wasLoweredAutomatically(): boolean {
  return SaveSystem.load().effectsQualityAutoLowered;
}
