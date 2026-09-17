/** Presentation budgets only; collecting and awarding points never depend on them. */
export const COLLECTION_VISUALS = {
  maxActive: 8,
  lifetimeMs: 700,
  ringMs: 360,
  baseFlightMs: 320,
  flightStepMs: 40,
  baseShards: 2,
  maxBend: 46,
} as const;
