import { expect, it, vi } from 'vitest';
import { tickCollectibles } from './RunUpdateSystem';
it('expires a touching collectible at its lifetime boundary before collecting it', () => {
  const orb = { isCollected: false, isExpired: false };
  const collect = vi.fn();
  const miss = vi.fn();
  tickCollectibles(
    [orb],
    (item) => {
      item.isExpired = true;
    },
    () => true,
    collect,
    miss,
  );
  expect(collect).not.toHaveBeenCalled();
  expect(miss).toHaveBeenCalledWith(orb, 0);
});
it('collects a living orb and does not update an already collected orb', () => {
  const alive = { isCollected: false, isExpired: false };
  const done = { isCollected: true, isExpired: false };
  const tick = vi.fn();
  const collect = vi.fn();
  const miss = vi.fn();
  tickCollectibles([alive, done], tick, () => true, collect, miss);
  expect(tick).toHaveBeenCalledTimes(1);
  expect(collect).toHaveBeenCalledWith(alive, 0);
  expect(miss).not.toHaveBeenCalled();
});
