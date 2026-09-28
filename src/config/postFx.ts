/**
 * Vollbild-Effekte der Spielkamera (Phaser-4-Filter, ADR-0035) - nur Darstellung.
 *
 * Bloom: Helle Stellen (Relikte, Triebwerk, Aura, Fang-Explosionen) strahlen
 * ueber. Die Schwelle liegt so, dass die dunkle Kulisse nicht mitleuchtet -
 * sonst verschwimmen genau die Dinge, die man fangen soll. Jede Aenderung hier
 * gegen `npm run readability:check` pruefen.
 */

/** Grundwerte je Effektstufe. `reduced` hat kein Bloom. */
export const BLOOM_BY_QUALITY = {
  medium: { threshold: 0.62, blurRadius: 2, blurSteps: 2, blurQuality: 0, blendAmount: 0.55 },
  full: { threshold: 0.55, blurRadius: 2.5, blurSteps: 4, blurQuality: 1, blendAmount: 0.8 },
} as const;

/**
 * Staerke je Welt als Faktor auf `blendAmount`, Index = `spaceVariant`.
 *
 * Die Sonnenkrone lebt vom Licht und strahlt staerker; der Nullsektor ist ein
 * stiller Riss und bleibt gedaempft. Der Lichtkern stand zuerst auf 1,3: Das
 * Schiff wurde vor seiner goldenen Aura zum hellen Fleck, und die Pruefung lag
 * genau auf ihrer Grenze (Messung 2026-09-28). Nullsektor und
 * Lichtkern haben schon ohne Bloom den geringsten Helligkeitskontrast
 * (readability-baseline.json) - dort zuerst hinsehen, wenn die Pruefung
 * anschlaegt.
 */
export const BLOOM_WORLD_STRENGTH = [1, 1, 1.1, 0.6, 1.4, 0.9, 1.1, 1, 1, 1.1] as const;

/**
 * Dynamisches Licht, nur auf der vollen Stufe.
 *
 * Beleuchtet werden nur Randplanet und Nebel - Relikte, Hindernisse und HUD
 * bleiben unbeleuchtet, damit sie ueberall gleich gut lesbar sind. Ausserhalb
 * der Lichter liegt die Kulisse auf `ambient` (Anteil der Originalhelligkeit),
 * im Licht darueber.
 */
export const LIGHTING = {
  ambient: 0.7,
  /**
   * Grundhelligkeit je Welt (Index = `spaceVariant`), ersetzt `ambient`.
   * Im Lichtkern sind die Relikte dunkler als der goldene Grund; eine
   * abgedunkelte Kulisse naeherte sich ihnen an und fiel unter die
   * Lesbarkeitsgrenze (1,20 bei 1,26). Relikt-Lichter waren nicht die Ursache -
   * ohne sie blieb es bei 1,19 (Messungen 2026-09-28).
   */
  ambientByWorld: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 1, 0.7],
  /**
   * `z` ist die Hoehe ueber der Kulisse. Ohne Normal-Map zeigt jede Flaeche
   * zur Kamera; Phasers Standard (`radius * 0.1`) liess das Licht in 200 px
   * Abstand so flach einfallen, dass es unsichtbar blieb (Messung 2026-09-28).
   */
  ship: { radius: 380, intensity: 1.2, z: 240 },
  /** Nur epische und legendaere Relikte leuchten - sonst waere es ein Lichtermeer. */
  relic: { radius: 240, intensity: 1.1, z: 150, minRarity: 'epic', max: 4 },
  /** Selbstschatten ueber die Texturhelligkeit: gibt dem Planeten Relief. */
  selfShadow: { penumbra: 0.5, flatThreshold: 1 / 3 },
} as const;

/**
 * Farbstimmung der Spielkamera, nur auf der vollen Stufe.
 *
 * Kleine Anhebungen von Saettigung und Kontrast je Welt (Index =
 * `spaceVariant`); grosse Werte kippen Rarity-Farben und damit die Lesbarkeit.
 * Beim Hindernistreffer entsaettigt das Bild kurz - ein Gefuehl von "das tat
 * weh", zusaetzlich zu Wackeln und Zahl, nie statt ihnen.
 */
