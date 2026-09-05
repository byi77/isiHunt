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
import { isIos, isStandalone } from '@/core/display';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import { SceneKey } from '@/scenes/SceneKey';
import type { WorldInfoMode } from '@/scenes/WorldInfoScene';
import { Depth } from '@/ui/depth';
import { installDebugOverlay, removeDebugOverlay } from '@/ui/debugOverlay';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import { decideSyncGate, hasVisibleChange } from '@/systems/SyncGateSystem';
import * as SyncStatusSystem from '@/systems/SyncStatusSystem';
import {
  getShipAura,
  getShipColor,
  getShipShape,
  shipAuraAssetId,
  shipAuraIndex,
  shipTint,
} from '@/config/shop';
import { auraAssetForId, type EgoAuraAsset } from '@/ui/egoAssets';
import {
  applyTintShift,
  AURA_FRAME_RUHE,
  SHIP_ANIMATIONS,
  stehendesBild,
  type AuraAnimation,
} from '@/ui/shipAnimations';
import { playerTextureForShape, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import {
  createAmbientMotes,
  createBar,
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
  private worldCarousel: Phaser.GameObjects.Container | null = null;
  private worldInputCleanup: (() => void) | null = null;
  private worldListDecorations: Phaser.GameObjects.GameObject[] = [];
  private savePromptObjects: Phaser.GameObjects.GameObject[] = [];
  private syncPopupObjects: Phaser.GameObjects.GameObject[] = [];
  private loginBonusObjects: Phaser.GameObjects.GameObject[] = [];
  private saveSyncBusy = false;
  private profileRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private profileRetryAttempt = 0;
  private profileShapeImage: Phaser.GameObjects.Image | null = null;
  private profileHaloImage: Phaser.GameObjects.Image | null = null;
  private profileAuraImage: Phaser.GameObjects.Image | null = null;
  private profileAuraAnimation: AuraAnimation | null = null;
  private profileAuraAsset: EgoAuraAsset | undefined;
  private profileAuraColor = 0xffffff;
  private profileAuraMs = 0;
  private profilePanelBottom = 385;
  private swipeHintText: Phaser.GameObjects.Text | null = null;
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
    SafeAreaSystem.showMenuTicker();
    const save = SaveSystem.load();
    // Das Hauptmenü bleibt auch ohne Name, Konto oder Auth-Session erreichbar.
    // Der Name wird unten nur für die Anzeige auf "GAST" zurückgestellt.
    const unlocked = WORLDS.filter((w) => w.unlockLevel <= save.level);
    this.selectedWorld =
      unlocked.find((w) => w.id === save.lastWorldId) ??
      unlocked[unlocked.length - 1] ??
      WORLDS[0]!;

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

    this.buildTitle();
    this.buildFullscreenToggle();
    this.buildProfilePanel(save.playerName || 'GAST', save.level, save.bestScore, save.coins);
    this.buildWorldList(save.level);
    this.buildFooter();

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

    this.events.once('shutdown', () => {
      this.cleanupWorldList();
      window.removeEventListener('online', this.onlineHandler);
      this.cancelProfileRetry();
      this.clearSavePrompt();
      this.hideSyncPopup();
      this.hideLoginBonusPopup();
    });
  }

  override update(_time: number, delta: number): void {
    if (this.profileShapeImage === null) return;
    this.profileAuraMs += Math.max(0, delta);
    this.updateProfilePreview();
  }

  /** Hält die kleine Profilfigur mit derselben Aura-Rechnung wie im Spiel aktuell. */
  private updateProfilePreview(): void {
    const animation = this.profileAuraAnimation;
    const frame =
      animation === null
        ? AURA_FRAME_RUHE
        : prefersReducedMotion()
          ? stehendesBild(animation)
          : animation(this.profileAuraMs);
    const tint = applyTintShift(this.profileAuraColor, frame.tint);

    this.profileShapeImage
      ?.setScale(0.34 * frame.scaleX, 0.34 * frame.scaleY)
      .setRotation(frame.rotation)
      .setAlpha(frame.alpha)
      .setTint(tint);
    this.profileHaloImage?.setTint(tint);

    const auraImage = this.profileAuraImage;
    if (auraImage === null) return;
    if (this.profileAuraAsset !== undefined) {
      const asset = this.profileAuraAsset;
      const frameIndex =
        Math.floor(this.profileAuraMs / asset.frameDurationMs) % asset.frameTextureKeys.length;
      const textureKey = asset.frameTextureKeys[frameIndex] ?? asset.frameTextureKeys[0];
      if (textureKey !== undefined) auraImage.setTexture(textureKey);
      auraImage
        .setVisible(true)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(
          asset.previewScaleMultiplier * frame.scaleX,
          asset.previewScaleMultiplier * frame.scaleY,
        )
        .setAlpha(0.75 * frame.alpha)
        .setTint(tint);
      return;
    }

    if (animation !== null) {
      auraImage
        .setVisible(true)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setTexture(TextureKey.Glow)
        .setScale(0.72 * frame.scaleX, 0.72 * frame.scaleY)
        .setAlpha(0.75 * frame.alpha)
        .setTint(tint);
    } else {
      auraImage.setVisible(false);
    }
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

    // Der Update-Hinweis bekommt den festen Platz direkt ueber der JAGD-Reihe.
    // Er ersetzt dort temporaer den Wisch-Hinweis: Beide Hinweise gleichzeitig
    // waeren an dieser Stelle zu eng und wuerden den Blick vor dem Start
    // zerreissen. Der Kreisel ist bis zum Hinweisbereich symmetrisch gesetzt.
    const footer = this.getFooterLayout();
    const primaryTop = footer.primaryY - footer.primaryHeight / 2;
    const bannerY = primaryTop - 46;
    //
    // Der Puls sitzt bewusst NICHT auf banner.container: Ein pulsierender
    // setScale() auf dem interaktiven Container wuerde periodisch auch die
    // Trefferflaeche schrumpfen lassen - exakt die Falle aus ART_STYLE.md 8.2.
    this.swipeHintText?.setVisible(false);
    const bannerWidth = GAME_WIDTH - 60;
    const pulseGlow = this.add
      .image(GAME_WIDTH / 2, bannerY, TextureKey.Glow)
      .setDisplaySize(bannerWidth * 1.3, 84 * 2.4)
      .setTint(Palette.goldHex)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.UI - 1);

    const banner = createButton(
      this,
      GAME_WIDTH / 2,
      bannerY,
      `NEUE VERSION VERFÜGBAR  ·  v${info.available}  ·  JETZT LADEN`,
      () => forceReload(),
      { width: bannerWidth, height: 84, accent: Palette.goldHex, fontSize: FontSize.small },
    );

    banner.container.setAlpha(0).setScale(0.9);
    this.tweens.add({
      targets: banner.container,
      alpha: 1,
      scale: 1,
      duration: 320,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: pulseGlow,
          alpha: { from: 0.25, to: 0.55 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => pulseGlow.destroy());
  }

  private buildTitle(): void {
    // Lichtschein hinter dem Titel - der Name bedeutet Licht, das darf man sehen.
    this.add
      .image(GAME_WIDTH / 2, 100, TextureKey.Glow)
      .setDisplaySize(560, 320)
      .setTint(Palette.goldHex)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD);

    const title = this.add.image(GAME_WIDTH / 2, 104, TextureKey.Logo).setDisplaySize(400, 225);

    // Geheimer, PIN-freier Zugang zum Debug-Modus: zehnmal aufs Logo tippen.
    // Getrennt vom PIN-Wartungsbereich (AdminScene) - dieser Modus liest nur,
    // veraendert nichts, und soll deshalb ohne Admin-Wissen erreichbar sein.
    title.setInteractive({ useHandCursor: false });
    title.on('pointerdown', () => {
      const active = DebugSystem.registerLogoTap();
      if (active === null) return;

      if (active) {
        installDebugOverlay(this.game);
      } else {
        removeDebugOverlay();
      }
    });

    this.add
      .text(GAME_WIDTH / 2, 184, 'JAGE DAS LICHT', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(8);

    this.tweens.add({
      targets: title,
      y: 100,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /**
   * Vollbild-Umschalter oben rechts.
   *
   * Erscheint nur, wo die Fullscreen-API wirklich etwas bewirkt - auf dem
   * iPhone gibt es sie nicht (siehe core/display.ts), dort steht stattdessen
   * der Installationshinweis in der Fusszeile.
   */
  private buildFullscreenToggle(): void {
    if (!this.scale.fullscreen.available || isStandalone()) return;

    const button = createButton(
      this,
      GAME_WIDTH - 96,
      52,
      this.scale.isFullscreen ? 'ZURÜCK' : 'VOLLBILD',
      () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
          button.setLabel('VOLLBILD');
        } else {
          this.scale.startFullscreen();
          button.setLabel('ZURÜCK');
        }
      },
      { width: 148, height: 52, accent: 0x9aa3bd, fontSize: FontSize.tiny },
    );
  }

  /** Name, Lichtfigur, Level und Bestwert direkt im Profilblock. */
  private buildProfilePanel(
    playerName: string,
    level: number,
    bestScore: number,
    coins: number,
  ): void {
    const y = 270;
    const width = GAME_WIDTH - 80;
    const save = SaveSystem.load();
    const levelProgress = ProgressionSystem.getLevelProgress(save);
    const localPlay = !AuthSystem.isSignedIn() || !navigator.onLine;
    const shape = getShipShape(save.shipShape);
    const color = getShipColor(save.shipColor);
    const aura = getShipAura(save.shipAura);
    const profileColor = shipTint(save, this.selectedWorld.accent);
    const auraIndex = shipAuraIndex(save);
    this.profileAuraAnimation = auraIndex === null ? null : (SHIP_ANIMATIONS[auraIndex] ?? null);
    this.profileAuraAsset = auraAssetForId(shipAuraAssetId(save));
    this.profileAuraColor = profileColor;
    this.profileAuraMs = 0;
    const rowBounds = [
      { center: y - 26, height: FontSize.body },
      { center: y + 2, height: FontSize.body },
      { center: y + 28, height: FontSize.tiny },
      { center: y + 49, height: FontSize.body },
      { center: y + 72, height: FontSize.tiny },
      { center: y + 93, height: FontSize.tiny },
      { center: y + 114, height: FontSize.tiny },
      { center: y + 139, height: FontSize.tiny },
      { center: y + 157, height: 8 },
    ];
    const panelPadding = 25;
    const panelTop =
      Math.min(...rowBounds.map((row) => row.center - row.height / 2)) - panelPadding;
    const panelBottom =
      Math.max(...rowBounds.map((row) => row.center + row.height / 2)) + panelPadding;
    const panelCenter = (panelTop + panelBottom) / 2;
    this.profilePanelBottom = panelBottom;

    createPanel(
      this,
      GAME_WIDTH / 2,
      panelCenter,
      width,
      panelBottom - panelTop,
      this.selectedWorld.accent,
      {
        alpha: 0.58,
      },
    );

    this.profileHaloImage = this.add
      .image(112, y, TextureKey.PlayerHalo)
      .setTint(profileColor)
      .setScale(0.48)
      .setAlpha(0.8);

    this.profileAuraImage = this.add.image(112, y, TextureKey.Glow).setAlpha(0.75);

    this.profileShapeImage = this.add
      .image(112, y, playerTextureForShape(shape.id))
      .setTint(profileColor)
      .setScale(0.34);
    this.updateProfilePreview();

    this.add
      .text(172, y - 26, playerName, textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 2,
        `LEVEL ${level}`,
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 28,
        `BESTWERT ${bestScore.toLocaleString('de-DE')}`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    this.add
      .text(
        172,
        y + 49,
        `COINS  ${coins.toLocaleString('de-DE')}`,
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(3);

    const cosmeticStyle = textStyle(FontSize.tiny, Palette.inkDim, { fontStyle: 'bold' });
    this.add.text(172, y + 72, `FORM  ${shape.name}`, cosmeticStyle).setOrigin(0, 0.5);
    this.add.text(172, y + 93, `FARBE  ${color.name}`, cosmeticStyle).setOrigin(0, 0.5);
    this.add.text(172, y + 114, `AURA  ${aura.name}`, cosmeticStyle).setOrigin(0, 0.5);

    this.add
      .text(
        172,
        y + 139,
        localPlay
          ? 'OFFLINE · LOKAL GESPEICHERT'
          : levelProgress.xpNeeded === 0
            ? 'MAX LEVEL'
            : `${levelProgress.xpNeeded - levelProgress.xpInLevel} XP BIS LEVEL ${levelProgress.level + 1}`,
        textStyle(FontSize.tiny, Palette.inkDim, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    const xpBar = createBar(this, 172, y + 157, 280, 8, this.selectedWorld.accent);
    xpBar.setRatio(levelProgress.ratio);

    createButton(this, 520, panelCenter, 'PROFIL', () => this.scene.start(SceneKey.Profile), {
      width: 170,
      height: 62,
      accent: this.selectedWorld.accent,
      fontSize: FontSize.tiny,
    });
  }

  /** Vertikaler Welten-Carousel mit Sperr-Zustand. */
  private buildWorldList(level: number): void {
    this.cleanupWorldList();

    const step = 112;
    const selectedIndex = Math.max(
      0,
      WORLDS.findIndex((world) => world.id === this.selectedWorld.id),
    );
    const compactWheel = selectedIndex > 0;
    const cardHeight = compactWheel ? 80 : 96;
    const wheelAngle = 0.8;
    const wheelRadius = compactWheel ? 108 : 140;
    const neighborScale = 0.72 + Math.cos(wheelAngle) * 0.28;
    const neighborExtent = Math.sin(wheelAngle) * wheelRadius + (cardHeight * neighborScale) / 2;
    const footer = this.getFooterLayout();
    const primaryTop = footer.primaryY - footer.primaryHeight / 2;
    const swipeHintY = primaryTop - 24;
    const layoutTop = this.profilePanelBottom + 18;
    const layoutBottom = swipeHintY - 10 - 18;
    const topExtent = selectedIndex > 0 ? neighborExtent : cardHeight / 2;
    const bottomExtent = selectedIndex < WORLDS.length - 1 ? neighborExtent : cardHeight / 2;
    // Der gesamte sichtbare Kartenstapel bekommt oben und unten denselben
    // Abstand: Profilblock und Wisch-Hinweis bilden die festen Grenzen.
    const centerY = (layoutTop + layoutBottom + topExtent - bottomExtent) / 2;

    const carousel = this.add.container(0, 0);
    this.worldCarousel = carousel;
    const cardWidth = GAME_WIDTH - 120;
    const wheelCards: Array<{
      card: Phaser.GameObjects.Container;
      offset: number;
      opacity: number;
    }> = [];

    WORLDS.forEach((world, index) => {
      const offset = index - selectedIndex;
      if (Math.abs(offset) > 1) return;

      const y = centerY + offset * step;
      const isUnlocked = world.unlockLevel <= level;
      const isSelected = offset === 0;
      const card = this.add.container(GAME_WIDTH / 2, y);

      const bg = this.add
        .image(0, 0, TextureKey.Pixel)
        .setDisplaySize(cardWidth, cardHeight)
        .setTint(world.accent)
        .setAlpha(0.18);

      const border = this.add.graphics();
      border.lineStyle(isSelected ? 3 : 1.5, world.accent, isUnlocked ? 0.9 : 0.3);
      border.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);

      card.add([bg, border]);

      // Ein sanfter Schein fuer jede Karte. Kein Post-FX-Blur: Auf mobilen
      // WebGL-Renderern fuellte der Blur den Container mit Schwarz.
      card.add(
        this.add
          .image(0, 0, TextureKey.Glow)
          .setDisplaySize(cardWidth * 1.08, compactWheel ? cardHeight * 1.05 : cardHeight * 2.1)
          .setTint(world.accent)
          .setAlpha(0.06)
          .setBlendMode(Phaser.BlendModes.ADD),
      );

      // Farbmarke am linken Rand - macht die Welt auch ohne Lesen erkennbar.
      const swatch = this.add
        .image(-cardWidth / 2 + 18, 0, TextureKey.Pixel)
        .setDisplaySize(5, cardHeight - 34)
        .setTint(world.accent)
        .setAlpha(isUnlocked ? 1 : 0.3);

      const name = this.add.text(
        -cardWidth / 2 + 42,
        -14,
        world.name,
        textStyle(FontSize.body, isUnlocked ? toCss(world.accent) : Palette.inkDim, {
          fontStyle: 'bold',
        }),
      );
      name.setOrigin(0, 0.5);

      card.add([swatch, name]);

      const subtitle = this.add
        .text(
          -cardWidth / 2 + 42,
          18,
          isUnlocked ? world.flavor : `Freigeschaltet ab Level ${world.unlockLevel}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5);
      subtitle.setWordWrapWidth(isUnlocked ? cardWidth - 150 : cardWidth - 76);
      card.add(subtitle);

      // Nur die ausgewaehlte, freigeschaltete Karte bekommt das Info-Symbol -
      // bei den kleineren Nachbarkarten waere die Trefferflaeche zu knapp, und
      // eine gesperrte Welt hat noch keine erspielte Mechanik zu erklaeren.
      if (isUnlocked && isSelected) {
        const infoButton = this.add
          .circle(cardWidth / 2 - 34, 0, 22, world.accent, 0.16)
          .setStrokeStyle(1.5, world.accent, 0.8)
          .setInteractive({ useHandCursor: true });
        const infoLabel = this.add
          .text(
            cardWidth / 2 - 34,
            0,
            'i',
            textStyle(FontSize.body, toCss(world.accent), { fontStyle: 'bold' }),
          )
          .setOrigin(0.5);
        infoButton.on('pointerup', () => {
          SoundSystem.playUiClick();
          this.scene.start(SceneKey.WorldInfo, {
            worldId: world.id,
            mode: 'jagd' satisfies WorldInfoMode,
          });
        });
        card.add([infoButton, infoLabel]);
      }

      if (!isUnlocked) {
        // Zentrales Schloss: Die Welt bleibt lesbar, aber der Zustand ist
        // ohne Text sofort erkennbar. Der dunkle Kreis gibt dem Symbol auf
        // jeder Weltfarbe einen ruhigen, klaren Kontrast.
        const lock = this.add.graphics();
        lock.fillStyle(Palette.backdrop, 0.88);
        lock.fillRoundedRect(-34, -34, 68, 68, 16);
        lock.lineStyle(2, world.accent, 0.65);
        lock.strokeRoundedRect(-34, -34, 68, 68, 16);

        lock.lineStyle(4, Palette.goldHex, 1);
        lock.beginPath();
        lock.arc(0, -5, 13, Math.PI, 0, false);
        lock.strokePath();
        lock.fillStyle(Palette.goldHex, 1);
        lock.fillRoundedRect(-17, -5, 34, 27, 6);
        lock.fillStyle(Palette.backdrop, 1);
        lock.fillCircle(0, 7, 3.5);
        lock.fillRect(-1.5, 7, 3, 8);
        card.add(lock);
      }

      carousel.add(card);
      wheelCards.push({ card, offset, opacity: isUnlocked ? 1 : 0.5 });
    });

    // Die Karten liegen auf einer senkrechten Kreisbahn statt auf einer
    // geraden Liste. Die Karten selbst bleiben dabei immer gerade: Nur ihre
    // Hoehe, Groesse und Tiefe aendern sich wie bei einem echten Wheel.
    const dragState = { offset: 0 };
    const updateWheel = (dragY: number): void => {
      // Ein Fingerzug darf nur genau eine Welt vor- oder zurueckschalten.
      // Ohne diese Begrenzung konnten die Karten bei langen Wischbewegungen
      // weit ueber den Nachbarbereich hinauslaufen.
      dragState.offset = Phaser.Math.Clamp(dragY, -step, step);
      const progress = dragState.offset / step;

      for (const entry of wheelCards) {
        const position = Phaser.Math.Clamp(entry.offset + progress, -1.35, 1.35);
        const radians = position * wheelAngle;
        const curve = Math.sin(radians);
        const depth = Math.max(0, Math.cos(radians));

        entry.card.x = GAME_WIDTH / 2 + curve * 12;
        entry.card.y = centerY + curve * wheelRadius;
        entry.card.setScale(0.72 + depth * 0.28);
        entry.card.setAlpha(entry.opacity * (0.72 + depth * 0.28));
        entry.card.setAngle(0);
        entry.card.setDepth(Math.round(depth * 20));
      }

      carousel.sort('depth');
    };

    const snapWheelBack = (): void => {
      this.tweens.add({
        targets: dragState,
        offset: 0,
        duration: 160,
        ease: 'Cubic.Out',
        onUpdate: () => updateWheel(dragState.offset),
      });
    };

    updateWheel(0);

    const swipeHint = this.add
      .text(
        GAME_WIDTH / 2,
        swipeHintY,
        'HOCH / RUNTER WISCHEN',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.swipeHintText = swipeHint;
    this.worldListDecorations.push(swipeHint);

    let startY = 0;
    let startX = 0;
    let activePointerId: number | null = null;
    const selectorTop = Math.max(370, layoutTop - 20);
    const selectorBottom = Math.min(swipeHintY - 10, layoutBottom + 20);
    // Seitlich auf den Kartenbereich begrenzt, damit Tipps ausserhalb des
    // Kreisels keinen unbeabsichtigten Wheel-Drag starten.
    const selectorLeft = GAME_WIDTH / 2 - cardWidth / 2;
    const selectorRight = GAME_WIDTH / 2 + cardWidth / 2;

    const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
      if (
        activePointerId !== null ||
        pointer.y < selectorTop ||
        pointer.y > selectorBottom ||
        pointer.x < selectorLeft ||
        pointer.x > selectorRight
      )
        return;
      activePointerId = pointer.id;
      startY = pointer.y;
      startX = pointer.x;
    };

    const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;
      updateWheel(pointer.y - startY);
    };

    const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id !== activePointerId) return;

      const deltaY = pointer.y - startY;
      const deltaX = pointer.x - startX;
      activePointerId = null;
      startY = 0;

      if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (!this.selectWorld(selectedIndex + (deltaY < 0 ? 1 : -1), level)) {
          snapWheelBack();
        }
        return;
      }

      if (Math.abs(deltaY) < 24 && pointer.y >= selectorTop && pointer.y <= selectorBottom) {
        const offset = Phaser.Math.Clamp(Math.round((pointer.y - centerY) / step), -1, 1);
        if (!this.selectWorld(selectedIndex + offset, level)) {
          snapWheelBack();
        }
        return;
      }

      snapWheelBack();
    };

    this.input.on('pointerdown', onPointerDown);
    this.input.on('pointermove', onPointerMove);
    this.input.on('pointerup', onPointerUp);
    this.worldInputCleanup = () => {
      this.input.off('pointerdown', onPointerDown);
      this.input.off('pointermove', onPointerMove);
      this.input.off('pointerup', onPointerUp);
    };
  }

  private cleanupWorldList(): void {
    this.worldInputCleanup?.();
    this.worldInputCleanup = null;
    this.worldCarousel?.destroy(true);
    this.worldCarousel = null;
    for (const decoration of this.worldListDecorations) decoration.destroy();
    this.worldListDecorations = [];
    this.swipeHintText = null;
  }

  private selectWorld(index: number, level: number): boolean {
    const world = WORLDS[index];
    if (!world || world.unlockLevel > level || world.id === this.selectedWorld.id) return false;

    SaveSystem.update((data) => {
      data.lastWorldId = world.id;
    });

    this.selectedWorld = world;
    this.transitionWorldBackdrop(world);
    SoundSystem.playWorldSelect(world.spaceVariant);
    this.buildWorldList(level);
    return true;
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

  private getFooterLayout(): {
    primaryY: number;
    secondaryY: number;
    tertiaryY: number;
    settingsY: number;
    primaryHeight: number;
    secondaryHeight: number;
    tertiaryHeight: number;
    settingsHeight: number;
    rowGap: number;
  } {
    const primaryHeight = 96;
    const secondaryHeight = 76;
    const tertiaryHeight = 60;
    const settingsHeight = 66;
    const rowGap = 22;
    const zeigtHinweis = isIos() && !isStandalone();
    const hinweisHoehe = 76;
    const hinweisPlatz = zeigtHinweis ? hinweisHoehe + rowGap : 0;
    const settingsY = GAME_HEIGHT - 110 - hinweisPlatz;
    const tertiaryY = settingsY - settingsHeight / 2 - rowGap - tertiaryHeight / 2;
    const secondaryY = tertiaryY - tertiaryHeight / 2 - rowGap - secondaryHeight / 2;
    const primaryY = secondaryY - secondaryHeight / 2 - rowGap - primaryHeight / 2;

    return {
      primaryY,
      secondaryY,
      tertiaryY,
      settingsY,
      primaryHeight,
      secondaryHeight,
      tertiaryHeight,
      settingsHeight,
      rowGap,
    };
  }

  /**
   * Drei Stufen statt eines gleichfoermigen Rasters: JAGD ist der Kern-Loop
   * und steht allein und gross oben. DUELL/TAGESLAUF sind Nebenmodi mit
   * eigenem Einstieg. ERFOLGE/TALENTBAUM/RANGLISTE sind Verwaltungsseiten -
   * niemand oeffnet sie, um "jetzt zu spielen". EINSTELLUNGEN bleibt ganz
   * unten und gedaempft. Designziel 1 aus GAME_DESIGN.md ("in 5 Sekunden
   * verstanden") verlangt eine sichtbare Hauptaktion statt acht gleich
   * gewichteter Kacheln.
   */
  private buildFooter(): void {
    const hasLeaderboard = CloudSystem.isAvailable();
    const footer = this.getFooterLayout();
    const {
      primaryY,
      secondaryY,
      tertiaryY,
      settingsY,
      primaryHeight,
      secondaryHeight,
      tertiaryHeight,
      settingsHeight,
      rowGap,
    } = footer;

    const hinweisHoehe = 76;

    // JAGD und TAGESLAUF teilen sich die betonte obere Reihe. Das Duell hat
    // darunter einen eigenen, zentralen Einstieg fuer lokale, Bot- und
    // Netzwerkduelle.
    const secondaryGap = 115;
    const secondaryWidth = 210;

    createButton(
      this,
      GAME_WIDTH / 2 - secondaryGap,
      primaryY,
      'JAGD',
      () => {
        this.scene.start(SceneKey.WorldInfo, {
          worldId: this.selectedWorld.id,
          mode: 'jagd' satisfies WorldInfoMode,
        });
      },
      {
        width: secondaryWidth,
        height: primaryHeight,
        accent: this.selectedWorld.accent,
        fontSize: FontSize.large,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2 + secondaryGap,
      primaryY,
      'TAGESLAUF',
      () => {
        this.scene.start(SceneKey.WorldInfo, {
          worldId: this.selectedWorld.id,
          mode: 'tageslauf' satisfies WorldInfoMode,
        });
      },
      {
        width: secondaryWidth,
        height: primaryHeight,
        accent: Palette.dailyHex,
        fontSize: FontSize.body,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      secondaryY,
      'DUELL',
      () => this.scene.start(SceneKey.OnlineDuel, { worldId: this.selectedWorld.id }),
      {
        width: 360,
        height: secondaryHeight,
        accent: Palette.goldHex,
        fontSize: FontSize.body,
      },
    );

    const tertiaryGap = 152;
    const tertiaryWidth = 132;

    createButton(
      this,
      GAME_WIDTH / 2 - tertiaryGap,
      tertiaryY,
      'ERFOLGE',
      () => this.scene.start(SceneKey.Achievements),
      {
        width: tertiaryWidth,
        height: tertiaryHeight,
        accent: Palette.achievementHex,
        fontSize: FontSize.tiny,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      tertiaryY,
      'TALENTE',
      () => this.scene.start(SceneKey.Talents, { returnTo: SceneKey.Menu }),
      { width: tertiaryWidth, height: tertiaryHeight, accent: 0xb782ff, fontSize: FontSize.tiny },
    );

    const leaderboardButton = createButton(
      this,
      GAME_WIDTH / 2 + tertiaryGap,
      tertiaryY,
      'RANGLISTE',
      () => this.scene.start(SceneKey.Leaderboard),
      { width: tertiaryWidth, height: tertiaryHeight, accent: 0x9aa3bd, fontSize: FontSize.tiny },
    );
    leaderboardButton.setEnabled(hasLeaderboard);

    // EINSTELLUNGEN und SHOP teilen sich die unterste Reihe. Die Gesamtbreite
    // (250 + 22 + 150 = 422) liegt bewusst dicht an den Reihen darueber
    // (436 bzw. 440), damit die drei Bloecke eine gemeinsame Kante bilden.
    //
    // Die Breite von EINSTELLUNGEN haengt nicht mehr davon ab, ob der
    // Online-Dienst eingerichtet ist - der frei gewordene Platz gehoert jetzt
    // dem SHOP, nicht dem Knopf daneben.
    const settingsWidth = 250;
    const shopWidth = 150;
    const bottomGap = rowGap;
    const bottomLeft = (GAME_WIDTH - (settingsWidth + bottomGap + shopWidth)) / 2;

    createButton(
      this,
      bottomLeft + settingsWidth / 2,
      settingsY,
      'EINSTELLUNGEN',
      () => this.scene.start(SceneKey.Settings),
      {
        width: settingsWidth,
        height: settingsHeight,
        accent: 0x9aa3bd,
        fontSize: FontSize.small,
      },
    );

    // Gold wie die Coin-Zahl im Profilblock: Der Knopf soll ohne Erklaerung
    // zeigen, wofuer die gesammelten Muenzen da sind. Alle anderen Knoepfe
    // dieser Reihe sind grau - der Shop hebt sich bewusst ab.
    createButton(
      this,
      bottomLeft + settingsWidth + bottomGap + shopWidth / 2,
      settingsY,
      'SHOP',
      () => this.scene.start(SceneKey.Shop),
      {
        width: shopWidth,
        height: settingsHeight,
        accent: Palette.goldHex,
        fontSize: FontSize.small,
      },
    );

    // Der Hinweis darf die Knopfreihe nicht ueberdecken - er bekommt ihre
    // Oberkante und setzt sich darueber.
    this.buildHint(settingsY + settingsHeight / 2, hinweisHoehe, rowGap);
  }

  /**
   * Fusszeile: Auf dem iPhone der einzige Weg zum Vollbild, weil es dort keine
   * Fullscreen-API gibt (core/display.ts). Der Hinweis steht bewusst als
   * eigener Kasten: Beim Spieltest wurde ein
   * Fusszeilentext dort schlicht uebersehen, und die
   * Rueckmeldung lautete, es gebe gar keinen Vollbild-Knopf. Der Knopf fehlt
   * auf iOS zu Recht (ADR-0009) - dann muss aber der Ersatz auffindbar sein.
   */
  /**
   * @param knopfreiheUnten Unterkante der untersten Knopfreihe.
   * @param hoehe Hoehe des Hinweiskastens - dieselbe, die `buildFooter()`
   *   beim Berechnen der Reihen reserviert hat.
   * @param abstand Abstand zur Knopfreihe.
   */
  private buildHint(knopfreiheUnten: number, hoehe: number, abstand: number): void {
    if (isIos() && !isStandalone()) {
      const y = knopfreiheUnten + abstand + hoehe / 2;

      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, hoehe, Palette.goldHex, {
        alpha: 0.5,
      });

      this.add
        .text(
          GAME_WIDTH / 2,
          y - 15,
          'VOLLBILD OHNE ADRESSLEISTE',
          textStyle(FontSize.tiny, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setLetterSpacing(3);

      this.add
        .text(
          GAME_WIDTH / 2,
          y + 15,
          'Teilen-Symbol  ›  Zum Home-Bildschirm',
          textStyle(FontSize.tiny, Palette.ink),
        )
        .setOrigin(0.5);
    }

    // Hier stand einmal eine zweite Versionsnummer. Sie ist entfernt: Die
    // Anzeige lebt im DOM (`index.html` -> #version, gesetzt in main.ts) und
    // war dadurch doppelt zu sehen. Das DOM gewinnt, weil es die Nummer auch
    // dann zeigt, wenn Phaser gar nicht erst startet - genau dafuer war sie da.
  }
}
