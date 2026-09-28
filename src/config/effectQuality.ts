/**
 * Effektstufen und automatisches Herabstufen (ADR-0035).
 *
 * - `reduced` (SPARSAM): keine Leuchtfilter, halbe Kulissen-Teilchen.
 * - `medium` (MITTEL): alles, was es vor den Phaser-4-Effekten gab.
 * - `full` (VOLL): zusaetzlich die schweren Vollbild-Effekte (Bloom, Licht,
 *   Verzerrung ...). Standard.
 *
 * Herabgestuft wird nur automatisch, nie hinauf: Ein Geraet, das einmal nicht
 * mitkam, soll nicht bei jedem Run neu ausprobieren und ruckeln.
 */
export const EFFECT_QUALITY_ORDER = ['reduced', 'medium', 'full'] as const;

export const FRAME_GUARD = {
  /**
   * Die ersten Millisekunden eines Runs zaehlen nicht - Texturaufbau und
   * Shader-Uebersetzung erzeugen dort Ausreisser, die nichts ueber das Geraet
   * sagen.
   */
  warmupMs: 3_000,
  /** Laenge eines Messfensters. */
  windowMs: 5_000,
  /**
   * Median-Frametime, ab der ein Fenster als zu langsam gilt (~40 fps).
   *
   * VORLAEUFIG: Der Wert ist nicht auf Geraeten gemessen, sondern aus der
   * Ueberlegung gesetzt, dass 60 fps das Ziel sind und 30 fps sichtbar
   * ruckeln. Vor der Auslieferung auf echten Handys nachmessen (ROADMAP,
   * Phase 4). Der Median statt des Mittelwerts, damit einzelne Haenger (etwa
   * eine Garbage Collection) kein Herabstufen ausloesen.
   */
  slowFrameMs: 25,
  /** So viele langsame Fenster in Folge loesen das Herabstufen aus. */
  slowWindows: 2,
  /**
   * Laengere Frames werden ignoriert: Ein verdeckter Tab oder ein
   * eingehender Anruf liefert ein riesiges `delta`, das nichts ueber die
   * Rechenlast sagt.
   */
  ignoreFrameMs: 250,
} as const;

/** Anteil der Kulissen-Teilchen je Stufe. */
export const ATMOSPHERE_PARTICLE_SHARE = { reduced: 0.5, medium: 1, full: 1 } as const;