export const GRADING = {
  saturation: [0.1, 0.05, 0.2, 0.15, 0.15, 0, 0.1, 0.1, 0.1, 0.1],
  contrast: [0.08, 0.08, 0.1, 0.1, 0.06, 0.08, 0.08, 0.1, 0.04, 0.08],
  hitMs: 350,
  /** Wie weit die Saettigung beim Treffer faellt (0..1). */
  hitDesaturate: 0.7,
} as const;

/**
 * Verzerrung der Kulisse, nur auf der vollen Stufe (Index = `spaceVariant`).
 *
 * Nur die Kulisse, nie Relikte oder Schiff: Eine verzerrte Kamera zeichnete
 * Relikte neben der Stelle, an der sie eingesammelt werden.
 *
 * - `haze`: Hitzeflimmern ueber eine weiche Rauschtextur, Staerke pulsiert.
 * - `tremor`: Der Raum zittert in kurzen Stoessen (Nullsektor).
 * - `lens`: Atmende Linse ueber die ganze Kulisse (Horizonttor).
 */
export const DISTORTION = {
  mode: ['none', 'none', 'haze', 'tremor', 'haze', 'none', 'none', 'none', 'none', 'lens'],
  haze: { amount: 0.0045, periodMs: 2_600 },
  tremor: { amount: 0.009, everyMs: 4_200, durationMs: 600 },
  /** Barrel: 1 ist unverzerrt. */
  lens: { amount: 0.05, periodMs: 7_000 },
  noiseSize: 256,
} as const;

/**
 * Lebender Nebel: GPU-Rauschen ueber dem statischen Canvas-Nebel, nur auf der
 * vollen Stufe. Kostet einen Shader-Durchgang ueber die ganze Flaeche je
 * Frame - deshalb wenige Oktaven und niedrige Deckkraft. Die Spielfeldmitte
 * bleibt durch `valuePower` duenn: Nur die hellsten Schwaden bleiben sichtbar.
 */
export const LIVING_NEBULA = {
  /**
   * Helligkeitsanteil der Schwaden. Zuerst 0,22 mit `valuePower` 3,2: Die
   * Schwaden bedeckten das ganze Feld, die Mitte war nicht mehr ruhig
   * (Screenshot-Vergleich 2026-09-29).
   */
  alpha: 0.12,
  cells: [3, 5, 2],
  iterations: 3,
  warpAmount: 0.6,
  valuePower: 4.5,
  /** Wie schnell das Feld sich wandelt (Flow-Einheiten je Sekunde). */
  flowPerSecond: 0.05,
  /** Langsames Abdriften (Zellen je Sekunde). */
  driftPerSecond: 0.02,
} as const;

/**
 * Weicher Schatten unter dem Schiffsrumpf, nur auf der vollen Stufe.
 * Er hebt das Schiff vom Spielfeld ab; Relikte bekommen keinen, weil jeder
 * Schatten einen eigenen Zwischenpuffer kostet.
 */
export const SHIP_SHADOW = {
  x: 0,
  /**
   * Negativ = nach unten: Filter rechnen in Phaser 4 mit GL-Ausrichtung
   * (y waechst nach oben). Mit +7 lag der Schatten ueber der Nase
   * (Screenshot 2026-09-29).
   */
  y: -7,
  decay: 0.08,
  power: 1,
  color: 0x000000,
  samples: 6,
  intensity: 0.7,
} as const;

/** Glanzstreif ueber legendaere Relikte, nur auf der vollen Stufe. */
export const RELIC_SHINE = {
  radius: 0.35,
  durationMs: 1_400,
  repeatDelayMs: 1_600,
  colorFactor: [1.5, 1.4, 1.2, 1],
} as const;
