import { expect, it } from 'vitest';
import { RunStartSystem } from './RunStartSystem';
it('locks before a second start and permits an explicit retry after failure', () => {
  const start = new RunStartSystem();
  expect(start.acquire()).toBe(true);
  expect(start.acquire()).toBe(false);
  start.release();
  expect(start.acquire()).toBe(true);
});
