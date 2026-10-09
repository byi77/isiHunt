import { expect, it } from 'vitest';
import { boundedJsonArray } from './BoundedJsonSystem';
it('drops entire older or oversized entries while preserving valid JSON', () => {
  expect(JSON.parse(boundedJsonArray(['old', 'x'.repeat(100), 'new'], 10))).toEqual(['new']);
  expect(JSON.parse(boundedJsonArray(['x'.repeat(100)], 10))).toEqual([]);
});
