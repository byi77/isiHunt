/**
 * Profilbildschirm.
 *
 * Der Name gehoert zum Spieler und nicht zur Bestenliste. Beim ersten Start
 * ist er Pflicht, spaeter kann er hier jederzeit geaendert werden. Das Icon
 * ist bewusst die Lichtfigur aus dem Spiel - kein zweites Avatar-System fuer
 * eine Information, die bereits eine klare visuelle Sprache hat.
 *
 * Seit 2026-08-18 auch das Ziel des frueher separaten AccountScene-Bereichs
 * "PROFIL & GERÄTE" (Login/Abgleichen/Abmelden): Der Hauptmenue-Knopf
 * "PROFIL" und der Weg ueber Einstellungen zeigten vorher auf zwei
 * verschiedene Bildschirme mit gleichem Namen. AccountScene selbst behandelt
 * jetzt nur noch den eigentlichen Login-/Registrierungsvorgang.
 */

import Phaser from 'phaser';

import { PLAYER_NAME_MAX_LENGTH } from '@/config/backend';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SyncStatusSystem from '@/systems/SyncStatusSystem';
import { playerTextureForLevel, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createButton,
  createDriftLayers,
  createMenuLayout,
  createPanel,
  createVignette,
  createWorldBackdrop,
  PAGE_CONTENT_TOP,
} from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

