import type { RewardPackage } from '@/systems/RewardPackageSystem';

export interface RewardCampaignPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly package: RewardPackage;
}

const fiveRuns = 5;

/** Feste Admin-Vorlagen. Keine freie Paketbearbeitung, damit jeder generierte
 * Code den gleichen Serververtrag durchlaeuft. */
export const REWARD_CAMPAIGN_PRESETS: readonly RewardCampaignPreset[] = [
  {
    id: 'xp_30_five_runs',
    label: '+30% XP · 5 RUNS',
    description: '30% mehr XP fuer die naechsten fuenf Solo-Runden.',
    package: {
      version: 1,
      grants: [{ type: 'xp_run_boost', factor: 1.3, applications: fiveRuns }],
    },
  },
  {
    id: 'level_50_coins_20000',
    label: 'LEVEL 50 + 20.000 C',
    description: 'Hebt mindestens auf Level 50 und schreibt 20.000 Coins gut.',
    package: {
      version: 1,
      grants: [
        { type: 'minimum_level', level: 50 },
        { type: 'coins', amount: 20_000 },
      ],
    },
  },
  ...(['speed', 'magnetism', 'combo_grace'] as const).map((effect) => ({
    id: `${effect}_30_five_runs`,
    label:
      effect === 'speed'
        ? '+30% TEMPO · 5 RUNS'
        : effect === 'magnetism'
          ? '+30% MAGNET · 5 RUNS'
          : '+30% SERIENZEIT · 5 RUNS',
    description:
      effect === 'speed'
        ? '30% mehr Bewegungstempo fuer fuenf Solo-Runden.'
        : effect === 'magnetism'
          ? '30% mehr Magnetismus fuer fuenf Solo-Runden.'
          : '30% mehr Zeit bis zum Serienabbruch fuer fuenf Solo-Runden.',
    package: {
      version: 1,
      grants: [
        { type: 'run_effect_boost' as const, effect, factor: 1.3 as const, applications: fiveRuns },
      ],
    },
  })),
  {
    id: 'magnetism_30_five_runs',
    label: '+30% MAGNET · 5 RUNS',
    description:
      'Die zweite Magnetismus-Vorlage ist ebenfalls bewusst auf fuenf Solo-Runden begrenzt.',
    package: {
      version: 1,
      grants: [
        { type: 'run_effect_boost', effect: 'magnetism', factor: 1.3, applications: fiveRuns },
      ],
    },
  },
  {
    id: 'coins_10000',
    label: '10.000 COINS',
    description: 'Schreibt direkt 10.000 Coins gut.',
    package: { version: 1, grants: [{ type: 'coins', amount: 10_000 }] },
  },
  {
    id: 'shop_god_mode',
    label: 'SHOP-GOD-MODUS',
    description: 'Schaltet alle aktuell im serverseitigen Shop-Katalog gefuehrten Items frei.',
    package: { version: 1, grants: [{ type: 'shop_god_mode' }] },
  },
];
