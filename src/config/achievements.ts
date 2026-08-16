/** Erfolge mit sichtbaren Rängen und steigenden Anforderungen. */

import type { RunStats, SaveData } from '@/types';
import { COINS_PER_ACHIEVEMENT } from '@/config/GameConfig';

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** 1 = Einstieg, höhere Werte markieren schwierigere Ränge. */
  readonly rank: number;
  /** Steigende Einmalbelohnung; Rang 1 behält die bisherige 25-Coin-Prämie. */
  readonly coinReward: number;
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
  return {
    id,
    name,
    description,
    rank,
    coinReward: COINS_PER_ACHIEVEMENT + (rank - 1) * 15,
    check,
  };
}

const totalRelics = (save: SaveData): number =>
  Object.values(save.collected).reduce((sum, count) => sum + count, 0);

const totalTalentRanks = (save: SaveData): number =>
  Object.values(save.talents).reduce((sum, rank) => sum + rank, 0);

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
    'combo_125',
    'Kettenreaktion',
    'Erreiche eine Combo von 125.',
    6,
    (save) => save.bestCombo >= 125,
  ),
  achievement(
    'combo_150',
    'Unendlicher Flow',
    'Erreiche eine Combo von 150.',
    7,
    (save) => save.bestCombo >= 150,
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
    'rare_100',
    'Blaues Feuer',
    'Sammle 100 seltene Relikte.',
    4,
    (save) => save.collected.rare >= 100,
  ),
  achievement(
    'rare_250',
    'Azurwächter',
    'Sammle 250 seltene Relikte.',
    5,
    (save) => save.collected.rare >= 250,
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
    'epic_50',
    'Epischer Orbit',
    'Sammle 50 epische Relikte.',
    4,
    (save) => save.collected.epic >= 50,
  ),
  achievement(
    'epic_100',
    'Kosmische Macht',
    'Sammle 100 epische Relikte.',
    5,
    (save) => save.collected.epic >= 100,
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
    'legendary_50',
    'Mythischer Sammler',
    'Sammle 50 legendäre Relikte.',
    5,
    (save) => save.collected.legendary >= 50,
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
  achievement(
    'score_100000',
    'Sechsstellig',
    'Erreiche 100.000 Punkte in einem Run.',
    6,
    (save) => save.bestScore >= 100_000,
  ),
  achievement(
    'score_150000',
    'Lichtblitz',
    'Erreiche 150.000 Punkte in einem Run.',
    7,
    (save) => save.bestScore >= 150_000,
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
    'collector_25000',
    'Sternenarchiv',
    'Sammle insgesamt 25.000 Relikte.',
    5,
    (save) => totalRelics(save) >= 25_000,
  ),
  achievement(
    'collector_50000',
    'Archiv des Lichts',
    'Sammle insgesamt 50.000 Relikte.',
    6,
    (save) => totalRelics(save) >= 50_000,
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
    'clean_run_125',
    'Sternenregen',
    'Sammle 125 Relikte in einem Run.',
    4,
    (_save, run) => run.totalCollected >= 125,
  ),
  achievement(
    'clean_run_150',
    'Himmelssturz',
    'Sammle 150 Relikte in einem Run.',
    5,
    (_save, run) => run.totalCollected >= 150,
  ),

  achievement('runs_10', 'Stammjäger', 'Beende 10 Runs.', 1, (save) => save.totalRuns >= 10),
  achievement('runs_50', 'Ausdauernd', 'Beende 50 Runs.', 2, (save) => save.totalRuns >= 50),
  achievement('runs_150', 'Routiniert', 'Beende 150 Runs.', 3, (save) => save.totalRuns >= 150),
  achievement('runs_500', 'Unermüdlich', 'Beende 500 Runs.', 4, (save) => save.totalRuns >= 500),

  achievement(
    'playtime_hour',
    'Eine Stunde Licht',
    'Spiele insgesamt eine Stunde.',
    1,
    (save) => save.totalPlayTimeMs >= 60 * 60 * 1000,
  ),
  achievement(
    'playtime_five_hours',
    'Langstreckenflug',
    'Spiele insgesamt fünf Stunden.',
    2,
    (save) => save.totalPlayTimeMs >= 5 * 60 * 60 * 1000,
  ),
  achievement(
    'playtime_ten_hours',
    'Nachtwache',
    'Spiele insgesamt zehn Stunden.',
    3,
    (save) => save.totalPlayTimeMs >= 10 * 60 * 60 * 1000,
  ),

  achievement(
    'talents_5',
    'Erste Spezialisierung',
    'Kaufe insgesamt 5 Talentränge.',
    1,
    (save) => totalTalentRanks(save) >= 5,
  ),
  achievement(
    'talents_15',
    'Lichtformung',
    'Kaufe insgesamt 15 Talentränge.',
    2,
    (save) => totalTalentRanks(save) >= 15,
  ),
  achievement(
    'talents_30',
    'Voll entfaltet',
    'Kaufe insgesamt 30 Talentränge.',
    3,
    (save) => totalTalentRanks(save) >= 30,
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
