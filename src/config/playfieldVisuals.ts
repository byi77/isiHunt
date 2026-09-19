/** Rein visuelle Budgets fuer die Kulisse waehrend einer Jagd. */
export const PLAYFIELD_VISUALS = {
  textureWidth: 288,
  textureHeight: 512,
  top: 0x070f1b,
  bottom: 0x030911,
  starCounts: [95, 48, 18],
  starAlpha: [0.22, 0.36, 0.52],
  starRadius: [0.65, 0.95, 1.35],
  parallax: [3, 7, 13],
  driftPeriodMs: 95_000,
  nebulaAlpha: 0.68,
  planetAlpha: 0.32,
  planetWidth: 0.76,
  planetResolution: 256,
  maxDeltaMs: 100,
  followResponse: 1.8,
} as const;
