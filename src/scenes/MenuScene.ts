/**
 * Startbildschirm: Profil, Weltenauswahl, Start.
 *
 * Der Bildschirm ist der schnelle Einstieg: Name, Welt und Jagd. Die
 * Fortschrittszahlen liegen im Profil und unterbrechen den Start nicht.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { isIos, isStandalone } from '@/core/display';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import { SceneKey } from '@/scenes/SceneKey';
import { Depth } from '@/ui/depth';
import { attachHitDebug } from '@/ui/hitDebug';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SoundSystem from '@/systems/SoundSystem';
import * as SyncStatusSystem from '@/systems/SyncStatusSystem';
import { playerTextureForLevel, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createAmbientMotes,
  createBar,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

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
  private readonly onlineHandler = (): void => {
    void this.synchronizeData();
  };

  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    SafeAreaSystem.showMenuTicker();
    const save = SaveSystem.load();
    // Der lokale Stand darf nicht weiter wie ein eingeloggtes Profil wirken,
    // wenn die Auth-Session bereits beendet oder abgelaufen ist. Das ist vor
    // allem nach einer externen Abmeldung wichtig: Der Cloud-Stand bleibt
    // erhalten und wird beim nächsten Einloggen wieder geladen.
    if (AuthSystem.isReady() && !AuthSystem.isSignedIn() && save.playerName) {
      SaveSystem.clearLocalProfile();
      this.scene.start(SceneKey.Account, { firstStart: true });
      return;
    }
    if (!save.playerName) {
      // Ein Erstprofil ist immer ein Online-Profil. Ohne erfolgreiche
      // Anmeldung wird kein lokaler Ersatzstand angelegt, damit jeder neue
      // Spielstand nach einer Neuinstallation wiederherstellbar bleibt.
      this.scene.start(SceneKey.Account, { firstStart: true });
      return;
    }

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
    this.buildProfilePanel(save.playerName, save.level, save.bestScore, save.coins);
    this.buildWorldList(save.level);
    this.buildFooter();

    void this.showUpdateHintIfAny();
    void this.synchronizeData();
    window.addEventListener('online', this.onlineHandler);

    // Nur mit ?hitboxes in der Adresse - zeigt, was Phaser fuer anfassbar haelt.
    attachHitDebug(this);

    this.events.once('shutdown', () => {
      this.cleanupWorldList();
      window.removeEventListener('online', this.onlineHandler);
      this.clearSavePrompt();
      this.hideSyncPopup();
      this.hideLoginBonusPopup();
    });
  }

  /**
   * Führt beim App-Start alle ausstehenden Uploads gemeinsam aus. Offline
   * verschwindet der Hinweis sofort; der Profilstatus bleibt dann bewusst auf
   * „noch nicht aktuell“, bis ein erfolgreicher Abgleich möglich war.
   */
  private async synchronizeData(): Promise<void> {
    if (this.saveSyncBusy || !this.scene.isActive()) {
      console.warn('[MenuScene] synchronizeData uebersprungen', {
        saveSyncBusy: this.saveSyncBusy,
        sceneActive: this.scene.isActive(),
      });
      return;
    }

    if (!CloudSystem.isAvailable() || SaveSystem.isTestProfileActive()) {
      console.warn('[MenuScene] synchronizeData: kein Online-Profil (Backend/Testprofil)');
      SyncStatusSystem.setDataSyncStatus('local-only');
      return;
    }

    this.showSyncPopup();
    if (!navigator.onLine) {
      console.warn('[MenuScene] synchronizeData: Geraet meldet offline');
      SyncStatusSystem.setDataSyncStatus('offline');
      this.hideSyncPopup();
      return;
    }

    SyncStatusSystem.setDataSyncStatus('syncing');
    try {
      const saveSynced = await this.checkCloudSave();
      if (!this.scene.isActive()) return;

      await CloudSystem.flushPendingLeaderboardScore();
      if (!this.scene.isActive()) return;

      await this.claimDailyLoginBonus();
      if (!this.scene.isActive()) return;

      const hasPendingData =
        ProgressSyncSystem.hasPendingData() ||
        CloudSystem.hasPendingLeaderboardScore() ||
        this.savePromptObjects.length > 0;
      SyncStatusSystem.setDataSyncStatus(saveSynced && !hasPendingData ? 'up-to-date' : 'pending');
    } catch {
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
    if (
      this.saveSyncBusy ||
      !CloudSystem.isAvailable() ||
      SaveSystem.isTestProfileActive() ||
      !this.scene.isActive()
    )
      return false;
    this.saveSyncBusy = true;

    const local = SaveSystem.load();
    if (AuthSystem.isSignedIn()) {
      // Erst lokale Offline-Runs ablegen, dann den gemeinsamen Profilstand
      // lesen. Ein Remote-Stand wird nur übernommen, wenn er weiter ist; eine
      // noch nicht gesendete Outbox bleibt dadurch erhalten.
      await ProgressSyncSystem.flush();
      // Alte anonyme Ranglisteneintraege werden beim Menuebesuch mit dem
      // Loginprofil zusammengefuehrt, damit ein sichtbarer Name nicht doppelt
      // auftaucht. Der vorhandene Profilstand bleibt dabei unveraendert.
      const claimed = local.cloudId
        ? await CloudSystem.claimCloudProfile(local.cloudId)
        : ({ ok: true, value: null } as const);
      const profile =
        claimed.ok && claimed.value ? claimed : await CloudSystem.fetchProfileProgress();
      // Diagnose fuer Mehrgeraete-Faelle, in denen der automatische Abgleich
      // scheinbar nichts tut: zeigt, welcher Zweig lief und was er sah, ohne
      // dass dafuer erst der manuelle "PROFIL ABGLEICHEN"-Button gebraucht wird.
      console.warn('[MenuScene] checkCloudSave (signed in)', {
        localLevel: local.level,
        localCloudId: local.cloudId,
        claimedOk: claimed.ok,
        claimedHasValue: claimed.ok && claimed.value !== null,
        profileOk: profile.ok,
        profileError: profile.ok ? null : profile.error,
        remoteLevel: profile.ok && profile.value ? profile.value.data.level : null,
      });
      if (profile.ok && profile.value) {
        const remote: RemoteSave = {
          data: profile.value.data,
          level: profile.value.data.level,
          bestScore: profile.value.data.bestScore,
          totalRuns: profile.value.data.totalRuns,
          updatedAt: profile.value.updatedAt,
        };
        if (CloudSystem.isRemoteAhead(local, remote)) {
          console.warn('[MenuScene] checkCloudSave: remote ist voraus, uebernehme', {
            remoteLevel: remote.level,
          });
          SaveSystem.adoptRemote(remote.data, local.cloudId ?? AuthSystem.currentUserId()!);
          this.saveSyncBusy = false;
          this.scene.restart();
          return false;
        }
      }
      this.saveSyncBusy = false;
      return profile.ok;
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
        '+25 COINS',
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
        SaveSystem.adoptRemote(remote.data, local.cloudId);
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
            void this.synchronizeData();
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

    // Im freien Streifen unter dem Wisch-Hinweis (endet bei y=730) und ueber
    // der JAGD-Reihe (beginnt fruehestens bei y=839, siehe buildFooter) - dort
    // ist Platz, ohne mit Weltenwheel oder Footer zu kollidieren. Ein neuer
    // Stand ist eine Ausnahmemeldung und darf entsprechend auffallen: groesser
    // als ein normaler Knopf und mit einem zusaetzlichen, rein dekorativen
    // Puls-Glow dahinter.
    //
    // Der Puls sitzt bewusst NICHT auf banner.container: Ein pulsierender
    // setScale() auf dem interaktiven Container wuerde periodisch auch die
    // Trefferflaeche schrumpfen lassen - exakt die Falle aus ART_STYLE.md 8.2.
    const bannerY = 785;
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
    const levelProgress = ProgressionSystem.getLevelProgress(SaveSystem.load());
    const rowBounds = [
      { center: y - 26, height: FontSize.body },
      { center: y + 2, height: FontSize.body },
      { center: y + 28, height: FontSize.tiny },
      { center: y + 49, height: FontSize.body },
      { center: y + 80, height: 20 },
    ];
    const panelPadding = 25;
    const panelTop =
      Math.min(...rowBounds.map((row) => row.center - row.height / 2)) - panelPadding;
    const panelBottom =
      Math.max(...rowBounds.map((row) => row.center + row.height / 2)) + panelPadding;
    const panelCenter = (panelTop + panelBottom) / 2;

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

    this.add
      .image(112, y, TextureKey.PlayerHalo)
      .setTint(this.selectedWorld.accent)
      .setScale(0.48)
      .setAlpha(0.8);

    this.add.image(112, y, playerTextureForLevel(level)).setTint(Palette.goldHex).setScale(0.34);

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

    this.add
      .text(
        172,
        y + 73,
        levelProgress.xpNeeded === 0
          ? 'MAX LEVEL'
          : `${levelProgress.xpNeeded - levelProgress.xpInLevel} XP BIS LEVEL ${levelProgress.level + 1}`,
        textStyle(FontSize.tiny, Palette.inkDim, { fontStyle: 'bold' }),
      )
      .setOrigin(0, 0.5);

    const xpBar = createBar(this, 172, y + 88, 280, 8, this.selectedWorld.accent);
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

    const centerY = 530;
    const step = 112;
    const selectedIndex = Math.max(
      0,
      WORLDS.findIndex((world) => world.id === this.selectedWorld.id),
    );

    const carousel = this.add.container(0, 0);
    this.worldCarousel = carousel;
    const cardWidth = GAME_WIDTH - 120;
    const cardHeight = 96;
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
          .setDisplaySize(cardWidth * 1.08, cardHeight * 2.1)
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
      subtitle.setWordWrapWidth(cardWidth - 76);
      card.add(subtitle);

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
    const wheelRadius = 140;
    const wheelAngle = 0.8;
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
      .text(GAME_WIDTH / 2, 730, 'HOCH / RUNTER WISCHEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.worldListDecorations.push(swipeHint);

    // Pfeile als zuverlaessiger Zweitweg zur Wisch-Geste. Wische-mit-
    // Geschwindigkeitsschwelle ist fuer motorisch weniger sichere Finger
    // (Kinder, aeltere Nutzer) ein unzuverlaessiger Erstkontakt - ein
    // misslungener Swipe gibt kein Feedback ausser dem Zurueckschnappen.
    // Die Pfeile rufen dieselbe selectWorld()-Funktion auf wie die Geste,
    // es entsteht also kein zweiter Auswahlpfad mit eigenem Zustand.
    // Die Karte oberhalb der Mitte zeigt den vorherigen Index (offset -1),
    // die Karte darunter den naechsten (offset +1) - siehe y = centerY +
    // offset * step weiter oben. Die Pfeile folgen dieser Bildschirmrichtung:
    // ▲ geht zur oben angezeigten (vorherigen), ▼ zur unten angezeigten
    // (naechsten) Welt.
    const arrowX = GAME_WIDTH / 2 + cardWidth / 2 + 30;
    const arrowUp = createButton(
      this,
      arrowX,
      centerY - step,
      '▲',
      () => this.stepWorld(-1, level),
      {
        width: 52,
        height: 52,
        accent: 0x9aa3bd,
        fontSize: FontSize.body,
      },
    );
    const arrowDown = createButton(
      this,
      arrowX,
      centerY + step,
      '▼',
      () => this.stepWorld(1, level),
      {
        width: 52,
        height: 52,
        accent: 0x9aa3bd,
        fontSize: FontSize.body,
      },
    );
    arrowUp.setEnabled(selectedIndex > 0);
    arrowDown.setEnabled(selectedIndex < WORLDS.length - 1);
    this.worldListDecorations.push(arrowUp.container, arrowDown.container);

    let startY = 0;
    let startX = 0;
    let activePointerId: number | null = null;
    const selectorTop = 370;
    const selectorBottom = 700;
    // Seitlich auf den Kartenbereich begrenzt, damit ein Tipp auf die
    // Pfeil-Buttons rechts daneben nicht zusaetzlich einen Wheel-Drag
    // startet - sonst koennte ein leicht zitternder Finger auf dem Pfeil
    // gleichzeitig den Klick UND ein Zurueckschnappen des Wheels ausloesen.
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
  }

  /** Pfeil-Fallback zum Wisch-Wheel: einen Schritt vor oder zurueck. */
  private stepWorld(direction: 1 | -1, level: number): void {
    const currentIndex = WORLDS.findIndex((world) => world.id === this.selectedWorld.id);
    this.selectWorld(currentIndex + direction, level);
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
    const settingsY = GAME_HEIGHT - 110;

    const primaryHeight = 96;
    const secondaryHeight = 76;
    const tertiaryHeight = 60;
    const settingsHeight = 66;
    const rowGap = 22;

    // Abstand zu EINSTELLUNGEN genauso gross wie zwischen den anderen Reihen -
    // sonst reicht der optische Lichtschein der Knoepfe (createButton haelt
    // seinen Halo bis zum 2,6-fachen der Knopfhoehe) in die Nachbarreihe.
    const tertiaryY = settingsY - settingsHeight / 2 - rowGap - tertiaryHeight / 2;
    const secondaryY = tertiaryY - tertiaryHeight / 2 - rowGap - secondaryHeight / 2;
    const primaryY = secondaryY - secondaryHeight / 2 - rowGap - primaryHeight / 2;

    createButton(
      this,
      GAME_WIDTH / 2,
      primaryY,
      'JAGD',
      () => {
        this.scene.start(SceneKey.Game, { worldId: this.selectedWorld.id });
      },
      {
        width: 460,
        height: primaryHeight,
        accent: this.selectedWorld.accent,
        fontSize: FontSize.large,
      },
    );

    const secondaryGap = 115;
    const secondaryWidth = 210;

    createButton(
      this,
      GAME_WIDTH / 2 - secondaryGap,
      secondaryY,
      'DUELL',
      () => {
        ChallengeSystem.start(this.selectedWorld.id);
        this.scene.start(SceneKey.Challenge);
      },
      {
        width: secondaryWidth,
        height: secondaryHeight,
        accent: Palette.goldHex,
        fontSize: FontSize.small,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2 + secondaryGap,
      secondaryY,
      'TAGESLAUF',
      () => {
        ChallengeSystem.startDaily(this.selectedWorld.id);
        this.scene.start(SceneKey.Challenge);
      },
      {
        width: secondaryWidth,
        height: secondaryHeight,
        accent: Palette.dailyHex,
        fontSize: FontSize.small,
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
      'TALENTBAUM',
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

    createButton(
      this,
      GAME_WIDTH / 2,
      settingsY,
      'EINSTELLUNGEN',
      () => this.scene.start(SceneKey.Settings),
      {
        width: CloudSystem.isAvailable() ? 244 : 300,
        height: 66,
        accent: 0x9aa3bd,
        fontSize: FontSize.small,
      },
    );

    this.buildHint();
  }

  /**
   * Fusszeile: Auf dem iPhone der einzige Weg zum Vollbild, weil es dort keine
   * Fullscreen-API gibt (core/display.ts). Der Hinweis steht bewusst als
   * eigener Kasten: Beim Spieltest wurde ein
   * Fusszeilentext dort schlicht uebersehen, und die
   * Rueckmeldung lautete, es gebe gar keinen Vollbild-Knopf. Der Knopf fehlt
   * auf iOS zu Recht (ADR-0009) - dann muss aber der Ersatz auffindbar sein.
   */
  private buildHint(): void {
    if (isIos() && !isStandalone()) {
      // Der Kasten sitzt am unteren Rand des Menues.
      const y = GAME_HEIGHT - 88;

      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 76, Palette.goldHex, { alpha: 0.5 });

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
