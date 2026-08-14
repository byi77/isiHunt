/** Erfolge mit sichtbaren Rängen und steigenden Anforderungen. */

import type { RunStats, SaveData } from '@/types';

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 1 = Einstieg, höhere Werte markieren schwierigere Ränge. */
  readonly rank: number;
  /** Wird nach jedem Run geprüft. `run` ist der soeben beendete Run. */
  readonly check: (save: SaveData, run: RunStats) => boolean;
}

function achievement(
  id: string,
  name: string,
  description: string,
  rank: number,
  check: AchievementDef['check'],
): AchievementDef {
  return { id, name, description, rank, check };
}

const totalRelics = (save: SaveData): number =>
  Object.values(save.collected).reduce((sum, count) => sum + count, 0);

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  achievement(
    'first_hunt',
    'Die erste Jagd',
    'Beende deinen ersten Run.',
    1,
    (save) => save.totalRuns >= 1,
  ),

  achievement(
    'combo_10',
    'Im Flow',
    'Erreiche eine Combo von 10.',
    1,
    (save) => save.bestCombo >= 10,
  ),
  achievement(
    'combo_25',
    'Unaufhaltsam',
    'Erreiche eine Combo von 25.',
    2,
    (save) => save.bestCombo >= 25,
  ),
  achievement(
    'combo_50',
    'Trance',
    'Erreiche eine Combo von 50.',
    3,
    (save) => save.bestCombo >= 50,
  ),
  achievement(
    'combo_75',
    'Lichtkette',
    'Erreiche eine Combo von 75.',
    4,
    (save) => save.bestCombo >= 75,
  ),
  achievement(
    'combo_100',
    'Sternensturm',
    'Erreiche eine Combo von 100.',
    5,
    (save) => save.bestCombo >= 100,
  ),

  achievement(
    'first_rare',
    'Etwas Blaues',
    'Sammle dein erstes seltenes Relikt.',
    1,
    (save) => save.collected.rare >= 1,
  ),
  achievement(
    'rare_10',
    'Blaue Spur',
    'Sammle 10 seltene Relikte.',
    2,
    (save) => save.collected.rare >= 10,
  ),
  achievement(
    'rare_50',
    'Blauer Stern',
    'Sammle 50 seltene Relikte.',
    3,
    (save) => save.collected.rare >= 50,
  ),

  achievement(
    'first_epic',
    'Episch!',
    'Sammle dein erstes episches Relikt.',
    1,
    (save) => save.collected.epic >= 1,
  ),
  achievement(
    'epic_10',
    'Epischer Funke',
    'Sammle 10 epische Relikte.',
    2,
    (save) => save.collected.epic >= 10,
  ),
  achievement(
    'epic_25',
    'Epische Macht',
    'Sammle 25 epische Relikte.',
    3,
    (save) => save.collected.epic >= 25,
  ),

  achievement(
    'first_legendary',
    'Legendär',
    'Sammle dein erstes legendäres Relikt.',
    1,
    (save) => save.collected.legendary >= 1,
  ),
  achievement(
    'legendary_3_run',
    'Glückssträhne',
    'Sammle drei legendäre Relikte in einem Run.',
    2,
    (_save, run) => run.collected.legendary >= 3,
  ),
  achievement(
    'legendary_10',
    'Legendärer Jäger',
    'Sammle 10 legendäre Relikte.',
    3,
    (save) => save.collected.legendary >= 10,
  ),
  achievement(
    'legendary_25',
    'Meister des Lichts',
    'Sammle 25 legendäre Relikte.',
    4,
    (save) => save.collected.legendary >= 25,
  ),

  achievement(
    'score_1000',
    'Vierstellig',
    'Erreiche 1.000 Punkte in einem Run.',
    1,
    (save) => save.bestScore >= 1_000,
  ),
  achievement(
    'score_5000',
    'Reliktjäger',
    'Erreiche 5.000 Punkte in einem Run.',
    2,
    (save) => save.bestScore >= 5_000,
  ),
  achievement(
    'score_15000',
    'Punktemeister',
    'Erreiche 15.000 Punkte in einem Run.',
    3,
    (save) => save.bestScore >= 15_000,
  ),
  achievement(
    'score_30000',
    'Lichtrekord',
    'Erreiche 30.000 Punkte in einem Run.',
    4,
    (save) => save.bestScore >= 30_000,
  ),
  achievement(
    'score_60000',
    'Unfassbarer Lauf',
    'Erreiche 60.000 Punkte in einem Run.',
    5,
    (save) => save.bestScore >= 60_000,
  ),

  achievement('level_5', 'Aufstieg', 'Erreiche Charakterlevel 5.', 1, (save) => save.level >= 5),
  achievement('level_10', 'Veteran', 'Erreiche Charakterlevel 10.', 2, (save) => save.level >= 10),
  achievement(
    'level_20',
    'Weltenkenner',
    'Erreiche Charakterlevel 20.',
    3,
    (save) => save.level >= 20,
  ),
  achievement(
    'level_35',
    'Sternenprofi',
    'Erreiche Charakterlevel 35.',
    4,
    (save) => save.level >= 35,
  ),
  achievement(
    'level_50',
    'Galaxienhüter',
    'Erreiche Charakterlevel 50.',
    5,
    (save) => save.level >= 50,
  ),
  achievement(
    'level_75',
    'Lichtelite',
    'Erreiche Charakterlevel 75.',
    6,
    (save) => save.level >= 75,
  ),
  achievement(
    'level_100',
    'Horizontmeister',
    'Erreiche das maximale Level 100.',
    7,
    (save) => save.level >= 100,
  ),

  achievement(
    'collector_500',
    'Sammler',
    'Sammle insgesamt 500 Relikte.',
    1,
    (save) => totalRelics(save) >= 500,
  ),
  achievement(
    'collector_2000',
    'Großer Sammler',
    'Sammle insgesamt 2.000 Relikte.',
    2,
    (save) => totalRelics(save) >= 2_000,
  ),
  achievement(
    'collector_5000',
    'Reliktarchiv',
    'Sammle insgesamt 5.000 Relikte.',
    3,
    (save) => totalRelics(save) >= 5_000,
  ),
  achievement(
    'collector_10000',
    'Hüter aller Relikte',
    'Sammle insgesamt 10.000 Relikte.',
    4,
    (save) => totalRelics(save) >= 10_000,
  ),

  achievement(
    'clean_run_50',
    'Aufgeräumt',
    'Sammle 50 Relikte in einem Run.',
    1,
    (_save, run) => run.totalCollected >= 50,
  ),
  achievement(
    'clean_run_75',
    'Perfekter Fang',
    'Sammle 75 Relikte in einem Run.',
    2,
    (_save, run) => run.totalCollected >= 75,
  ),
  achievement(
    'clean_run_100',
    'Makellose Jagd',
    'Sammle 100 Relikte in einem Run.',
    3,
    (_save, run) => run.totalCollected >= 100,
  ),

  achievement(
    'world_traveller',
    'Weltenwanderer',
    'Schalte drei Welten frei.',
    1,
    (save) => save.level >= 6,
  ),
  achievement(
    'world_traveller_5',
    'Sternenreisender',
    'Schalte fünf Welten frei.',
    2,
    (save) => save.level >= 15,
  ),
  achievement(
    'world_traveller_8',
    'Raumbezwinger',
    'Schalte acht Welten frei.',
    3,
    (save) => save.level >= 40,
  ),
  achievement(
    'world_traveller_10',
    'Jenseits des Horizonts',
    'Schalte alle zehn Welten frei.',
    4,
    (save) => save.level >= 75,
  ),
];

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, AchievementDef>> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
