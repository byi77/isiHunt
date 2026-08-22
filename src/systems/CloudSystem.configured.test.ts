/**
 * Die "wirft nie"-Garantie bei EINGERICHTETEM Backend.
 *
 * ## Warum eine zweite Datei
 *
 * `CloudSystem.test.ts` mockt `@/config/backend` auf `isBackendConfigured:
 * false`. Das ist dort richtig - es verhindert Zugriffe auf die echte
 * Produktionsdatenbank. Es hat aber einen Preis, den der Audit vom 2026-08-19
 * aufgedeckt hat: Ohne eingerichtetes Backend kehrt jede Netzfunktion sofort
 * an ihrem Guard zurueck. Alles dahinter ist **per Konstruktion unerreichbar**;
 * die dortige Suite prueft 17 Funktionen und faehrt in allen denselben fruehen
 * Return.
 *
 * `vi.mock` gilt fuer das ganze Modul, deshalb laesst sich der andere Zustand
 * nicht in derselben Datei herstellen.
 *
 * ## Die drei Ebenen
 *
 * Hinter dem Backend-Guard liegen zwei weitere, und sie sind nicht dasselbe:
 *
 * 1. **Backend nicht eingerichtet** - deckt `CloudSystem.test.ts` ab.
 * 2. **Eingerichtet, aber niemand angemeldet** - `requireAuthenticatedClient()`
 *    bricht mit "Bitte zuerst anmelden" ab, *ohne* das Netz zu beruehren.
 * 3. **Angemeldet, aber Netz tot** - erst hier laeuft der Aufruf durch
 *    `withTimeout()`, und erst hier zeigt sich, ob ein Netzfehler wirklich zu
 *    einem Ergebnisobjekt wird statt zu einem Wurf.
 *
 * Ebene 3 ist die eigentlich interessante: Sie ist der Fall, der auf dem
 * Geraet im Funkloch eintritt. Ohne die gefaelschte Session unten wuerden alle
 * Tests auf Ebene 2 haengenbleiben und die Garantie nur scheinbar pruefen.
 *
 * Die Adresse ist bewusst `.invalid` (RFC 2606): eine solche Domain kann per
 * Definition nicht existieren, ein Test kann also niemals versehentlich einen
 * echten Server treffen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyRarityCounts } from '@/config/rarities';
import { DEFAULT_WORLD_ID } from '@/config/worlds';
import type * as CloudSystemModule from '@/systems/CloudSystem';
import type { ProgressEvent } from '@/types';

vi.mock('@/config/backend', () => ({
  BACKEND_URL: 'https://nicht-erreichbar.invalid',
  BACKEND_ANON_KEY: 'test-schluessel-ohne-funktion',
  isBackendConfigured: true,
  LEADERBOARD_LIMIT: 10,
  SYNC_CODE_LENGTH: 6,
  SYNC_CODE_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTUVWXYZ',
  PLAYER_NAME_MAX_LENGTH: 12,
  // Kurz halten: Die Funktionen sollen am Netzfehler scheitern, nicht am
  // Zeitlimit - sonst dauert die Suite unnoetig lange.
  BACKEND_TIMEOUT_MS: 300,
}));

let CloudSystem: typeof CloudSystemModule;

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  vi.stubGlobal('fetch', () => Promise.reject(new Error('Netzwerk nicht erreichbar (Test)')));
  CloudSystem = await import('@/systems/CloudSystem');
});

/**
 * Meldet einen Nutzer an, ohne das Netz zu beruehren.
 *
 * Ohne das liefert `supabase.auth.getUser()` mangels gespeicherter Session
 * sofort einen Fehler, und jeder Aufruf endet auf Ebene 2 - der Netzpfad
 * dahinter bliebe ungetestet, obwohl die Tests gruen waeren.
 */
function signIn(): void {
  const client = CloudSystem.getSupabaseClient()!;
  vi.spyOn(client.auth, 'getUser').mockResolvedValue({
    data: { user: { id: 'test-nutzer' } },
    error: null,
  } as never);
}

function createProgressEvent(): ProgressEvent {
  return {
    eventId: 'test-ereignis',
    worldId: DEFAULT_WORLD_ID,
    score: 100,
    bestCombo: 5,
    xpGained: 50,
    durationMs: 90_000,
    coinsGained: 20,
    talentPointsGained: 0,
    collected: emptyRarityCounts(),
    unlockedAchievementIds: [],
    createdAt: new Date().toISOString(),
  };
}

describe('isAvailable bei eingerichtetem Backend', () => {
  it('meldet den Dienst als verfuegbar', () => {
    expect(CloudSystem.isAvailable()).toBe(true);
  });

  it('erzeugt einen Client, statt null zu liefern', () => {
    expect(CloudSystem.getSupabaseClient()).not.toBeNull();
  });
});

