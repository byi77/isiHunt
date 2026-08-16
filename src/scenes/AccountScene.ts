/** Login und gemeinsamer Profilstand für mehrere Geräte. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import type { TextInputHandle } from '@/ui/textInput';
import { createTextInput } from '@/ui/textInput';
import {
  createBackButton,
  createBackStatusText,
  createButton,
  createDriftLayers,
  createMenuLayout,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

export interface AccountSceneData {
  firstStart?: boolean;
}

export class AccountScene extends Phaser.Scene {
  private busy = false;
  private firstStart = false;
  private statusText!: Phaser.GameObjects.Text;
  private aliasInput: TextInputHandle | null = null;
  private pinInput: TextInputHandle | null = null;
  private pinConfirmInput: TextInputHandle | null = null;
  private activeAlias = '';
  private actionObjects: Phaser.GameObjects.GameObject[] = [];
  private contentOffset = 0;

  constructor() {
    super(SceneKey.Account);
  }

  create(data: AccountSceneData = {}): void {
    this.firstStart = data.firstStart ?? false;
    // Der eigene Begrüßungsbereich ersetzt beim Erststart die schmale
    // Safe-Area-Überschrift, damit keine zweite Überschrift über dem Logo steht.
    if (this.firstStart) SafeAreaSystem.hide();
    else SafeAreaSystem.showStatic('PROFIL VERBINDEN');
    const world = getWorld(SaveSystem.load().lastWorldId);

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
    if (!this.firstStart) createBackButton(this, () => this.scene.start(SceneKey.Settings));
    if (this.firstStart) this.buildFirstStartWelcome(world.accent);

    const layout = createMenuLayout();
    // Der Erststart ist kein normales Untermenü: Logo und Begrüßung erhalten
    // einen eigenen Kopfbereich, die Karte selbst bleibt im zentralen Stapel.
    if (this.firstStart) layout.sections.advance(260);
    const loginY = layout.sections.next(660);
    this.contentOffset = loginY - 540;
    createPanel(this, GAME_WIDTH / 2, loginY, GAME_WIDTH - 120, 660, world.accent, {
      alpha: 0.62,
      radius: 22,
    });

    if (this.firstStart) {
      const feedbackY = GAME_HEIGHT - 205;
      createPanel(this, GAME_WIDTH / 2, feedbackY, GAME_WIDTH - 160, 86, world.accent, {
        alpha: 0.72,
        radius: 16,
      });
      this.statusText = this.add
        .text(GAME_WIDTH / 2, feedbackY, '', textStyle(FontSize.small, Palette.ink))
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 190)
        .setAlign('center');
    } else {
      this.statusText = createBackStatusText(this);
    }

    const signedInBeforeRefresh = AuthSystem.isSignedIn();
    this.buildCurrentState(world.accent);
    void AuthSystem.refresh().then((result) => {
      if (!this.scene.isActive()) return;
      const signedInAfterRefresh = result.ok && result.value !== null;
      if (signedInAfterRefresh !== signedInBeforeRefresh) {
        this.scene.restart({ firstStart: this.firstStart });
      }
    });
    this.events.once('shutdown', () => {
      this.aliasInput?.destroy();
      this.pinInput?.destroy();
      this.pinConfirmInput?.destroy();
    });
  }

  /** Sichtbarer Einstieg in die App, bevor ein Profil angelegt wird. */
  private buildFirstStartWelcome(accent: number): void {
    this.add
      .image(GAME_WIDTH / 2, 126, TextureKey.Glow)
      .setDisplaySize(440, 230)
      .setTint(accent)
      .setAlpha(0.34)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(GAME_WIDTH / 2, 126, TextureKey.Logo).setDisplaySize(290, 164);
    this.add
      .text(
        GAME_WIDTH / 2,
        236,
        'Willkommen bei isiHunt!\nLege dein Profil an und dein Fortschritt bleibt erhalten.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(GAME_WIDTH - 110);
  }

  private buildCurrentState(accent: number): void {
    this.clearActions();

    if (AuthSystem.isSignedIn()) {
      this.buildSignedIn(accent);
    } else {
      this.buildLogin(accent);
    }
  }

  private buildLogin(accent: number): void {
    // Die Safe-Area bzw. beim Erststart die Begrüßung ist bereits der
    // Seitenkopf. Felder beginnen deshalb direkt im Karteninhalt statt mit
    // einer zweiten Überschrift und einem zusätzlichen Leerraum.
    this.aliasInput = createTextInput(this, GAME_WIDTH / 2, this.contentY(320), {
      placeholder: 'Alias',
      inputType: 'text',
      maxLength: AuthSystem.ALIAS_MAX_LENGTH,
      width: 480,
      accent,
      onSubmit: () => void this.signIn(),
    });
    this.pinInput = createTextInput(this, GAME_WIDTH / 2, this.contentY(420), {
      placeholder: this.firstStart ? '6-stelliger PIN' : 'PIN oder bisheriger Zugang',
      inputType: 'password',
      width: 480,
      accent,
      maxLength: this.firstStart ? AuthSystem.PIN_LENGTH : undefined,
      numericKeyboard: this.firstStart,
      onSubmit: () => void this.signIn(),
    });
    this.pinConfirmInput = createTextInput(this, GAME_WIDTH / 2, this.contentY(510), {
      placeholder: 'PIN wiederholen',
      inputType: 'password',
      maxLength: AuthSystem.PIN_LENGTH,
      numeric: true,
      width: 480,
      accent,
      onSubmit: () => void this.signUp(),
    });

    const signIn = createButton(
      this,
      GAME_WIDTH / 2,
      this.contentY(620),
      this.firstStart ? 'VORHANDENES PROFIL' : 'ANMELDEN',
      () => void this.signIn(),
      {
        width: 440,
        height: 76,
        accent,
        fontSize: FontSize.body,
      },
    );
    const signUp = createButton(
      this,
      GAME_WIDTH / 2,
      this.contentY(700),
      this.firstStart ? 'PROFIL JETZT ANLEGEN' : 'NEUES PROFIL ANLEGEN',
      () => void this.signUp(),
      { width: 440, height: 70, accent: 0x9aa3bd, fontSize: FontSize.small },
    );

    this.actionObjects = [signIn.container, signUp.container];
    this.statusText.setText(
      this.firstStart
        ? 'Für dein erstes Profil ist eine Internetverbindung erforderlich.'
        : 'Ohne Login kannst du mit einem lokalen Profil offline spielen.',
    );
  }

  private buildSignedIn(accent: number): void {
    const alias = AuthSystem.currentAlias() ?? 'angemeldetes Profil';
    this.add
      .text(GAME_WIDTH / 2, this.contentY(300), alias, textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5);

    const sync = createButton(
      this,
      GAME_WIDTH / 2,
      this.contentY(470),
      'PROFIL ABGLEICHEN',
      () => void this.syncProfile(),
      { width: 440, height: 78, accent, fontSize: FontSize.body },
    );
    const signOut = createButton(
      this,
      GAME_WIDTH / 2,
      this.contentY(585),
      'ABMELDEN',
      () => void this.signOut(),
      {
        width: 360,
        height: 68,
        accent: 0x9aa3bd,
        fontSize: FontSize.small,
      },
    );

    this.actionObjects = [sync.container, signOut.container];
    this.statusText.setText(
      `${ProgressSyncSystem.pendingCount()} ausstehende Änderung${ProgressSyncSystem.pendingCount() === 1 ? '' : 'en'}.`,
    );
  }

  private async signIn(): Promise<void> {
    if (this.busy || !this.aliasInput || !this.pinInput) return;
    if (!this.ensureFirstStartOnline()) return;
    const alias = AuthSystem.normalizeAlias(this.aliasInput.getValue());
    const pinOrLegacyPassword = this.pinInput.getValue();
    if (!AuthSystem.isValidAlias(alias) || !pinOrLegacyPassword) {
      this.setStatus(
        `Alias: ${AuthSystem.ALIAS_MIN_LENGTH}-${AuthSystem.ALIAS_MAX_LENGTH} Zeichen, nur a-z, 0-9, - und _`,
        Palette.gold,
      );
      return;
    }

    this.activeAlias = alias;
    this.busy = true;
    this.setStatus('Anmeldung wird geprüft ...', Palette.inkDim);
    const result = await AuthSystem.signIn(alias, pinOrLegacyPassword);
    if (!result.ok) {
      this.busy = false;
      this.setStatus(result.error, Palette.gold);
      return;
    }

    await this.syncProfile();
  }

  private async signUp(): Promise<void> {
    if (this.busy || !this.aliasInput || !this.pinInput || !this.pinConfirmInput) return;
    if (!this.ensureFirstStartOnline()) return;
    const alias = AuthSystem.normalizeAlias(this.aliasInput.getValue());
    const pin = this.pinInput.getValue();
    const pinConfirmation = this.pinConfirmInput.getValue();
    if (!AuthSystem.isValidAlias(alias) || !AuthSystem.isValidPin(pin) || pin !== pinConfirmation) {
      this.setStatus(
        `Bitte Alias, einen ${AuthSystem.PIN_LENGTH}-stelligen PIN und die Wiederholung korrekt eingeben.`,
        Palette.gold,
      );
      return;
    }

    this.activeAlias = alias;
    this.busy = true;
    this.setStatus('Profil wird angelegt ...', Palette.inkDim);
    const result = await AuthSystem.signUp(alias, pin);
    if (!result.ok) {
      this.busy = false;
      this.setStatus(result.error, Palette.gold);
      return;
    }
    if (!result.value) {
      this.busy = false;
      this.setStatus(
        'Profil angelegt, aber noch nicht freigeschaltet. Bitte „Confirm email“ in Supabase ausschalten und das Profil danach neu anlegen.',
        Palette.success,
      );
      return;
    }

    await this.syncProfile();
  }

  /** Der Erststart hat keinen Offline-Fallback: das Profil muss in die Cloud. */
  private ensureFirstStartOnline(): boolean {
    if (!this.firstStart || navigator.onLine) return true;
    this.setStatus(
      'Bitte stelle für die erste Anmeldung eine Internetverbindung her.',
      Palette.gold,
    );
    return false;
  }

  private async syncProfile(): Promise<void> {
    const local = SaveSystem.load();
    const alias = this.activeAlias || AuthSystem.currentAlias();
    // Beim Erststart wird der Alias nur als Datenbasis für den Server genutzt.
    // Der lokale Speicher bleibt leer, bis der gemeinsame Profilstand wirklich
    // angelegt bzw. geladen wurde.
    const profileSeed =
      this.firstStart && !local.playerName && alias ? { ...local, playerName: alias } : local;
    this.setStatus('Gemeinsames Profil wird geladen ...', Palette.inkDim);

    let remote = await CloudSystem.fetchProfileProgress();
    if (!remote.ok) {
      this.busy = false;
      this.setStatus(remote.error, Palette.gold);
      return;
    }

    if (local.cloudId) {
      // Immer pruefen: Auch ein bereits angelegtes Login-Profil kann noch
      // einen alten anonymen Ranglisteneintrag besitzen. Der Claim-RPC fuehrt
      // diesen Eintrag zusammen, ohne den vorhandenen Profilstand zu ersetzen.
      remote = await CloudSystem.claimCloudProfile(local.cloudId);
      if (!remote.ok) {
        this.busy = false;
        this.setStatus(remote.error, Palette.gold);
        return;
      }
    }

    if (!remote.value) {
      remote = await CloudSystem.initializeProfileProgress(profileSeed);
      if (!remote.ok) {
        this.busy = false;
        this.setStatus(remote.error, Palette.gold);
        return;
      }
    }

    if (alias) {
      const aliasResult = await CloudSystem.updateProfileAlias(alias);
      if (!aliasResult.ok) {
        this.busy = false;
        this.setStatus(aliasResult.error, Palette.gold);
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
      if (this.firstStart || CloudSystem.isRemoteAhead(local, summary)) {
        SaveSystem.adoptRemote(remote.value.data, local.cloudId ?? AuthSystem.currentUserId()!);
      }
    }

    await ProgressSyncSystem.flush();
    this.busy = false;
    this.scene.restart();
  }

  private async signOut(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = await AuthSystem.signOut();
    this.busy = false;
    if (!result.ok) {
      this.setStatus(result.error, Palette.gold);
      return;
    }
    this.scene.restart();
  }

  private setStatus(text: string, color: string): void {
    this.statusText.setText(text).setColor(color);
  }

  private contentY(y: number): number {
    return y + this.contentOffset;
  }

  private clearActions(): void {
    for (const object of this.actionObjects) object.destroy();
    this.actionObjects = [];
    this.aliasInput?.destroy();
    this.pinInput?.destroy();
    this.pinConfirmInput?.destroy();
    this.aliasInput = null;
    this.pinInput = null;
    this.pinConfirmInput = null;
  }
}
