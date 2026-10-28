/** Erkennung der nativen App-Huelle ohne Import von `@capacitor/core`. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { isNativeApp } from '@/core/platform';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNativeApp', () => {
  it('ist im Browser ohne Capacitor-Global false', () => {
    expect(isNativeApp()).toBe(false);
  });

  it('folgt der Antwort der nativen Huelle', () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
    expect(isNativeApp()).toBe(true);

    // Capacitor legt das Global auch im Web-Fallback an - dort mit false.
    vi.stubGlobal('Capacitor', { isNativePlatform: () => false });
    expect(isNativeApp()).toBe(false);
  });

  it('haelt ein unvollstaendiges Global nicht fuer native', () => {
    vi.stubGlobal('Capacitor', {});
    expect(isNativeApp()).toBe(false);
  });
});
