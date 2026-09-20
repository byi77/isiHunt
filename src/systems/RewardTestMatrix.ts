export type RewardTestLayer = 'unit' | 'system' | 'sql' | 'concurrency' | 'browser' | 'device';

export interface RewardTestCase {
  readonly id: string;
  readonly layer: RewardTestLayer;
  readonly description: string;
  readonly automatedNow: boolean;
}

/** Nachweisbare Matrix; produktive SQL-/Browser-/GerÃ¤tetests werden nicht als erledigt markiert. */
export const REWARD_TEST_MATRIX: readonly RewardTestCase[] = [
  {
    id: 'C01',
    layer: 'unit',
    description: 'Code normalization preserves leading zeros',
    automatedNow: true,
  },
  { id: 'C02', layer: 'unit', description: 'Invalid code shapes are rejected', automatedNow: true },
  {
    id: 'B02',
    layer: 'unit',
    description: 'Repeated start remains one active attempt',
    automatedNow: true,
  },
  {
    id: 'B03',
    layer: 'unit',
    description: 'Lost start response reuses request identity',
    automatedNow: false,
  },
  {
    id: 'C04',
    layer: 'concurrency',
    description: 'Last code can be granted to only one account',
    automatedNow: false,
  },
  {
    id: 'B07',
    layer: 'concurrency',
    description: 'Finish and abandon have one winning terminal state',
    automatedNow: false,
  },
  {
    id: 'U01',
    layer: 'browser',
    description: 'Small viewport and large text remain usable',
    automatedNow: false,
  },
  {
    id: 'L01',
    layer: 'sql',
    description: 'SQL rejection is visible as a structured error',
    automatedNow: false,
  },
];

export function rewardTestCasesForLayer(layer: RewardTestLayer): readonly RewardTestCase[] {
  return REWARD_TEST_MATRIX.filter((testCase) => testCase.layer === layer);
}
