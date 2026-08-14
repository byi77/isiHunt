/**
 * Zeichenreihenfolge aller Ebenen.
 *
 * Warum zentral: Die Tiefenwerte lagen vorher als lose Zahlen in Entities,
 * Scenes und Widgets verstreut (`setDepth(60)`). Wer eine neue Ebene einzog,
 * musste alle Dateien durchsuchen, um zu wissen, wo sie hingehoert. Hier steht
 * die Reihenfolge einmal von hinten nach vorne lesbar da.
 *
 * Luecken zwischen den Werten sind Absicht - eine neue Ebene laesst sich
 * dazwischenschieben, ohne alle folgenden zu verschieben.
 */
export const Depth = {
  /** Grundverlauf der Welt. */
  Backdrop: -100,
  /** Horizontschein ueber dem Verlauf. */
  BackdropGlow: -98,
  /** Weiche Farbwolken. */
  BackdropClouds: -96,
  /** Ferne Parallax-Ebene: klein, dunkel, langsam. */
  DriftFar: -90,
  /** Nahe Parallax-Ebene: groesser, heller, schneller. */
  DriftNear: -88,
  /** Aufsteigender Lichtstaub. */
  AmbientMotes: -80,

  /** Alle interaktiven UI-Buttons liegen sicher über normalen Texten. */
  UI: 150,

  /** Einsammelbare Relikte. */
  Collectible: 20,
  /** Strahlenkranz seltener Relikte - hinter dem Relikt selbst. */
  CollectibleRays: 18,
  /** Die Spielfigur. */
  Player: 50,
  /** Partikel, Schockwellen. */
  Effects: 60,
  /** Aufsteigende Punktzahlen. */
  FloatingScore: 70,

  /** Randabdunklung - liegt ueber dem Spiel, unter der Anzeige. */
  Vignette: 90,
  /** Countdown, Uebergabe-Hinweise und andere Vollbild-Einblendungen. */
  Overlay: 200,
} as const;
