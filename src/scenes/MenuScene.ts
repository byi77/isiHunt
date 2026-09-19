/**
 * Startbildschirm: Profil, Weltenauswahl, Start.
 *
 * Der Bildschirm ist der schnelle Einstieg: Name, Welt und Jagd. Die
 * Fortschrittszahlen liegen im Profil und unterbrechen den Start nicht.
 */

import Phaser from 'phaser';

import { SYNC_RETRY_DELAYS_MS } from '@/config/backend';
import {
  DAILY_LOGIN_BONUS_COINS,
  DEBUG_ENABLED,
  GAME_HEIGHT,
  GAME_WIDTH,
} from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { MenuView } from '@/ui/MenuView';
import type { MenuAction } from '@/ui/MenuView';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import { SceneKey } from '@/scenes/SceneKey';
import type { WorldInfoMode } from '@/scenes/WorldInfoScene';
import { Depth } from '@/ui/depth';
import { installDebugOverlay, removeDebugOverlay } from '@/ui/debugOverlay';
import { mayEnterGame } from '@/systems/AuthGate';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { decideSyncGate, hasVisibleChange } from '@/systems/SyncGateSystem';
import * as SyncStatusSystem from '@/systems/SyncStatusSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import {
  createAmbientMotes,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

/**
 * Wann zuletzt ein vollstaendiger Abgleich begonnen hat.
 *
 * **Modulweit, nicht als Feld der Scene.** Phaser legt bei jeder Rueckkehr
 * ins Menue eine neue `MenuScene`-Instanz an - ein Feld waere dort jedes Mal
 * wieder `0`, und der Abstand liesse sich nie messen. Genau das ist der
 * Unterschied zum vorhandenen `saveSyncBusy`, das den Sturm nicht aufhalten
 * konnte.
 */
let lastSyncStartedAt = 0;

export class MenuScene extends Phaser.Scene {
  private selectedWorld!: WorldDef;
  private worldBackdrop!: Phaser.GameObjects.Container;
  private menuView: MenuView | null = null;
  private worldPreview = false;
  private savePromptObjects: Phaser.GameObjects.GameObject[] = [];
  private syncPopupObjects: Phaser.GameObjects.GameObject[] = [];
  private loginBonusObjects: Phaser.GameObjects.GameObject[] = [];
  private saveSyncBusy = false;
  private profileRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private profileRetryAttempt = 0;
  private readonly onlineHandler = (): void => {
    // Ausdruecklicher Anlass: Das Netz ist gerade zurueckgekehrt, ein
    // wartender Offline-Run soll sofort hoch - nicht erst nach der
    // Mindestpause.
    void this.synchronizeData(true);
  };

  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const resultPreview = new URLSearchParams(window.location.search).get('resultPreview');
    if (DEBUG_ENABLED && resultPreview !== null) {
      void import('@/ui/resultPreview').then(({ installResultPreview }) => {
        if (this.scene.isActive()) installResultPreview(this, resultPreview);
      });
      return;
    }
    // Zweiter Waechter neben `BootScene.entryScene()` (ADR-0026). Der Start
    // ist nicht der einzige Weg hierher: Abmelden, ein Rundenende und jeder
    // Ruecksprung aus einem Untermenue landen ebenfalls im Menue, und eine
    // Session kann waehrenddessen ablaufen. Der Bildschirm, von dem aus
    // gespielt wird, prueft deshalb selbst - sonst entsteht genau der
    // gemeldete Zustand: abgemeldet, Anzeige "GAST", Spielen trotzdem
    // moeglich (2026-09-19).
    if (!mayEnterGame()) {
      this.scene.start(SceneKey.Account, { firstStart: true });
      return;
    }
    SafeAreaSystem.showMenuTicker();
    const save = SaveSystem.load();
    const unlocked = WORLDS.filter((w) => w.unlockLevel <= save.level);
    this.selectedWorld =
      unlocked.find((w) => w.id === save.lastWorldId) ??
      unlocked[unlocked.length - 1] ??
      WORLDS[0]!;
    const previewIndex = new URLSearchParams(window.location.search).get('worldPreview');
    this.worldPreview =
      DEBUG_ENABLED && previewIndex !== null && WORLDS[Number(previewIndex)] !== undefined;
    if (this.worldPreview) this.selectedWorld = WORLDS[Number(previewIndex)]!;

