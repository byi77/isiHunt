/**
 * Achievements - der Langzeit-Anreiz neben dem Level.
 *
 * Jedes Achievement ist eine reine Praedikatsfunktion ueber den Spielstand und
 * (optional) den gerade beendeten Run. Dadurch bleiben sie ohne Spiel-Instanz
 * testbar und lassen sich jederzeit rueckwirkend auswerten.
 */

import type { RunStats, SaveData } from '@/types';

export interface AchievementDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Wird nach jedem Run geprueft. `run` ist der soeben beendete Run. */
  readonly check: (save: SaveData, run: RunStats) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'first_hunt',
    name: 'Die erste Jagd',
    description: 'Beende deinen ersten Run.',
    check: (save) => save.totalRuns >= 1,
  },
  {
    id: 'combo_10',
    name: 'Im Flow',
    description: 'Erreiche eine Combo von 10.',
    check: (save) => save.bestCombo >= 10,
  },
  {
    id: 'combo_25',
    name: 'Unaufhaltsam',
    description: 'Erreiche eine Combo von 25.',
    check: (save) => save.bestCombo >= 25,
  },
  {
    id: 'combo_50',
    name: 'Trance',
    description: 'Erreiche eine Combo von 50.',
    check: (save) => save.bestCombo >= 50,
  },
  {
    id: 'first_rare',
    name: 'Etwas Blaues',
    description: 'Sammle dein erstes seltenes Relikt.',
    check: (save) => save.collected.rare >= 1,
  },
  {
    id: 'first_epic',
    name: 'Episch!',
    description: 'Sammle dein erstes episches Relikt.',
    check: (save) => save.collected.epic >= 1,
  },
  {
    id: 'first_legendary',
    name: 'Legendär',
    description: 'Sammle dein erstes legendäres Relikt.',
    check: (save) => save.collected.legendary >= 1,
  },
  {
    id: 'legendary_3_run',
    name: 'Glückssträhne',
    description: 'Sammle drei legendäre Relikte in einem einzigen Run.',
    check: (_save, run) => run.collected.legendary >= 3,
  },
  {
    id: 'score_1000',
    name: 'Vierstellig',
    description: 'Erreiche 1.000 Punkte in einem Run.',
    check: (save) => save.bestScore >= 1000,
  },
  {
    id: 'score_5000',
    name: 'Reliktjäger',
    description: 'Erreiche 5.000 Punkte in einem Run.',
    check: (save) => save.bestScore >= 5000,
  },
  {
    id: 'level_5',
    name: 'Aufstieg',
    description: 'Erreiche Charakterlevel 5.',
    check: (save) => save.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Veteran',
    description: 'Erreiche Charakterlevel 10.',
    check: (save) => save.level >= 10,
  },
  {
    id: 'collector_500',
    name: 'Sammler',
    description: 'Sammle insgesamt 500 Relikte.',
    check: (save) => Object.values(save.collected).reduce((a, b) => a + b, 0) >= 500,
  },
  {
    id: 'clean_run_50',
    name: 'Aufgeräumt',
    description: 'Sammle 50 Relikte in einem Run.',
    check: (_save, run) => run.totalCollected >= 50,
  },
  {
    id: 'world_traveller',
    name: 'Weltenwanderer',
    description: 'Spiele in mindestens drei verschiedenen Welten.',
    // Ableitbar aus dem Level, weil Welten an Levelschwellen freigeschaltet werden.
    check: (save) => save.level >= 6,
  },
];

export const ACHIEVEMENT_BY_ID: Readonly<Record<string, AchievementDef>> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
