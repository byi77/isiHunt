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
import { GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as AuthSystem from '@/systems/AuthSystem';
import * as DebugSystem from '@/systems/DebugSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SyncStatusSystem from '@/systems/SyncStatusSystem';
import { clearPendingRewardRedemption, prepareRewardRedemption } from '@/systems/RewardCodeSystem';
import { shipHullTint } from '@/config/shop';
import { formatPlayTime } from '@/ui/format';
import { playerTextureForShape, shipDisplayScale, TextureKey } from '@/ui/textures';
import { InterfaceStyle, Palette, textStyle, toCss, uiUnit, uiFont } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createBar,
  createButton,
  createMenuLayout,
  createPanel,
  createSceneBackdrop,
  PAGE_CONTENT_TOP,
} from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

/**
 * Abstand der Schiffsmitte ueber der Kartenmitte. Der Ring (PlayerHalo,
 * Radius ~66 bei Faktor 1,15) reichte bei 210 bis in die ZULETZT-Zeile.
 */
const PROFILE_SHIP_OFFSET = 170;

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

    createSceneBackdrop(this, world);
    const u = uiUnit(this);
    const cardWidth = GAME_WIDTH - InterfaceStyle.spacing * 2 * u;
    const innerWidth = cardWidth - InterfaceStyle.padding * 2 * u;
    const layout = createMenuLayout(InterfaceStyle.spacing * u);
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
    const profileY = sections.next(456 * u);
    const statisticsY = statsVisible ? sections.next(292 * u) : 0;
    const collectionY = statsVisible ? sections.next(44 * u) : 0;
    const accountY = !firstStart ? sections.next(280 * u) : 0;

    addContent(
      createPanel(this, GAME_WIDTH / 2, profileY, cardWidth, 456 * u, world.accent, {
        alpha: 0.62,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .image(GAME_WIDTH / 2, profileY - PROFILE_SHIP_OFFSET * u, TextureKey.PlayerHalo)
        .setTint(world.accent)
        .setScale(0.65 * u)
        .setAlpha(0.8),
    );

    addContent(
      this.add
        .image(
          GAME_WIDTH / 2,
          profileY - PROFILE_SHIP_OFFSET * u,
          playerTextureForShape(save.shipShape),
        )
        .setTint(shipHullTint(save))
        .setScale(0.45 * u * shipDisplayScale(playerTextureForShape(save.shipShape))),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 126 * u,
          `ZULETZT: ${world.name}`,
          textStyle(uiFont(this, 'tiny'), Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 8 * u,
          'DEIN NAME',
          textStyle(uiFont(this, 'tiny'), Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(1),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY + 18 * u,
          'Buchstaben und Zahlen · max. 4 Zahlen',
          textStyle(uiFont(this, 'tiny'), Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 104 * u,
          `LEVEL ${levelProgress.level}`,
          textStyle(uiFont(this, 'heading'), Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0.5)
        .setLetterSpacing(2),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 80 * u,
          `BESTWERT ${save.bestScore.toLocaleString('de-DE')}`,
          textStyle(uiFont(this, 'small'), Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5, 0.5),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY - 56 * u,
          `COINS ${save.coins.toLocaleString('de-DE')}`,
          textStyle(uiFont(this, 'small'), Palette.ink),
        )
        .setOrigin(0.5, 0.5),
    );

    if (!firstStart) {
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            profileY - 32 * u,
            SyncStatusSystem.dataSyncStatusLabel(),
            textStyle(uiFont(this, 'tiny'), Palette.inkDim, { fontStyle: 'bold' }),
          )
          .setOrigin(0.5, 0.5)
          .setLetterSpacing(1),
      );
    }

    let saveButton: ButtonHandle | null = null;
    const status = this.add
      .text(GAME_WIDTH / 2, profileY + 152 * u, '', textStyle(uiFont(this, 'tiny'), Palette.inkDim))
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
        status.setText('Bitte gib einen Namen ein.').setColor(Palette.danger);
        return;
      }

      const currentPlayerId = AuthSystem.currentUserId() ?? SaveSystem.load().cloudId;
      const canWriteOnline =
        CloudSystem.isAvailable() && navigator.onLine && !SaveSystem.isTestProfileActive();
      if (canWriteOnline) {
        saving = true;
        saveButton?.setEnabled(false);
        const availability = await CloudSystem.isPlayerNameAvailable(name, currentPlayerId);
        // Waehrend des Netzaufrufs bleibt der Zurueck-Knopf bedienbar. Auf
        // einer verlassenen Scene liefe `setText` auf ein Text-Objekt, dessen
        // Canvas bereits an den Pool zurueckging (Audit 2026-08-23).
        if (!this.scene.isActive()) return;
        if (!availability.ok) {
          saving = false;
          saveButton?.setEnabled(true);
          status.setText(availability.error).setColor(Palette.gold);
          return;
        }
        if (!availability.value) {
          saving = false;
          saveButton?.setEnabled(true);
          status.setText('Dieser Spielername ist bereits vergeben.').setColor(Palette.danger);
          return;
        }
        if (AuthSystem.isSignedIn()) {
          const result = await CloudSystem.updateProfileIdentity(name);
          if (!this.scene.isActive()) return;
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
          if (!this.scene.isActive()) return;
          if (!result.ok) {
            saving = false;
            saveButton?.setEnabled(true);
            status.setText(result.error).setColor(Palette.gold);
            return;
          }
          await CloudSystem.syncSaveSafely();
        }
      }

      // Erst nach erfolgreicher Online-Pruefung/Serveraenderung lokal
      // uebernehmen. So bleibt ein Name bei einem Konflikt unveraendert.
      // Offline darf der Spieler den sichtbaren Namen trotzdem sofort nutzen;
      // der Menue-Sync versucht die Identitaet spaeter erneut zu vereinheitlichen.
      if (!canWriteOnline && CloudSystem.isAvailable() && !navigator.onLine) {
        // Der Name wird auch dann uebernommen, wenn die Scene inzwischen weg
        // ist - er ist bezahlt durch die Eingabe des Spielers. Nur die
        // Rueckmeldung braucht eine lebende Oberflaeche.
        SaveSystem.setOfflinePlayerName(name);
        if (!this.scene.isActive()) return;
        status
          .setText('Offline gespeichert. Beim naechsten Online-Abgleich wird der Name geprueft.')
          .setColor(Palette.gold);
        saving = false;
        saveButton?.setEnabled(true);
        return;
      }
      SaveSystem.setPlayerName(name);
      if (!this.scene.isActive()) return;
      this.scene.start(SceneKey.Menu);
    };

    const input = createTextInput(this, GAME_WIDTH / 2, profileY + 64 * u, {
      placeholder: 'Name eingeben',
      maxLength: PLAYER_NAME_MAX_LENGTH,
      width: innerWidth,
      accent: world.accent,
      onSubmit: saveProfile,
    });
    addContent(input.element);

    input.setValue(CloudSystem.sanitizePlayerName(save.playerName));

    // DIAGNOSE (befristet): Der Bericht "erstes 'a' laesst sich nicht
    // eingeben" ueberlebte bereits einen Fixversuch. Bevor erneut geraten
    // wird, protokolliert dieser Block jede Eingabe mitsamt dem Zustand, der
    // die Ursache entscheiden kann: Laeuft gerade eine Composition (IME bzw.
    // Autokorrektur der Handytastatur)? Weicht der bereinigte Wert ab, sodass
    // eine Zuweisung an `value` erfolgt? Genau diese Kombination steht im
    // Verdacht, den Composition-Puffer zu verwerfen.
    //
    // Nach der Messung auf dem Geraet faellt dieser Block ersatzlos weg.
    let composing = false;
    input.element.node.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.element.node.addEventListener('compositionend', () => {
      composing = false;
    });

    input.element.node.addEventListener('input', (event) => {
      const inputElement = input.element.node as HTMLInputElement;
      const rawValue = input.getValue();
      const cursor = inputElement.selectionStart ?? rawValue.length;
      const cleanedValue = CloudSystem.sanitizePlayerName(rawValue);

      DebugSystem.pushProtectedLogEntry({
        timestamp: Date.now(),
        kind: 'event',
        label: 'name:input',
        detail: JSON.stringify({
          raw: rawValue,
          cleaned: cleanedValue,
          weichtAb: cleanedValue !== rawValue,
          composing,
          inputType: (event as InputEvent).inputType ?? null,
          data: (event as InputEvent).data ?? null,
          cursor,
        }),
      });

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
      // Direkt unter dem Feld, zu dem er gehoert - nicht unter dem XP-Balken.
      profileY + 118 * u,
      firstStart ? "Los geht's" : 'Speichern',
      saveProfile,
      { width: innerWidth, height: 44 * u, accent: world.accent, fontSize: uiFont(this, 'button') },
    );
    addContent(saveButton.container);
    updateButton();

    if (firstStart) {
      status
        .setText('Lokales Offline-Profil erstellt. Du kannst es später online verbinden.')
        .setColor(toCss(world.accent));
    } else if (save.pendingPlayerName) {
      status
        .setText('Offline-Name wartet auf den naechsten Online-Abgleich.')
        .setColor(Palette.gold);
    }

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          profileY + 184 * u,
          levelProgress.xpNeeded === 0
            ? `Level ${levelProgress.level}  ·  MAX LEVEL`
            : `Level ${levelProgress.level}  ·  ${levelProgress.xpInLevel} / ${levelProgress.xpNeeded} XP`,
          textStyle(uiFont(this, 'tiny'), Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    // Der XP-Stand war nur eine blasse Textzeile ueber einer leeren Flaeche.
    // Derselbe Balken wie im Ergebnis macht ihn zum eigenen Block.
    const xpBarWidth = innerWidth;
    const xpBar = createBar(
      this,
      GAME_WIDTH / 2 - xpBarWidth / 2,
      profileY + 204 * u,
      xpBarWidth,
      6 * u,
      world.accent,
    );
    xpBar.setRatio(levelProgress.xpNeeded === 0 ? 1 : levelProgress.ratio);
    addContent(xpBar.container);

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
        createPanel(this, GAME_WIDTH / 2, statisticsY, cardWidth, 292 * u, world.accent, {
          alpha: 0.52,
          radius: 18,
        }),
      );
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            statisticsY - 130 * u,
            'STATISTIKEN',
            textStyle(uiFont(this, 'heading'), Palette.ink),
          )
          .setOrigin(0.5)
          .setLetterSpacing(1),
      );

      statistics.forEach(([label, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x =
          (InterfaceStyle.spacing + InterfaceStyle.padding) * u +
          (column * (innerWidth + InterfaceStyle.padding * u)) / 2;
        const y = statisticsY - 94 * u + row * 58 * u;
        addContent(
          this.add
            .text(
              x,
              y,
              label,
              textStyle(uiFont(this, 'tiny'), Palette.inkDim, { fontStyle: 'bold' }),
            )
            .setOrigin(0, 0.5),
        );
        addContent(
          this.add
            .text(
              x,
              y + 30 * u,
              value,
              textStyle(uiFont(this, 'small'), Palette.ink, { fontStyle: 'bold' }),
            )
            .setOrigin(0, 0.5),
        );
      });
    }

    if (statsVisible) {
      addContent(
        createButton(
          this,
          GAME_WIDTH / 2,
          collectionY,
          'Sammlung ansehen',
          () => this.scene.start(SceneKey.Collection),
          {
            width: cardWidth,
            height: 44 * u,
            accent: world.accent,
            fontSize: uiFont(this, 'small'),
          },
        ).container,
      );
    }

    if (!firstStart) this.buildAccountSection(world.accent, accountY, addContent);
    const contentBottom = (!firstStart ? accountY + 140 * u : profileY + 228 * u) + 16 * u;
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
    const u = uiUnit(this);
    const cardWidth = GAME_WIDTH - InterfaceStyle.spacing * 2 * u;
    const innerWidth = cardWidth - InterfaceStyle.padding * 2 * u;
    addContent(
      createPanel(this, GAME_WIDTH / 2, accountY, cardWidth, 280 * u, accent, {
        alpha: 0.58,
        radius: 20,
      }),
    );

    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          accountY - 116 * u,
          'PROFIL & GERÄTE',
          textStyle(uiFont(this, 'heading'), Palette.ink),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );

    this.accountStatus = this.add
      .text(GAME_WIDTH / 2, accountY + 100 * u, '', textStyle(uiFont(this, 'tiny'), Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');
    addContent(this.accountStatus);

    if (AuthSystem.isSignedIn()) {
      const alias = AuthSystem.currentAlias() ?? 'angemeldetes Profil';
      addContent(
        this.add
          .text(
            GAME_WIDTH / 2,
            accountY - 76 * u,
            alias,
            textStyle(uiFont(this, 'small'), Palette.ink),
          )
          .setOrigin(0.5),
      );

      const sync = createButton(
        this,
        GAME_WIDTH / 2,
        accountY - 22 * u,
        'Profil abgleichen',
        () => void this.syncAccount(),
        { width: innerWidth, height: 44 * u, accent, fontSize: uiFont(this, 'small') },
      );
      addContent(sync.container);
      const signOut = createButton(
        this,
        GAME_WIDTH / 2,
        accountY + 36 * u,
        'Abmelden',
        () => void this.signOutAccount(),
        { width: innerWidth, height: 44 * u, accent: 0x9aa3bd, fontSize: uiFont(this, 'tiny') },
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
            accountY - 54 * u,
            'Melde dich auf iPhone und iPad mit demselben Profil an.\nDein Fortschritt wird sicher in deinem Online-Profil gespeichert.',
            textStyle(uiFont(this, 'small'), Palette.ink),
          )
          .setOrigin(0.5)
          .setAlign('center')
          .setWordWrapWidth(innerWidth),
      );

      const accountButton = createButton(
        this,
        GAME_WIDTH / 2,
        accountY + 44 * u,
        'Anmelden / Profil anlegen',
        () => this.scene.start(SceneKey.Account),
        { width: innerWidth, height: 44 * u, accent, fontSize: uiFont(this, 'small') },
      );
      addContent(accountButton.container);

      if (!AuthSystem.isConfigured()) {
        accountButton.setEnabled(false);
        this.accountStatus.setText('Das Online-Profil ist gerade nicht verfügbar.');
      }
    }
  }

  /** Spieleroberflaeche fuer den ausschliesslich serverseitig eingeloesten Code. */
  buildRewardCodeSection(
    accent: number,
    y: number,
    addContent: (object: Phaser.GameObjects.GameObject) => void,
  ): void {
    addContent(
      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 310, accent, {
        alpha: 0.58,
        radius: 20,
      }),
    );
    addContent(
      this.add
        .text(
          GAME_WIDTH / 2,
          y - 125,
          'BELOHNUNGSCODE',
          textStyle(uiFont(this, 'body'), Palette.ink),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );
    const status = this.add
      .text(GAME_WIDTH / 2, y + 125, '', textStyle(uiFont(this, 'tiny'), Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');
    addContent(status);

    const input = createTextInput(this, GAME_WIDTH / 2, y - 55, {
      placeholder: '1234-5678-9012',
      maxLength: 14,
      width: 420,
      accent,
      numericKeyboard: true,
    });
    addContent(input.element);
    input.element.node.addEventListener('input', () => {
      const element = input.element.node as HTMLInputElement;
      const cursor = element.selectionStart ?? element.value.length;
      const digitsBeforeCursor = element.value.slice(0, cursor).replace(/\D/g, '').length;
      const digits = element.value.replace(/\D/g, '').slice(0, 12);
      const display = digits.replace(/(\d{4})(?=\d)/g, '$1-');
      if (element.value !== display) {
        element.value = display;
        const nextCursor = digitsBeforeCursor + Math.floor(Math.max(0, digitsBeforeCursor - 1) / 4);
        element.setSelectionRange(nextCursor, nextCursor);
      }
    });

    const controls: { redeemButton: ButtonHandle | null } = { redeemButton: null };
    const redeem = async (): Promise<void> => {
      if (this.busy) return;
      const profileId = AuthSystem.currentUserId();
      const pending = profileId ? prepareRewardRedemption(profileId, input.getValue()) : null;
      if (!pending) {
        status.setText('Bitte gib einen zwölfstelligen Code ein.').setColor(Palette.danger);
        return;
      }
      this.busy = true;
      controls.redeemButton?.setEnabled(false);
      status.setText('Profilstand wird geprüft …').setColor(Palette.inkDim);
      await ProgressSyncSystem.flush();
      if (!this.scene.isActive()) return;
      if (ProgressSyncSystem.hasPendingData()) {
        this.busy = false;
        controls.redeemButton?.setEnabled(true);
        status
          .setText('Bitte warte, bis ausstehende Runs synchronisiert sind.')
          .setColor(Palette.gold);
        return;
      }
      const result = await CloudSystem.redeemRewardCode(pending);
      if (!this.scene.isActive()) return;
      this.busy = false;
      controls.redeemButton?.setEnabled(true);
      if (!result.ok) {
        status.setText(result.error).setColor(Palette.gold);
        return;
      }
      clearPendingRewardRedemption(profileId!, pending.requestId);
      const profile = await CloudSystem.fetchProfileProgress();
      if (!this.scene.isActive()) return;
      if (profile.ok && profile.value) SaveSystem.adoptProfileProgress(profile.value.data);
      input.setValue('');
      status
        .setText(`Erhalten: ${result.value.grants.map((grant) => grant.type).join(', ')}.`)
        .setColor(toCss(accent));
    };
    const redeemButton: ButtonHandle = createButton(
      this,
      GAME_WIDTH / 2,
      y + 35,
      'Code einlösen',
      () => void redeem(),
      {
        width: 420,
        height: 58,
        accent,
        fontSize: uiFont(this, 'small'),
      },
    );
    controls.redeemButton = redeemButton;
    addContent(redeemButton.container);
  }

  private async syncAccount(): Promise<void> {
    if (this.busy) return;
    if (!navigator.onLine) {
      this.accountStatus.setText('Zum Abgleichen brauchst du Internet.').setColor(Palette.danger);
      return;
    }
    this.busy = true;
    this.accountStatus.setText('Gemeinsames Profil wird geladen ...').setColor(Palette.inkDim);

    const local = SaveSystem.load();
    let remote = await CloudSystem.fetchProfileProgress();
    if (!this.scene.isActive()) return;
    if (!remote.ok) {
      this.busy = false;
      this.accountStatus.setText(remote.error).setColor(Palette.gold);
      return;
    }

    if (local.cloudId) {
      remote = await CloudSystem.claimCloudProfile(local.cloudId);
      if (!this.scene.isActive()) return;
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
        SaveSystem.adoptRemote(
          remote.value.data,
          local.cloudId ?? AuthSystem.currentUserId()!,
          false,
          undefined,
          remote.value.updatedAt,
        );
      }
    }

    await ProgressSyncSystem.flush();
    this.busy = false;
    // Die Uebernahme oben ist bereits geschrieben; nur der Neustart der
    // Ansicht setzt eine lebende Scene voraus.
    if (!this.scene.isActive()) return;
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
    if (!this.scene.isActive()) return;
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
      if (!this.scene.isActive()) return;
      this.accountStatus.setText(result.error).setColor(Palette.gold);
      return;
    }
    // Die Abmeldung ist serverseitig bereits passiert - der lokale Stand muss
    // ihr folgen, auch wenn der Bildschirm inzwischen gewechselt hat. Sonst
    // wirkt das Profil weiter wie angemeldet.
    SaveSystem.clearLocalProfile();
    this.busy = false;
    if (!this.scene.isActive()) return;
    // Zur Anmeldung, nicht ins Menue: Seit ADR-0026 wird nur angemeldet
    // gespielt, und das gilt nicht nur fuer den App-Start. Der Weg ins Menue
    // liess hier genau den Zustand entstehen, den die Sperre ausschliessen
    // soll - abgemeldet, Anzeige "GAST", Spielen trotzdem moeglich (gemeldet
    // 2026-09-19).
    this.scene.start(SceneKey.Account, { firstStart: true });
  }
}
