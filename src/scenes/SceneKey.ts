/** Scene-Namen zentral - keine losen Strings in `scene.start(...)`. */
export const SceneKey = {
  Boot: 'Boot',
  Menu: 'Menu',
  Game: 'Game',
  Hud: 'Hud',
  Result: 'Result',
  /** Alle Nicht-Spiel-Phasen eines Duells: Einfuehrung, Uebergabe, Ergebnis. */
  Challenge: 'Challenge',
  /** Online-Bestenliste je Welt. */
  Leaderboard: 'Leaderboard',
  /** Spielstand-Abgleich zwischen Geraeten. */
  Sync: 'Sync',
} as const;

export type SceneKeyValue = (typeof SceneKey)[keyof typeof SceneKey];
