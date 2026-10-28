/**
 * Effektstufen und automatisches Herabstufen (ADR-0035).
 *
 * - `reduced` (SPARSAM): keine Leuchtfilter, halbe Kulissen-Teilchen.
 * - `medium` (MITTEL): der Mittelweg und Standard seit 28.10.2026. Leichtes
 *   Bloom plus alles, was wenig Arbeit pro Pixel kostet: Farbstimmung,
 *   Sternstaub, Relikt-Glanz, Schiffsschatten.
 * - `full` (VOLL): zusaetzlich die Effekte, die jedes Bild ueber den ganzen
 *   Schirm rechnen - lebender Nebel (3D-Rauschen), Verzerrung, dynamisches
 *   Licht und volles Bloom. Ein iPhone 18 Pro ruckelte damit spuerbar.
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
} as const;

/** Anteil der Kulissen-Teilchen je Stufe. */
export const ATMOSPHERE_PARTICLE_SHARE = { reduced: 0.5, medium: 1, full: 1 } as const;

/**
 * Stand der Effekt-Voreinstellung. Steigt die Zahl, setzt `SaveSystem` jeden
 * aelteren Spielstand einmalig von "Voll" auf "Mittel" (ADR-0041). Wer danach
 * wieder "Voll" waehlt, behaelt es - der Stand traegt dann die neue Zahl.
 */
export const EFFECTS_DEFAULT_REVISION = 1;

/** Bildratenanzeige im Run (Einstellung "Bildrate anzeigen"). */
export const FRAME_RATE_METER = {
  /** Eine Anzeige je Sekunde: ruhig genug zum Ablesen, schnell genug fuer Einbrueche. */
  windowMs: 1_000,
  /** Ab diesem Vielfachen des Medians gilt ein Frame als Ruckler. */
  hitchFactor: 1.5,
} as const;
