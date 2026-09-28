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
