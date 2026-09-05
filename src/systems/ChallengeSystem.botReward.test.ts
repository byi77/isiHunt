/**
 * Regressionstests zu AUDIT_2026-09-05_REAUDIT, Befund 4.
 *
 * Eigene Datei statt Ergaenzung in `ChallengeSystem.test.ts`: die dortige
 * Suite laedt `AuthSystem` bewusst ungemockt (und sieht deshalb immer einen
 * abgemeldeten Spieler). Hier wird der Anmeldestatus dagegen gesteuert - genau
 * er entscheidet, ob eine Bot-Siegpraemie gesichert ist oder nur lokal steht.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as ChallengeSystemModule from '@/systems/ChallengeSystem';
import type { RunStats } from '@/types';

let signedIn = false;

vi.mock('@/systems/AuthSystem', () => ({
  isSignedIn: () => signedIn,
  currentUserId: () => (signedIn ? 'user-1' : null),
}));

let ChallengeSystem: typeof ChallengeSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  signedIn = false;
  vi.resetModules();
  ChallengeSystem = await import('@/systems/ChallengeSystem');
  ChallengeSystem.clear();
});

function createRun(score: number): RunStats {
  return {
    worldId: DEFAULT_WORLD_ID,
    score,
    bestCombo: 0,
    bestMultiplier: 1,
    collected: emptyRarityCounts(),
    totalCollected: 0,
    missed: 0,
    xpGained: 0,
  };
}

describe('AUDIT_2026-09-05_REAUDIT Befund 4: nicht gesicherte Bot-Siegpraemie', () => {
  it('markiert die Praemie als nur lokal, wenn ein angemeldeter Spieler ohne Match-ID gewinnt', () => {
    signedIn = true;
    // So sieht ein fehlgeschlagener `start_bot_match()` aus: die UI startet
    // das Duell trotzdem, aber es gibt keine serverseitige Berechtigung.
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy');
    ChallengeSystem.submitRound(createRun(1000));

    const reward = ChallengeSystem.awardBotVictory();

    expect(reward).not.toBeNull();
    expect(reward!.matchId).toBeUndefined();
    // Ohne diese Kennzeichnung versprach der Ergebnisbildschirm eine
    // gesicherte Praemie, die der naechste Profilabgleich wieder loeschte.
    expect(reward!.localOnly).toBe(true);
  });

  it('markiert eine serverseitig gestartete Praemie nicht als lokal', () => {
    signedIn = true;
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy', undefined, 'server-match-1');
    ChallengeSystem.submitRound(createRun(1000));

    const reward = ChallengeSystem.awardBotVictory();

    expect(reward!.matchId).toBe('server-match-1');
    expect(reward!.localOnly).toBeUndefined();
  });

  it('markiert die Praemie eines abgemeldeten Spielers nicht als lokal', () => {
    signedIn = false;
    // Ohne Konto gibt es keinen Serverstand, der die lokale Gutschrift
    // ueberschreiben koennte - sie ist dauerhaft und braucht keinen Hinweis.
    ChallengeSystem.startBot(DEFAULT_WORLD_ID, 'easy');
    ChallengeSystem.submitRound(createRun(1000));

    expect(ChallengeSystem.awardBotVictory()!.localOnly).toBeUndefined();
  });
});