/**
 * Ebene 2: eingerichtet, aber niemand angemeldet.
 *
 * Diese Funktionen duerfen den Aufrufer nicht mit einer technischen
 * Netzmeldung abspeisen, wenn schlicht die Anmeldung fehlt - der Unterschied
 * entscheidet, ob die Oberflaeche "bitte anmelden" oder "kein Empfang" zeigt.
 */
describe('ohne Anmeldung: verstaendlicher Hinweis statt Netzfehler', () => {
  const ohneAnmeldung: [string, () => Promise<{ ok: boolean; error?: string }>][] = [
    ['fetchAdminDashboard', () => CloudSystem.fetchAdminDashboard()],
    ['adminBoostUser', () => CloudSystem.adminBoostUser('spieler-id', 3)],
    ['adminResetUser', () => CloudSystem.adminResetUser('spieler-id')],
    ['fetchProfileProgress', () => CloudSystem.fetchProfileProgress()],
    ['initializeProfileProgress', () => CloudSystem.initializeProfileProgress()],
    ['claimCloudProfile', () => CloudSystem.claimCloudProfile('Spielername')],
    ['updateProfileIdentity', () => CloudSystem.updateProfileIdentity('Spielername')],
    ['resetTalents', () => CloudSystem.resetTalents()],
    ['claimDailyLoginBonus', () => CloudSystem.claimDailyLoginBonus('2026-08-19')],
    ['submitProgressEvent', () => CloudSystem.submitProgressEvent(createProgressEvent())],
  ];

  for (const [name, aufruf] of ohneAnmeldung) {
    it(`${name} verweist auf die Anmeldung`, async () => {
      const result = await aufruf();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('anmelden');
    });
  }
});

/**
 * Ebene 3: angemeldet, Netz tot. Der Fall aus dem Funkloch.
 *
 * Das ist die Ebene, die der Modulkommentar von `CloudSystem.ts` meint, wenn
 * er verspricht, dass jede Funktion ein Ergebnisobjekt liefert und nie wirft.
 * Bis zum Audit 2026-08-19 wurde sie von keinem Test betreten.
 */
describe('angemeldet, aber Netz tot: Ergebnisobjekt statt Wurf', () => {
  const mitAnmeldung: [string, () => Promise<{ ok: boolean; error?: string }>][] = [
    ['fetchAdminDashboard', () => CloudSystem.fetchAdminDashboard()],
    ['adminBoostUser', () => CloudSystem.adminBoostUser('spieler-id', 3)],
    ['adminResetUser', () => CloudSystem.adminResetUser('spieler-id')],
    ['fetchProfileProgress', () => CloudSystem.fetchProfileProgress()],
    ['initializeProfileProgress', () => CloudSystem.initializeProfileProgress()],
    ['claimCloudProfile', () => CloudSystem.claimCloudProfile('Spielername')],
    ['updateProfileIdentity', () => CloudSystem.updateProfileIdentity('Spielername')],
    ['resetTalents', () => CloudSystem.resetTalents()],
    ['claimDailyLoginBonus', () => CloudSystem.claimDailyLoginBonus('2026-08-19')],
    ['submitProgressEvent', () => CloudSystem.submitProgressEvent(createProgressEvent())],
  ];

  for (const [name, aufruf] of mitAnmeldung) {
    it(`${name} meldet den Netzfehler, ohne zu werfen`, async () => {
      signIn();
      const result = await aufruf();

      expect(result.ok).toBe(false);
      // Der Fehler kommt jetzt aus dem Netz, nicht mehr vom Anmelde-Guard -
      // sonst haette der Test die Ebene gar nicht erreicht.
      expect(result.error).not.toContain('anmelden');
    });
  }
});

/**
 * Der Sonderfall, in dem schon die Anmeldepruefung selbst am Netz scheitert.
 *
 * `requireAuthenticatedClient()` ruft `supabase.auth.getUser()` durch
 * `withTimeout()`. Faellt das Netz genau dort aus, darf der Fehler nicht nach
 * aussen getragen werden - sonst wirft jede der zehn Funktionen dahinter.
 * Die uebrigen Tests koennen das nicht sehen: Sie faelschen `getUser()` und
 * umgehen diesen Pfad damit gerade.
 */
describe('Anmeldepruefung scheitert selbst am Netz', () => {
  it('liefert ein Ergebnisobjekt statt zu werfen', async () => {
    const client = CloudSystem.getSupabaseClient()!;
    vi.spyOn(client.auth, 'getUser').mockRejectedValue(new Error('Netzwerk tot (Test)'));

    await expect(CloudSystem.fetchProfileProgress()).resolves.toMatchObject({ ok: false });
    await expect(CloudSystem.adminBoostUser('spieler-id', 3)).resolves.toMatchObject({
      ok: false,
    });
  });

  it('meldet eine Zeitueberschreitung als Ergebnis, nicht als Wurf', async () => {
    const client = CloudSystem.getSupabaseClient()!;
    // Antwortet nie - `withTimeout()` muss das Zeitlimit ziehen.
    vi.spyOn(client.auth, 'getUser').mockReturnValue(new Promise(() => {}) as never);

    await expect(CloudSystem.fetchProfileProgress()).resolves.toMatchObject({ ok: false });
  });
});

