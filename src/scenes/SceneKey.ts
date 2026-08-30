/** Scene-Namen zentral - keine losen Strings in `scene.start(...)`. */
export const SceneKey = {
  Boot: 'Boot',
  Menu: 'Menu',
  /** Profil: Name und Spielericon; beim ersten Start verpflichtend. */
  Profile: 'Profile',
  /** Übersicht der im Spiel freigeschalteten Erfolge. */
  Achievements: 'Achievements',
  /** Detailansicht einer Welt: Besonderheit, Hindernisse, Belohnung. */
  WorldInfo: 'WorldInfo',
  Game: 'Game',
  Hud: 'Hud',
  Result: 'Result',
  /** Alle Nicht-Spiel-Phasen eines Duells: Einfuehrung, Uebergabe, Ergebnis. */
  Challenge: 'Challenge',
  /** Auswahl der lokalen Spielerzahl, des Bots oder des Netzwerkduells. */
  DuelSelect: 'DuelSelect',
  /** Netzwerk-Duell: Raum erzeugen/beitreten, Lobby, Ergebnis. */
  OnlineDuel: 'OnlineDuel',
  /** Online-Bestenliste: Gesamtansicht und Weltfilter. */
  Leaderboard: 'Leaderboard',
  /** Spielstand-Abgleich zwischen Geraeten. */
  Sync: 'Sync',
  /** Einstellungen, darunter die Profiluebertragung zwischen Geraeten. */
  Settings: 'Settings',
  /** Freiwilliger Login fuer ein gemeinsames Profil auf mehreren Geraeten. */
  Account: 'Account',
  /** Kaufbare Talente als unabhaengige Route und Reset. */
  Talents: 'Talents',
  /** Laden fuer Skins und Boosts - die Coin-Senke. */
  Shop: 'Shop',
  /**
   * Wartungsbildschirm: Version, Neuladen erzwingen, Spielstand zuruecksetzen.
   * Absichtlich versteckt - erreichbar ueber drei Tipps und langen Druck auf
   * die Versionsnummer.
   */
  Admin: 'Admin',
  /** PIN-Abfrage nach der versteckten Versions-Geste. */
  AdminPin: 'AdminPin',
  /** Serverseitig geschützte Nutzungsstatistik für Wartungsadmins. */
  AdminStats: 'AdminStats',
  /** Serverseitig geschützte Benutzerwerkzeuge für Wartungsadmins. */
  AdminUsers: 'AdminUsers',
  /**
   * Pixel-Lineal ueber dem Spielfeld. Macht aus "da ist ein Balken" die Aussage
   * "von 0 bis 160 ist schwarz" - eine Zahl statt einer Beschreibung.
   */
  Ruler: 'Ruler',
} as const;

export type SceneKeyValue = (typeof SceneKey)[keyof typeof SceneKey];
