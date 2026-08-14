/** Scene-Namen zentral - keine losen Strings in `scene.start(...)`. */
export const SceneKey = {
  Boot: 'Boot',
  Menu: 'Menu',
  /** Profil: Name und Spielericon; beim ersten Start verpflichtend. */
  Profile: 'Profile',
  Game: 'Game',
  Hud: 'Hud',
  Result: 'Result',
  /** Alle Nicht-Spiel-Phasen eines Duells: Einfuehrung, Uebergabe, Ergebnis. */
  Challenge: 'Challenge',
  /** Online-Bestenliste: Gesamtansicht und Weltfilter. */
  Leaderboard: 'Leaderboard',
  /** Spielstand-Abgleich zwischen Geraeten. */
  Sync: 'Sync',
  /** Einstellungen, darunter die Profiluebertragung zwischen Geraeten. */
  Settings: 'Settings',
  /** Freiwilliger Login fuer ein gemeinsames Profil auf mehreren Geraeten. */
  Account: 'Account',
  /** Kaufbarer Talentbaum und Punkt-Reset. */
  Talents: 'Talents',
  /**
   * Wartungsbildschirm: Version, Neuladen erzwingen, Spielstand zuruecksetzen.
   * Absichtlich versteckt - erreichbar ueber drei Tipps und langen Druck auf
   * die Versionsnummer.
   */
  Admin: 'Admin',
  /**
   * Pixel-Lineal ueber dem Spielfeld. Macht aus "da ist ein Balken" die Aussage
   * "von 0 bis 160 ist schwarz" - eine Zahl statt einer Beschreibung.
   */
  Ruler: 'Ruler',
} as const;

export type SceneKeyValue = (typeof SceneKey)[keyof typeof SceneKey];
