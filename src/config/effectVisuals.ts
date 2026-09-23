/**
 * Rein visuelle Budgets fuer Hindernisse, Reliktablauf, Ankuendigungen,
 * Schlussphase, Szenenwechsel und Leuchteffekte. Keine Spielregel haengt
 * an diesen Werten - Kollision, Punkte und Zeiten stehen in `GameConfig.ts`.
 */

/** Hindernisse lesen sich als Schatten, nicht als Licht (ART_STYLE 1.2). */
export const OBSTACLE_VISUALS = {
  bodyAlpha: 0.92,
  spikeCount: 9,
  /** Zacken ragen so weit ueber den Trefferradius hinaus. */
  spikeReach: 9,
  /** Innere Zackenwurzel relativ zum Trefferradius. */
  spikeInset: 6,
  /** Halbe Zackenbreite in Radiant. */
  spikeHalfWidth: 0.17,
  outlineWidth: 3,
  /** Warnkontur pulsiert zwischen diesen Deckkraeften. */
  outlineAlphaMin: 0.55,
  outlineAlphaMax: 0.95,
  pulseMs: 900,
  /** Gestrichelter Innenring als zweites Formmerkmal neben der Farbe. */
  dashCount: 12,
  dashInset: 10,
  symbolSize: 11,
  spawnMs: 220,
  spawnFromScale: 0.4,
  spinPerMs: 0.00035,
} as const;

/** Restzeit am Relikt: ein duenner Bogen, der sich im Uhrzeigersinn leert. */
export const RELIC_LIFETIME_ARC = {
  /** Abstand ausserhalb der Rangmarken, damit beide lesbar bleiben. */
  gap: 11,
  width: 2,
  alpha: 0.55,
  /** Unter diesem Anteil wird der Bogen kraeftiger - das Relikt eilt. */
  urgentRatio: 0.25,
  urgentAlpha: 0.9,
  urgentWidth: 3,
  /** Neu gezeichnet wird erst ab dieser Aenderung, nicht jeden Frame. */
  redrawStep: 0.01,
} as const;

/** Ab "episch" oeffnet sich beim Erscheinen ein Lichtriss. */
export const RARE_ARRIVAL = {
  riftMs: 180,
  holdMs: 60,
  closeMs: 160,
  /** Hoehe und Breite des Risses in Spielpixeln. */
  riftHeightPx: 300,
  riftWidthPx: 16,
  ringMs: 380,
  ringFromScale: 0.2,
  ringToScale: 1.35,
  ringAlpha: 0.75,
} as const;

/** Die letzten Sekunden eines Runs: roter Rand im Sekundentakt. */
export const FINAL_SECONDS = {
  thresholdMs: 10_000,
  baseAlpha: 0.16,
  pulseAlpha: 0.3,
  /** Wie schnell der Schlag nach jeder vollen Sekunde abklingt (Exponent). */
  decayPower: 2.4,
  fadeInMs: 400,
} as const;

/** Ueberblendungen zwischen den Bildschirmen des Spielablaufs. */
export const SCENE_TRANSITION = {
  outMs: 200,
  inMs: 240,
  /** Beim Start einer Jagd faehrt die Kamera leicht auf das Ziel zu. */
  diveZoom: 1.1,
  diveMs: 260,
  /**
   * So lange steht das Spielfeld nach dem Rundenende, bis der naechste
   * Bildschirm da ist - die Ausblendung liegt innerhalb dieser Zeit, damit
   * der letzte Fang noch ausklingt und der Wechsel nicht laenger dauert.
   */
  runEndLingerMs: 450,
} as const;

/** Shader-Leuchten (nur WebGL, nur bei voller Effektstufe). */
export const GLOW_FX = {
  playerOuter: 3,
  playerInner: 0,
  relicOuter: 5,
  relicInner: 0.5,
  /** Shaderguete: Phaser-Standard ist 0.1; kleiner ist billiger. */
  quality: 0.1,
  distance: 10,
} as const;

/** Freischaltungen im Ergebnis werden "aufgedreht" statt nur genannt. */
export const UNLOCK_SHOWCASE = {
  size: 44,
  spinMs: 460,
  staggerMs: 120,
  delayMs: 320,
} as const;
