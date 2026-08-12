/** Scene-Namen zentral - keine losen Strings in `scene.start(...)`. */
export const SceneKey = {
  Boot: 'Boot',
  Menu: 'Menu',
  Game: 'Game',
  Hud: 'Hud',
  Result: 'Result',
} as const;

export type SceneKeyValue = (typeof SceneKey)[keyof typeof SceneKey];
