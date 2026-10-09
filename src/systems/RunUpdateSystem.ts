export interface TimedCollectible {
  readonly isCollected: boolean;
  readonly isExpired: boolean;
}

/** Runs lifetime resolution before collision, including the expiration tick. */
export function tickCollectibles<T extends TimedCollectible>(
  items: T[],
  tick: (item: T) => void,
  touching: (item: T) => boolean,
  collect: (item: T, index: number) => void,
  miss: (item: T, index: number) => void,
): void {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (!item || item.isCollected) continue;
    tick(item);
    if (item.isExpired) miss(item, index);
    else if (touching(item)) collect(item, index);
  }
}