    this.worldBackdrop = createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.selectedWorld.bgTop,
      this.selectedWorld.bgBottom,
      this.selectedWorld.accent,
      this.selectedWorld.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.spaceVariant);
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.accent);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    if (DEBUG_ENABLED && new URLSearchParams(window.location.search).has('hudPreview')) {
      void import('@/ui/hudPreview').then(({ installHudPreview }) => {
        if (!this.scene.isActive()) return;
        installHudPreview(
          this,
          this.selectedWorld.id,
          new URLSearchParams(window.location.search).get('hudPreview') === 'duel',
        );
      });
      return;
    }

    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.62)
      .setOrigin(0)
      .setDepth(Depth.Backdrop + 1);
    this.menuView = new MenuView(
      this,
      this.worldPreview ? { ...save, level: 100 } : save,
      this.selectedWorld,
      {
        onAction: (action) => this.handleMenuAction(action),
        onWorldSelected: (world) => this.handleWorldSelection(world),
        leaderboardAvailable: CloudSystem.isAvailable(),
        signedIn: AuthSystem.isSignedIn(),
      },
    );

    void this.showUpdateHintIfAny();
    void this.synchronizeData();
    window.addEventListener('online', this.onlineHandler);

    // Nur im Dev-Build und nur mit ?hitboxes laden - das Debug-Werkzeug bleibt
    // damit aus dem initialen Production-Bundle heraus.
    if (DEBUG_ENABLED && new URLSearchParams(window.location.search).has('hitboxes')) {
      void import('@/ui/hitDebug').then(({ attachHitDebug }) => {
        if (this.scene.isActive()) attachHitDebug(this);
      });
    }
    if (DEBUG_ENABLED && new URLSearchParams(window.location.search).has('layoutAudit')) {
      void import('@/ui/layoutAudit').then(({ installLayoutAudit }) => {
        if (this.scene.isActive()) installLayoutAudit(this.game);
      });
    }

    this.events.once('shutdown', () => {
      this.menuView?.destroy();
      this.menuView = null;
      window.removeEventListener('online', this.onlineHandler);
      this.cancelProfileRetry();
      this.clearSavePrompt();
      this.hideSyncPopup();
      this.hideLoginBonusPopup();
    });
  }

  override update(_time: number, delta: number): void {
    this.menuView?.update(delta);
  }

  /**
   * Führt beim App-Start alle ausstehenden Uploads gemeinsam aus. Offline
   * verschwindet der Hinweis sofort; der Profilstatus bleibt dann bewusst auf
   * „noch nicht aktuell“, bis ein erfolgreicher Abgleich möglich war.
   */
  /**
   * @param force Ueberspringt die Mindestpause. Nur fuer ausdrueckliche
   *   Anlaesse: das Netz kehrt zurueck, oder der Nutzer hat gerade selbst
   *   ueber einen Cloud-Stand entschieden. Der Aufruf aus `create()` setzt
   *   ihn bewusst **nicht** - er ist der haeufigste und der, der den Sturm
   *   ausgeloest hat.
   */
  private async synchronizeData(force = false): Promise<void> {
    // BUG gefunden und belegt (2026-08-18, siehe TODO.md): Phaser setzt den
    // Scene-Status erst NACH dem Rueckkehren aus `create()` auf RUNNING
    // (SceneManager.create(): `scene.create.call(...)` vor
    // `settings.status = CONST.RUNNING`). Der fruehere Guard
    // `!this.scene.isActive()` liess sich hier deshalb bei JEDEM Aufruf aus
    // `create()` heraus sofort abbrechen - `checkCloudSave()` und damit ein
    // Admin-Boost wurden dadurch nie erreicht, unabhaengig von Netz oder
    // Login-Status. Debug-Reports zeigten das erst, nachdem `sceneActive`
    // selbst mitprotokolliert wurde. Der `onlineHandler` ruft dieselbe
    // Funktion spaeter erneut auf, wenn die Szene laengst `RUNNING` ist -
    // `isActive()` bleibt dort weiterhin sinnvoll, nur der allererste
    // synchrone Aufruf direkt aus `create()` darf sich nicht darauf stuetzen.
    DebugSystem.pushLogEntry({
      timestamp: Date.now(),
      kind: 'event',
      label: 'sync:start',
      detail: JSON.stringify({
        saveSyncBusy: this.saveSyncBusy,
        sceneActive: this.scene.isActive(),
        cloudAvailable: CloudSystem.isAvailable(),
        testProfile: SaveSystem.isTestProfileActive(),
        signedIn: AuthSystem.isSignedIn(),
        online: navigator.onLine,
        sinceLastSyncMs: lastSyncStartedAt === 0 ? null : Date.now() - lastSyncStartedAt,
        forced: force,
      }),
    });
    // Die Entscheidung "darf jetzt abgeglichen werden?" liegt in
    // `SyncGateSystem` - dort ist sie ohne Phaser testbar. Hier bleibt nur
    // die Ausfuehrung.
    const jetzt = Date.now();
    const localSave = SaveSystem.load();
    // Ein Gast ohne eigenen Namen braucht keinen Cloud-Spielstand. Der
    // lokale Spielstand bleibt voll nutzbar; ein späteres Login kann ihn
    // weiterhin bewusst mit einem Online-Profil verbinden.
    const guestWithoutName = !AuthSystem.isSignedIn() && !localSave.playerName;
    const tor = decideSyncGate({
      busy: this.saveSyncBusy,
      cloudAvailable: CloudSystem.isAvailable() && !guestWithoutName,
      testProfile: SaveSystem.isTestProfileActive(),
      online: navigator.onLine,
      force,
      lastStartedAt: lastSyncStartedAt,
      now: jetzt,
    });

    if (!tor.run) {
      if (tor.status) SyncStatusSystem.setDataSyncStatus(tor.status);
      if (tor.reason === 'throttled') {
        DebugSystem.pushLogEntry({
          timestamp: jetzt,
          kind: 'event',
          label: 'sync:throttled',
          detail: JSON.stringify({ sinceLastSyncMs: jetzt - lastSyncStartedAt }),
        });
      }
      return;
    }
    lastSyncStartedAt = jetzt;

    this.showSyncPopup();

    SyncStatusSystem.setDataSyncStatus('syncing');
    try {
      const saveSynced = await this.checkCloudSave();
      if (!this.scene.isActive()) return;

      if (saveSynced && AuthSystem.isSignedIn()) {
        await CloudSystem.flushPendingCosmetics();
        if (!this.scene.isActive()) return;
      }

      await CloudSystem.flushPendingLeaderboardScore();
      if (!this.scene.isActive()) return;

      await this.claimDailyLoginBonus();
      if (!this.scene.isActive()) return;

      const hasPendingData =
        ProgressSyncSystem.hasPendingData() ||
        CloudSystem.hasPendingLeaderboardScore() ||
        CloudSystem.hasPendingCosmeticSync() ||
        this.savePromptObjects.length > 0;
      SyncStatusSystem.setDataSyncStatus(saveSynced && !hasPendingData ? 'up-to-date' : 'pending');
    } catch (error) {
      // Ein hier durchschlagender Wurf (statt eines CloudResult-Fehlers)
      // blieb bisher komplett unsichtbar - kein Log, nur der stille
      // 'pending'-Status. Genau das haette den Boost-Bug erklaeren koennen.
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'error',
        label: 'sync:threw',
        detail: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      this.saveSyncBusy = false;
      SyncStatusSystem.setDataSyncStatus('pending');
    } finally {
      if (this.scene.isActive()) this.hideSyncPopup();
    }
  }

  /** Der Login-Bonus ist serverseitig idempotent und deshalb auch auf zwei Geräten sicher. */
  private async claimDailyLoginBonus(): Promise<void> {
    if (!AuthSystem.isSignedIn()) return;

    const result = await CloudSystem.claimDailyLoginBonus(ChallengeSystem.dailyKeyForToday());
    if (!result.ok || !result.value.profile) return;

    SaveSystem.adoptProfileProgress(result.value.profile.data);
    if (result.value.claimed) this.showLoginBonusPopup();
  }

  /**
   * Prueft den bekannten Cloud-Stand. Offline bleibt das lokale Ergebnis
   * unangetastet; bei Rueckkehr des Netzes wird dieselbe Pruefung erneut
   * ausgefuehrt. Ein besserer Cloud-Stand braucht eine sichtbare Entscheidung.
   */
  private async checkCloudSave(): Promise<boolean> {
    // Kein `!this.scene.isActive()`-Guard hier: `synchronizeData()` ruft
    // diese Funktion beim allerersten Durchlauf noch synchron waehrend
    // `create()` auf, wo Phaser den Scene-Status erst nach der Rueckkehr aus
    // `create()` auf RUNNING setzt (siehe Kommentar in `synchronizeData()`).
    // Die `await`-Zwischenschritte weiter unten pruefen `isActive()` bereits
    // dort, wo es zuverlaessig ist - vor dem ersten `await` gibt es nichts
    // zu schuetzen, die Szene existiert ja bereits.
    if (this.saveSyncBusy || !CloudSystem.isAvailable() || SaveSystem.isTestProfileActive())
      return false;
    this.saveSyncBusy = true;

    const local = SaveSystem.load();
    if (local.pendingPlayerName) await this.synchronizePendingIdentity(local.pendingPlayerName);
    if (AuthSystem.isSignedIn()) {
      // Erst lokale Offline-Runs ablegen, dann den gemeinsamen Profilstand
      // lesen. Ein Remote-Stand wird nur übernommen, wenn er weiter ist; eine
      // noch nicht gesendete Outbox bleibt dadurch erhalten.
      await ProgressSyncSystem.flush();
      await NetworkDuelSystem.flushPendingRoundResults();
      // Alte anonyme Ranglisteneintraege werden beim Menuebesuch mit dem
      // Loginprofil zusammengefuehrt, damit ein sichtbarer Name nicht doppelt
      // auftaucht. Der vorhandene Profilstand bleibt dabei unveraendert.
      const claimed = local.cloudId
        ? await CloudSystem.claimCloudProfile(local.cloudId)
        : ({ ok: true, value: null } as const);
      const profile =
        claimed.ok && claimed.value ? claimed : await CloudSystem.fetchProfileProgress();
      // Diagnose-Log fuer den Profil-Pull: ein Boost, der nach App-Start nicht
      // ankam, liess sich bisher nicht von "kein Fehler passiert" unterscheiden
      // - der Debug-Ringpuffer faengt nur console.warn/error und GameEvents ab,
      // dieser Ablauf loggt keins von beidem. Bewusst dauerhaft, nicht wieder
      // entfernen (siehe CHANGELOG "Richtigstellung" 2026-08-18).
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'sync:profilePull',
        detail: JSON.stringify({
          claimedOk: claimed.ok,
          claimedHasValue: claimed.ok ? claimed.value !== null : null,
          profileOk: profile.ok,
          profileHasValue: profile.ok ? profile.value !== null : null,
          localLevel: local.level,
          localCoins: local.coins,
          remoteLevel: profile.ok && profile.value ? profile.value.data.level : null,
          remoteCoins: profile.ok && profile.value ? profile.value.data.coins : null,
        }),
      });
      if (!profile.ok) {
        // Ein Timeout hier (z.B. `requireAuthenticatedClient()` direkt nach
        // App-Start, bevor die Verbindung wirklich steht) darf ein
        // serverseitig gesetztes Level/Coins nicht bis zum naechsten
        // manuellen "Profil abgleichen" verstecken - siehe TODO.md, gleiche
        // Fehlerklasse wie der iPhone2-Sync-Bug bei ProgressSyncSystem.
        this.saveSyncBusy = false;
        this.scheduleProfileRetry();
        return false;
      }
      if (profile.value) {
        const remote: RemoteSave = {
          data: profile.value.data,
          level: profile.value.data.level,
          bestScore: profile.value.data.bestScore,
          totalRuns: profile.value.data.totalRuns,
          updatedAt: profile.value.updatedAt,
        };
        // Ein Reset wird immer uebernommen, auch wenn lokal mehr steht.
        // `isRemoteAhead()` meldet dort `false` - ein leerer Stand ist nie
        // "weiter" -, und ohne diese Sonderbehandlung blieb der Reset ohne
        // Wirkung: Der naechste Lauf lud die alten Werte wieder hoch.
        const remoteReset = CloudSystem.isRemoteReset(local, remote);
        const remoteAhead = remoteReset || CloudSystem.isRemoteAhead(local, remote);
        DebugSystem.pushLogEntry({
          timestamp: Date.now(),
          kind: 'event',
          label: 'sync:remoteAheadCheck',
          detail: JSON.stringify({ remoteAhead, remoteReset }),
        });
        if (remoteAhead) {
          // Nach einem Reset auch die Outbox verwerfen: Sie enthaelt Laeufe,
          // die der Server gerade geloescht hat - hochgeladen wuerden sie den
          // Fortschritt sofort wieder aufbauen.
          if (remoteReset) {
            ProgressSyncSystem.clearOutbox();
            CloudSystem.clearPendingCosmeticSync();
          }

          // `remoteReset` durchreichen statt SaveSystem erneut raten lassen:
          // Dessen eigene Herleitung kennt den Ladenbesitz nicht und
          // uebersieht den zweiten Reset eines Spielers, der schon auf
          // Stufe 1 ohne Runs steht (Audit 2026-08-23).
          const uebernommen = SaveSystem.adoptRemote(
            remote.data,
            local.cloudId ?? AuthSystem.currentUserId()!,
            remoteReset,
            undefined,
            remote.updatedAt,
          );
          this.saveSyncBusy = false;
          this.cancelProfileRetry();

          // Nur neu starten, wenn sich sichtbar etwas geaendert hat. Ohne
          // diese Pruefung genuegt eine falsch-positive `remoteAhead`-Antwort,
          // um die Szene endlos neu zu starten - genau das passierte nach der
          // XP-Umstellung, als ein unmigrierter Cloud-Stand dauerhaft als
          // "weiter" galt. Die Ursache ist behoben (CloudSystem gleicht beide
          // Seiten an), aber der Neustart soll sich nicht erneut auf eine
          // einzelne korrekte Antwort verlassen muessen.
          if (!hasVisibleChange(local, uebernommen, remoteReset)) {
            DebugSystem.pushLogEntry({
              timestamp: Date.now(),
              kind: 'event',
              label: 'sync:remoteAheadOhneAenderung',
              detail: JSON.stringify({ level: local.level, coins: local.coins }),
            });
            return true;
          }

          // Zwischen dem Profilabruf oben und hier kann der Spieler das
          // Menue verlassen haben - ein `restart()` holte ihn zurueck.
          if (!this.scene.isActive()) return true;
          this.scene.restart();
          return false;
        }

        // Nach einem normalen Pull wird der vereinigte lokale Stand als
        // Snapshot vorgemerkt. So erreichen auch alte lokale Käufe das neue
        // serverseitige Kosmetik-RPC, ohne einen Reset wieder aufzubauen.
        CloudSystem.queueCosmeticSync();
      }
      this.saveSyncBusy = false;
      this.cancelProfileRetry();
      return true;
    }

    if (!local.cloudId) {
      const pushed = await CloudSystem.pushSave();
      this.saveSyncBusy = false;
      return pushed.ok;
    }

    const result = await CloudSystem.fetchSave(local.cloudId);
    if (!this.scene.isActive()) {
      this.saveSyncBusy = false;
      return false;
    }

    if (!result.ok) {
      // Kein Netz: spaeter bzw. beim naechsten Run erneut versuchen. Der lokale
      // Stand bleibt die ganze Zeit erhalten.
      this.saveSyncBusy = false;
      return false;
    }

    if (!result.value) {
      // Die Kennung ist lokal noch vorhanden, der Datensatz wurde aber etwa
      // nach einer Backend-Bereinigung entfernt. Den lokalen Stand neu anlegen.
      const pushed = await CloudSystem.pushSave();
      this.saveSyncBusy = false;
      return pushed.ok;
    }

    if (CloudSystem.isRemoteAhead(local, result.value)) {
      this.showRemoteSavePrompt(result.value);
      this.saveSyncBusy = false;
      return false;
    } else if (CloudSystem.isLocalAhead(local, result.value)) {
      const pushed = await CloudSystem.pushSave();
      this.saveSyncBusy = false;
      return pushed.ok;
    }

    this.saveSyncBusy = false;
    return true;
  }

  /** Fuehrt einen offline geaenderten Namen beim naechsten Netzlauf zusammen. */
  private async synchronizePendingIdentity(name: string): Promise<void> {
    const safeName = CloudSystem.sanitizePlayerName(name);
    if (!safeName) return;

    const playerId = AuthSystem.currentUserId() ?? SaveSystem.ensureCloudId();
    const availability = await CloudSystem.isPlayerNameAvailable(safeName, playerId);
    if (!availability.ok || !availability.value) {
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'sync:pendingIdentity',
        detail: availability.ok ? 'name bereits vergeben' : availability.error,
      });
      return;
    }

    const result = AuthSystem.isSignedIn()
      ? await CloudSystem.updateProfileIdentity(safeName)
      : await CloudSystem.updateLeaderboardName(playerId, safeName);
    if (result.ok) SaveSystem.setPlayerName(safeName);
    else {
      DebugSystem.pushLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'sync:pendingIdentity',
        detail: result.error,
      });
    }
  }

  /**
   * Wiederholt den Profilabgleich automatisch nach `SYNC_RETRY_DELAYS_MS`.
   *
   * Ohne das blieb ein serverseitig gesetzter Fortschritt (z.B. ein
   * Wartungs-Boost) unsichtbar, wenn der erste `getUser()`-Aufruf kurz nach
   * App-Start am `BACKEND_TIMEOUT_MS`-Limit scheiterte - bis der Spieler
   * zufaellig selbst "Profil abgleichen" antippte.
   */
  private scheduleProfileRetry(): void {
    if (this.profileRetryTimer !== null) return;
    const delay =
      SYNC_RETRY_DELAYS_MS[Math.min(this.profileRetryAttempt, SYNC_RETRY_DELAYS_MS.length - 1)];
    this.profileRetryAttempt += 1;
    this.profileRetryTimer = setTimeout(() => {
      this.profileRetryTimer = null;
      // Ausdruecklich: Die Wiederholung ist selbst schon gedrosselt
      // (`SYNC_RETRY_DELAYS_MS`) und verpuffte sonst an der Mindestpause.
      if (this.scene.isActive()) void this.synchronizeData(true);
    }, delay);
  }

  private cancelProfileRetry(): void {
    if (this.profileRetryTimer !== null) clearTimeout(this.profileRetryTimer);
    this.profileRetryTimer = null;
    this.profileRetryAttempt = 0;
  }

  private showSyncPopup(): void {
    if (this.syncPopupObjects.length > 0) return;
    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.48)
      .setOrigin(0)
      .setDepth(200);
    overlay.setInteractive();
    const panel = createPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 430, 150, Palette.goldHex, {
      alpha: 0.96,
      radius: 22,
    }).setDepth(201);
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 22,
        'DATENSYNC',
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(202);
    const message = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 29,
        'BITTE WARTEN',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setDepth(202);
    this.syncPopupObjects = [overlay, panel, title, message];
  }

  private hideSyncPopup(): void {
    for (const object of this.syncPopupObjects) object.destroy();
    this.syncPopupObjects = [];
  }

  private showLoginBonusPopup(): void {
    if (this.loginBonusObjects.length > 0) return;
    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.38)
      .setOrigin(0)
      .setDepth(210)
      .setInteractive();
    const panel = createPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 450, 210, Palette.goldHex, {
      alpha: 0.97,
      radius: 24,
    }).setDepth(211);
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 42,
        'TÄGLICHER BONUS',
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3)
      .setDepth(212);
    const reward = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 18,
        `+${DAILY_LOGIN_BONUS_COINS} COINS`,
        textStyle(FontSize.heading, Palette.ink, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setDepth(212);
    const note = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 70,
        'Schön, dass du wieder da bist.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setDepth(212);
    this.loginBonusObjects = [overlay, panel, title, reward, note];
    this.tweens.add({
      targets: [panel, title, reward, note],
      scale: { from: 0.78, to: 1 },
      duration: 260,
      ease: 'Back.Out',
    });
    this.time.delayedCall(1600, () => {
      if (!this.scene.isActive()) return;
      this.hideLoginBonusPopup();
      this.scene.restart();
    });
  }

  private hideLoginBonusPopup(): void {
    for (const object of this.loginBonusObjects) object.destroy();
    this.loginBonusObjects = [];
  }

  private showRemoteSavePrompt(remote: RemoteSave): void {
    if (this.savePromptObjects.length > 0) return;

    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.88)
      .setOrigin(0)
      .setDepth(100);
    // Das Overlay ist auch als Eingabeflaeche aktiv: Die darunterliegende
    // Weltenauswahl darf waehrend der Cloud-Entscheidung nicht aus Versehen
    // einen weiteren Bildschirm oeffnen.
    overlay.setInteractive();
    const panel = createPanel(this, GAME_WIDTH / 2, 650, GAME_WIDTH - 100, 430, Palette.goldHex, {
      alpha: 0.98,
      radius: 24,
    }).setDepth(101);

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        490,
        'NEUER SPIELSTAND GEFUNDEN',
        textStyle(FontSize.body, Palette.gold),
      )
      .setOrigin(0.5)
      .setDepth(102)
      .setLetterSpacing(2);
    const details = this.add
      .text(
        GAME_WIDTH / 2,
        565,
        `Online-Profil: Level ${remote.level}  ·  Bestwert ${remote.bestScore.toLocaleString('de-DE')}\n${remote.totalRuns} Runs\n\nSoll dieser Stand übernommen werden?`,
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setDepth(102);

    const adopt = createButton(
      this,
      GAME_WIDTH / 2,
      725,
      'ONLINE-STAND NEHMEN',
      () => {
        const local = SaveSystem.load();
        if (!local.cloudId) return;
        SaveSystem.adoptRemote(remote.data, local.cloudId, false, undefined, remote.updatedAt);
        this.clearSavePrompt();
        this.scene.restart();
      },
      { width: 430, height: 74, accent: Palette.goldHex, fontSize: FontSize.small },
    );
    adopt.container.setDepth(102);

    const keepLocal = createButton(
      this,
      GAME_WIDTH / 2,
      820,
      'DIESEN STAND BEHALTEN',
      () => {
        if (this.saveSyncBusy) return;
        this.saveSyncBusy = true;
        void CloudSystem.pushSave().then((result) => {
          this.saveSyncBusy = false;
          if (result.ok) {
            this.clearSavePrompt();
            // Der Nutzer hat gerade selbst entschieden - darauf muss der
            // Bildschirm sofort reagieren.
            void this.synchronizeData(true);
          } else {
            SyncStatusSystem.setDataSyncStatus('pending');
          }
        });
      },
      { width: 430, height: 68, accent: 0x9aa3bd, fontSize: FontSize.tiny },
    );
    keepLocal.container.setDepth(102);

    this.savePromptObjects = [overlay, panel, title, details, adopt.container, keepLocal.container];
  }

  private clearSavePrompt(): void {
    for (const object of this.savePromptObjects) object.destroy();
    this.savePromptObjects = [];
  }

  /**
   * Hinweis, wenn auf dem Server eine neuere Fassung liegt.
   *
   * Im Menue und nicht im Run: Ein Neuladen mitten im Spiel waere das Gegenteil
   * von hilfreich. Und nur als Angebot - entschieden wird per Tipp, nicht
   * selbsttaetig.
   *
   * Ohne Netz oder ohne `version.json` (Dev-Server) passiert schlicht nichts.
   */
  private async showUpdateHintIfAny(): Promise<void> {
    const info = await checkForUpdate();
    if (!info || !this.scene.isActive()) return;
    this.menuView?.setUpdateAvailable(info.available);
  }

  private handleMenuAction(action: MenuAction): void {
    switch (action) {
      case 'jagd':
      case 'daily':
      case 'info':
        this.scene.start(SceneKey.WorldInfo, {
          worldId: this.selectedWorld.id,
          mode: (action === 'daily' ? 'tageslauf' : 'jagd') satisfies WorldInfoMode,
        });
        break;
      case 'profile':
        this.scene.start(SceneKey.Profile);
        break;
      case 'duel':
        this.scene.start(SceneKey.OnlineDuel, { worldId: this.selectedWorld.id });
        break;
      case 'achievements':
        this.scene.start(SceneKey.Achievements);
        break;
      case 'talents':
        this.scene.start(SceneKey.Talents, { returnTo: SceneKey.Menu });
        break;
      case 'leaderboard':
        this.scene.start(SceneKey.Leaderboard);
        break;
      case 'settings':
        this.scene.start(SceneKey.Settings);
        break;
      case 'shop':
        this.scene.start(SceneKey.Shop);
        break;
      case 'update':
        forceReload();
        break;
      case 'fullscreen':
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
        break;
      case 'logo': {
        const active = DebugSystem.registerLogoTap();
        if (active === true) installDebugOverlay(this.game);
        else if (active === false) removeDebugOverlay();
        break;
      }
    }
  }

  private handleWorldSelection(world: WorldDef): void {
    this.selectedWorld = world;
    if (!this.worldPreview) {
      SaveSystem.update((data) => {
        data.lastWorldId = world.id;
      });
    }
    this.transitionWorldBackdrop(world);
    SoundSystem.playWorldSelect(world.spaceVariant);
  }

  private transitionWorldBackdrop(world: WorldDef): void {
    const previous = this.worldBackdrop;
    const next = createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    if (prefersReducedMotion()) {
      previous.destroy(true);
      this.worldBackdrop = next;
      return;
    }
    next.setAlpha(0);
    this.worldBackdrop = next;

    this.tweens.add({
      targets: previous,
      alpha: 0,
      duration: 260,
      ease: 'Sine.InOut',
    });
    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: 320,
      ease: 'Sine.InOut',
      onComplete: () => previous.destroy(true),
    });
  }
}
