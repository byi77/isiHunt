/** Limits diagnostic arrays without truncating serialized JSON. */
export function boundedJsonArray(entries: readonly unknown[], maxCharacters: number): string {
  const kept: unknown[] = [];
  let used = 2;
  for (let i = entries.length - 1; i >= 0; i--) {
    const serialized = JSON.stringify(entries[i]);
    if (serialized === undefined) continue;
    const cost = serialized.length + (kept.length ? 1 : 0);
    if (used + cost > maxCharacters) continue;
    kept.unshift(entries[i]);
    used += cost;
  }
  return JSON.stringify(kept);
}