/**
 * Funktionen ohne Anmeldepflicht - sie gehen direkt ans Netz und muessen
 * dessen Ausfall ebenso in ein Ergebnisobjekt uebersetzen.
 */
describe('ohne Anmeldepflicht: Netzfehler bleibt ein Ergebnisobjekt', () => {
  it('fetchLeaderboard', async () => {
    await expect(CloudSystem.fetchLeaderboard()).resolves.toMatchObject({ ok: false });
  });

  it('fetchSave', async () => {
    await expect(CloudSystem.fetchSave('cloud-id')).resolves.toMatchObject({ ok: false });
  });

  it('updateLeaderboardName', async () => {
    await expect(
      CloudSystem.updateLeaderboardName('spieler-id', 'Spielername'),
    ).resolves.toMatchObject({ ok: false });
  });

  it('createSyncCode', async () => {
    await expect(CloudSystem.createSyncCode()).resolves.toMatchObject({ ok: false });
  });

  it('redeemSyncCode', async () => {
    await expect(CloudSystem.redeemSyncCode('ABC123')).resolves.toMatchObject({ ok: false });
  });

  it('redeemSyncCode laesst kein NaN in die Vergleichsanzeige', async () => {
    // Audit 2026-08-23: Diese Zahlen gehen ungefiltert in die
    // Geraeteuebertragung ("Welchen Stand willst du behalten?"). Eine
    // geaenderte SQL-Funktion kann `null` oder Strings liefern; ein blosses
    // `Number()` machte daraus woertlich "Level NaN" auf dem Bildschirm -
    // und der Nutzer entscheidet anhand genau dieser Zahlen, welchen
    // Spielstand er behaelt.
    //
    // Die RPC wird hier direkt gefaelscht statt ueber `fetch`: Nur so wird
    // die Zeilenumwandlung ueberhaupt erreicht: mit dem Netzfehler-Stub aus
    // `beforeEach` bricht der Aufruf vorher ab.
    signIn();
    const client = CloudSystem.getSupabaseClient()!;
    vi.spyOn(client, 'rpc').mockResolvedValue({
      data: [
        {
          save_id: 'cloud-id',
          data: { level: 3 },
          level: 'zwoelf',
          best_score: null,
          total_runs: undefined,
          updated_at: '2026-08-23T00:00:00.000Z',
        },
      ],
      error: null,
    } as never);

    const result = await CloudSystem.redeemSyncCode('ABC123');

    expect(result.ok).toBe(true);
    const save = (result as { ok: true; value: { save: { level: number } } }).value.save as {
      level: number;
      bestScore: number;
      totalRuns: number;
    };
    expect(Number.isFinite(save.level)).toBe(true);
    expect(Number.isFinite(save.bestScore)).toBe(true);
    expect(Number.isFinite(save.totalRuns)).toBe(true);
    // Stufe 1 ist der Boden - eine Stufe 0 gibt es im Spiel nicht.
    expect(save.level).toBe(1);
  });

  it('pushSave', async () => {
    await expect(CloudSystem.pushSave()).resolves.toMatchObject({ ok: false });
  });

  it('syncSaveSafely', async () => {
    await expect(CloudSystem.syncSaveSafely()).resolves.toMatchObject({ ok: false });
  });

  it('flushPendingLeaderboardScore laeuft durch, ohne zu werfen', async () => {
    // Bewusst ohne Ergebnispruefung: Diese Funktion gibt als einzige
    // `Promise<void>` zurueck statt eines Ergebnisobjekts. Geprueft wird
    // ausschliesslich, dass sie einen Netzfehler nicht nach aussen traegt.
    await expect(CloudSystem.flushPendingLeaderboardScore()).resolves.toBeUndefined();
  });

  it('submitScoreSafely vermerkt den Bestwert fuer einen spaeteren Versuch', async () => {
    const result = await CloudSystem.submitScoreSafely(
      'spieler-id',
      'Spielername',
      'nebula',
      5,
      1000,
      10,
      90_000,
      {},
      new Date().toISOString(),
    );

    expect(result.ok).toBe(false);
    // Der Bestwert darf bei einem Netzfehler nicht verloren gehen - er wird
    // vorgemerkt und beim naechsten Start erneut versucht.
    expect(CloudSystem.hasPendingLeaderboardScore()).toBe(true);
  });
});