function formatPlayTime(milliseconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} Std. ${minutes} Min.` : `${minutes} Min.`;
}

export interface ProfileSceneData {
  firstStart?: boolean;
}

export class ProfileScene extends Phaser.Scene {
  private busy = false;
  private accountStatus!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKey.Profile);
  }

  create(data: ProfileSceneData = {}): void {
    SafeAreaSystem.showStatic('DEIN PROFIL');
    const save = SaveSystem.load();
    const firstStart = data.firstStart ?? false;
    const world = getWorld(save.lastWorldId);
    const levelProgress = ProgressionSystem.getLevelProgress(save);

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, world.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    const layout = createMenuLayout();
    if (!firstStart) createBackButton(this, () => this.scene.start(SceneKey.Menu));

    // Karten und Textinput bewegen sich gemeinsam; Kopfzeile und
    // Zurueck-Zone bleiben ausserhalb dieses Containers fest am Bildschirm
    // stehen - selbes Muster wie SettingsScene. Noetig geworden, seit der
    // zusaetzliche Account-Bereich die Seite auf kleinen Geraeten ueber die
    // sichtbare Hoehe hinaus verlaengern kann.
    const content = this.add.container(0, 0);
    const addContent = (object: Phaser.GameObjects.GameObject): void => {
      content.add(object);
    };

    const statsVisible = !firstStart;
    // Wie alle Unterseiten beginnt das erste Inhaltsmodul direkt unter der
    // Safe-Area-Kopfzeile. Diese Seite hatte früher eine zweite Überschrift
    // samt Sonderabstand; der zentrale Stapel verhindert das künftig.
    const sections = layout.sections;
    const profileY = sections.next(620);
    const statisticsY = statsVisible ? sections.next(220) : 0;
    const accountY = !firstStart ? sections.next(300) : 0;

    addContent(
      createPanel(this, GAME_WIDTH / 2, profileY, GAME_WIDTH - 120, 620, world.accent, {
        alpha: 0.62,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .image(GAME_WIDTH / 2, profileY - 210, TextureKey.PlayerHalo)
        .setTint(world.accent)
        .setScale(1.15)
        .setAlpha(0.8),
    );

    addContent(
      this.add
        .image(GAME_WIDTH / 2, profileY - 210, playerTextureForLevel(save.level))
        .setTint(Palette.goldHex)
        .setScale(0.82),
    );

    addContent(
      this.add
        .text(GAME_WIDTH / 2, profileY + 40, 'DEIN NAME', textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0.5)
        .setLetterSpacing(5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 110,
          `LEVEL ${levelProgress.level}`,
          textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0.5)
        .setLetterSpacing(2),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 73,
          `BESTWERT ${save.bestScore.toLocaleString('de-DE')}`,
          textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 40,
          `COINS ${save.coins.toLocaleString('de-DE')}`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5, 0.5),
    );

    if (!firstStart) {
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            profileY - 4,
            SyncStatusSystem.dataSyncStatusLabel(),
            textStyle(FontSize.tiny, Palette.inkDim, { fontStyle: 'bold' }),
          )
          .setOrigin(0.5, 0.5)
          .setLetterSpacing(1),
      );
    }

    let saveButton: ButtonHandle | null = null;
    const status = this.add
      .text(GAME_WIDTH / 2, profileY + 155, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');
    addContent(status);

    const updateButton = (): void => {
      const name = CloudSystem.sanitizePlayerName(input.getValue());
      saveButton?.setEnabled(name.length > 0);
      if (name.length > 0) status.setText('');
    };

    let saving = false;
    const saveProfile = async (): Promise<void> => {
      if (saving) return;
      const name = CloudSystem.sanitizePlayerName(input.getValue());
      if (!name) {
        status.setText('Bitte gib einen Namen ein.').setColor(Palette.gold);
        return;
      }

      const currentPlayerId = AuthSystem.currentUserId() ?? SaveSystem.load().cloudId;
      if (CloudSystem.isAvailable() && navigator.onLine) {
        saving = true;
        saveButton?.setEnabled(false);
        const availability = await CloudSystem.isPlayerNameAvailable(name, currentPlayerId);
        if (!availability.ok) {
          saving = false;
          saveButton?.setEnabled(true);
          status.setText(availability.error).setColor(Palette.gold);
          return;
        }
        if (!availability.value) {
          saving = false;
          saveButton?.setEnabled(true);
          status.setText('Dieser Spielername ist bereits vergeben.').setColor(Palette.gold);
          return;
        }
      }

      SaveSystem.setPlayerName(name);
      if (CloudSystem.isAvailable() && !SaveSystem.isTestProfileActive()) {
        if (AuthSystem.isSignedIn()) {
          const result = await CloudSystem.updateProfileIdentity(name);
          if (!result.ok) {
            saving = false;
            saveButton?.setEnabled(true);
            status.setText(result.error).setColor(Palette.gold);
            return;
          }
          await ProgressSyncSystem.flush();
        } else {
          const playerId = SaveSystem.ensureCloudId();
          const result = await CloudSystem.updateLeaderboardName(playerId, name);
          if (!result.ok) {
            saving = false;
            saveButton?.setEnabled(true);
            status.setText(result.error).setColor(Palette.gold);
            return;
          }
          await CloudSystem.syncSaveSafely();
        }
      }
      this.scene.start(SceneKey.Menu);
    };

    const input = createTextInput(this, GAME_WIDTH / 2, profileY + 100, {
      placeholder: 'Name eingeben',
      maxLength: PLAYER_NAME_MAX_LENGTH,
      width: 420,
      accent: world.accent,
      onSubmit: saveProfile,
    });
    addContent(input.element);

    input.setValue(CloudSystem.sanitizePlayerName(save.playerName));
    input.element.node.addEventListener('input', () => {
      const inputElement = input.element.node as HTMLInputElement;
      const rawValue = input.getValue();
      const cursor = inputElement.selectionStart ?? rawValue.length;
      const cleanedValue = CloudSystem.sanitizePlayerName(rawValue);
      if (cleanedValue !== rawValue) {
        const cleanedBeforeCursor = CloudSystem.sanitizePlayerName(rawValue.slice(0, cursor));
        input.setValue(cleanedValue);
        inputElement.setSelectionRange(cleanedBeforeCursor.length, cleanedBeforeCursor.length);
      }
      updateButton();
    });
    input.element.node.addEventListener('blur', () => {
      input.setValue(CloudSystem.sanitizePlayerName(input.getValue()));
    });

    saveButton = createButton(
      this,
      GAME_WIDTH / 2,
      profileY + 255,
      firstStart ? "LOS GEHT'S" : 'SPEICHERN',
      saveProfile,
      { width: 440, accent: world.accent, fontSize: FontSize.large },
    );
    addContent(saveButton.container);
    updateButton();

    if (firstStart) {
      status
        .setText('Lokales Offline-Profil erstellt. Du kannst es später online verbinden.')
        .setColor(toCss(world.accent));
    }

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY + 205,
          levelProgress.xpNeeded === 0
            ? `Level ${levelProgress.level}  ·  MAX LEVEL`
            : `Level ${levelProgress.level}  ·  ${levelProgress.xpInLevel} / ${levelProgress.xpNeeded} XP`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    if (statsVisible) {
      const totalRelics = Object.values(save.collected).reduce((sum, count) => sum + count, 0);
      const averageScore = save.totalRuns > 0 ? Math.round(save.totalScore / save.totalRuns) : 0;
      const statistics = [
        ['RUNS GESAMT', save.totalRuns.toLocaleString('de-DE')],
        ['SPIELZEIT', formatPlayTime(save.totalPlayTimeMs)],
        ['PUNKTE GESAMT', save.totalScore.toLocaleString('de-DE')],
        ['Ø PRO RUN', averageScore.toLocaleString('de-DE')],
        ['RELIKTE', totalRelics.toLocaleString('de-DE')],
        ['BESTE KETTE', save.bestCombo.toLocaleString('de-DE')],
        ['COINS VERDIENT', save.totalCoinsEarned.toLocaleString('de-DE')],
        ['COINS AUSGEGEBEN', save.coinsSpent.toLocaleString('de-DE')],
      ] as const;

      addContent(
        createPanel(this, GAME_WIDTH / 2, statisticsY, GAME_WIDTH - 120, 220, world.accent, {
          alpha: 0.52,
          radius: 18,
        }),
      );
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            statisticsY - 93,
            'STATISTIKEN',
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0.5)
          .setLetterSpacing(4),
      );

      statistics.forEach(([label, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = column === 0 ? 105 : 405;
        const y = statisticsY - 60 + row * 43;
        addContent(
          this.add
            .text(x, y, label, textStyle(14, Palette.inkDim, { fontStyle: 'bold' }))
            .setOrigin(0, 0.5),
        );
        addContent(
          this.add
            .text(x, y + 19, value, textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }))
            .setOrigin(0, 0.5),
        );
      });
    }

    if (!firstStart) this.buildAccountSection(world.accent, accountY, addContent);

    const contentBottom = (!firstStart ? accountY + 150 : profileY + 310) + 40;
    const maxScroll = Math.max(0, contentBottom - layout.contentBottom);
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: PAGE_CONTENT_TOP,
      dragZoneBottom: layout.contentBottom,
      onOffsetChange: (offset) => {
        content.y = -offset;
      },
    });
  }

  /**
   * Login/Geraete-Bereich, uebernommen aus der frueheren AccountScene
   * (eingeloggter Zustand).
   */
  private buildAccountSection(
    accent: number,
    accountY: number,
    addContent: (object: Phaser.GameObjects.GameObject) => void,
  ): void {
    addContent(
      createPanel(this, GAME_WIDTH / 2, accountY, GAME_WIDTH - 120, 300, accent, {
        alpha: 0.58,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          accountY - 105,
          'PROFIL & GERÄTE',
          textStyle(FontSize.body, Palette.gold),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    this.accountStatus = this.add
      .text(GAME_WIDTH / 2, accountY + 110, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');
    addContent(this.accountStatus);

    if (AuthSystem.isSignedIn()) {
      const alias = AuthSystem.currentAlias() ?? 'angemeldetes Profil';
      addContent(
        this.add
          .text(GAME_WIDTH / 2, accountY - 55, alias, textStyle(FontSize.small, Palette.ink))
          .setOrigin(0.5),
      );

      const sync = createButton(
        this,
        GAME_WIDTH / 2,
        accountY + 5,
        'PROFIL ABGLEICHEN',
        () => void this.syncAccount(),
        { width: 440, height: 66, accent, fontSize: FontSize.small },
      );
      addContent(sync.container);
      const signOut = createButton(
        this,
        GAME_WIDTH / 2,
        accountY + 70,
        'ABMELDEN',
        () => void this.signOutAccount(),
        { width: 360, height: 58, accent: 0x9aa3bd, fontSize: FontSize.tiny },
      );
      addContent(signOut.container);

      this.accountStatus.setText(
        `${ProgressSyncSystem.pendingCount()} ausstehende Änderung${ProgressSyncSystem.pendingCount() === 1 ? '' : 'en'}.`,
      );
    } else {
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            accountY - 45,
            'Melde dich auf iPhone und iPad mit demselben Profil an.\nDein Fortschritt wird sicher in deinem Online-Profil gespeichert.',
            textStyle(FontSize.small, Palette.ink),
          )
          .setOrigin(0.5)
          .setAlign('center'),
      );

      const accountButton = createButton(
        this,
        GAME_WIDTH / 2,
        accountY + 40,
        'ANMELDEN / PROFIL ANLEGEN',
        () => this.scene.start(SceneKey.Account),
        { width: 460, height: 70, accent, fontSize: FontSize.small },
      );
      addContent(accountButton.container);

      if (!AuthSystem.isConfigured()) {
        accountButton.setEnabled(false);
        this.accountStatus.setText('Das Online-Profil ist gerade nicht verfügbar.');
      }
    }
  }

  private async syncAccount(): Promise<void> {
    if (this.busy) return;
    if (!navigator.onLine) {
      this.accountStatus.setText('Zum Abgleichen brauchst du Internet.').setColor(Palette.gold);
      return;
    }
    this.busy = true;
    this.accountStatus.setText('Gemeinsames Profil wird geladen ...').setColor(Palette.inkDim);

    const local = SaveSystem.load();
    let remote = await CloudSystem.fetchProfileProgress();
    if (!remote.ok) {
      this.busy = false;
      this.accountStatus.setText(remote.error).setColor(Palette.gold);
      return;
    }

    if (local.cloudId) {
      remote = await CloudSystem.claimCloudProfile(local.cloudId);
      if (!remote.ok) {
        this.busy = false;
        this.accountStatus.setText(remote.error).setColor(Palette.gold);
        return;
      }
    }

    if (remote.value) {
      const summary: RemoteSave = {
        data: remote.value.data,
        level: remote.value.data.level,
        bestScore: remote.value.data.bestScore,
        totalRuns: remote.value.data.totalRuns,
        updatedAt: remote.value.updatedAt,
      };
      if (CloudSystem.isRemoteAhead(local, summary)) {
        SaveSystem.adoptRemote(remote.value.data, local.cloudId ?? AuthSystem.currentUserId()!);
      }
    }

    await ProgressSyncSystem.flush();
    this.busy = false;
    this.scene.restart();
  }

  private async signOutAccount(): Promise<void> {
    if (this.busy) return;
    if (!navigator.onLine) {
      this.accountStatus
        .setText('Offline-Abmeldung nicht möglich. Bitte stelle eine Internetverbindung her.')
        .setColor(Palette.gold);
      return;
    }
    this.busy = true;
    this.accountStatus
      .setText('Ausstehende Änderungen werden gesichert ...')
      .setColor(Palette.inkDim);
    await ProgressSyncSystem.flush();
    if (ProgressSyncSystem.hasPendingData()) {
      this.busy = false;
      this.accountStatus
        .setText('Abmelden erst möglich, wenn der Profilstand abgeglichen wurde.')
        .setColor(Palette.gold);
      return;
    }

    const result = await AuthSystem.signOut();
    if (!result.ok) {
      this.busy = false;
      this.accountStatus.setText(result.error).setColor(Palette.gold);
      return;
    }
    SaveSystem.clearLocalProfile();
    this.busy = false;
    this.scene.start(SceneKey.Menu);
  }
}
