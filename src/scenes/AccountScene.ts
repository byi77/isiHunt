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
import { FontSize, Palette, textStyle } from '@/ui/theme';
import type { TextInputHandle } from '@/ui/textInput';
import { createTextInput } from '@/ui/textInput';
import {
  createBackButton,
  createButton,
  createDriftLayers,
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

  constructor() {
    super(SceneKey.Account);
  }

  create(data: AccountSceneData = {}): void {
    this.firstStart = data.firstStart ?? false;
    SafeAreaSystem.showStatic('PROFIL LOGIN');
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

    this.add
      .text(
        GAME_WIDTH / 2,
        130,
        this.firstStart ? 'PROFIL ANLEGEN' : 'PROFIL VERBINDEN',
        textStyle(FontSize.heading, Palette.gold),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.add
      .text(
        GAME_WIDTH / 2,
        184,
        this.firstStart
          ? 'Alias und PIN sichern deinen Fortschritt auf mehreren Geräten'
          : 'Auf iPhone und iPad denselben Fortschritt nutzen',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    createPanel(this, GAME_WIDTH / 2, 540, GAME_WIDTH - 120, 660, world.accent, {
      alpha: 0.62,
      radius: 22,
    });

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

  private buildCurrentState(accent: number): void {
    this.clearActions();

    if (AuthSystem.isSignedIn()) {
      this.buildSignedIn(accent);
    } else {
      this.buildLogin(accent);
    }
  }

  private buildLogin(accent: number): void {
    this.add
      .text(
        GAME_WIDTH / 2,
        270,
        this.firstStart ? 'ALIAS UND 6-STELLIGER PIN' : 'ALIAS UND PIN',
        textStyle(FontSize.body, Palette.gold),
      )
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.aliasInput = createTextInput(this, GAME_WIDTH / 2, 390, {
      placeholder: 'Alias',
      inputType: 'text',
      maxLength: AuthSystem.ALIAS_MAX_LENGTH,
      width: 480,
      accent,
      onSubmit: () => void this.signIn(),
    });
    this.pinInput = createTextInput(this, GAME_WIDTH / 2, 490, {
      placeholder: this.firstStart ? '6-stelliger PIN' : 'PIN oder bisheriger Zugang',
      inputType: 'password',
      width: 480,
      accent,
      maxLength: this.firstStart ? AuthSystem.PIN_LENGTH : undefined,
      numericKeyboard: this.firstStart,
      onSubmit: () => void this.signIn(),
    });
    this.pinConfirmInput = createTextInput(this, GAME_WIDTH / 2, 580, {
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
      690,
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
      770,
      this.firstStart ? 'PROFIL JETZT ANLEGEN' : 'NEUES PROFIL ANLEGEN',
      () => void this.signUp(),
      { width: 440, height: 70, accent: 0x9aa3bd, fontSize: FontSize.small },
    );

    this.actionObjects = [signIn.container, signUp.container];
    if (this.firstStart) {
      const offline = createButton(
        this,
        GAME_WIDTH / 2,
        840,
        'OFFLINE-PROFIL ERSTELLEN',
        () => this.createOfflineProfile(),
        { width: 440, height: 62, accent: 0x778099, fontSize: FontSize.tiny },
      );
      this.actionObjects.push(offline.container);
    }
    this.statusText.setText(
      this.firstStart
        ? 'Online: gemeinsames Profil. Offline: lokales Profil, später verbindbar.'
        : 'Ohne Login kannst du mit einem lokalen Profil offline spielen.',
    );
  }

  private buildSignedIn(accent: number): void {
    const alias = AuthSystem.currentAlias() ?? 'angemeldetes Profil';
    if (this.firstStart && !SaveSystem.load().playerName) SaveSystem.setPlayerName(alias);
    this.add
      .text(GAME_WIDTH / 2, 290, 'ANGEMELDET', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.add
      .text(GAME_WIDTH / 2, 350, alias, textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5);

    const sync = createButton(
      this,
      GAME_WIDTH / 2,
      520,
      'PROFIL ABGLEICHEN',
      () => void this.syncProfile(),
      { width: 440, height: 78, accent, fontSize: FontSize.body },
    );
    const signOut = createButton(this, GAME_WIDTH / 2, 635, 'ABMELDEN', () => void this.signOut(), {
      width: 360,
      height: 68,
      accent: 0x9aa3bd,
      fontSize: FontSize.small,
    });

    this.actionObjects = [sync.container, signOut.container];
    this.statusText.setText(
      `${ProgressSyncSystem.pendingCount()} ausstehende Änderung${ProgressSyncSystem.pendingCount() === 1 ? '' : 'en'}.`,
    );
  }

  private async signIn(): Promise<void> {
    if (this.busy || !this.aliasInput || !this.pinInput) return;
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
    if (this.firstStart && !SaveSystem.load().playerName) SaveSystem.setPlayerName(alias);
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
    // Der Alias wird zugleich zum Anzeigenamen des neuen lokalen Profils.
    // So kann der Fortschritt auch dann weitergespielt werden, wenn der
    // anschließende Cloud-Abgleich wegen eines Netzfehlers ausfällt.
    if (this.firstStart) SaveSystem.setPlayerName(alias);
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

  /** Legt beim Erststart bewusst nur ein lokales Profil an. */
  private createOfflineProfile(): void {
    if (!this.firstStart || !this.aliasInput) return;
    const alias = AuthSystem.normalizeAlias(this.aliasInput.getValue());
    if (!AuthSystem.isValidAlias(alias)) {
      this.setStatus(
        `Alias: ${AuthSystem.ALIAS_MIN_LENGTH}-${AuthSystem.ALIAS_MAX_LENGTH} Zeichen, nur a-z, 0-9, - und _`,
        Palette.gold,
      );
      return;
    }

    SaveSystem.setPlayerName(alias);
    this.scene.start(SceneKey.Menu);
  }

  private async syncProfile(): Promise<void> {
    const local = SaveSystem.load();
    this.setStatus('Gemeinsames Profil wird geladen ...', Palette.inkDim);

    let remote = await CloudSystem.fetchProfileProgress();
    if (!remote.ok) {
      this.busy = false;
      this.setStatus(remote.error, Palette.gold);
      return;
    }

    if (!remote.value && local.cloudId) {
      remote = await CloudSystem.claimCloudProfile(local.cloudId);
      if (!remote.ok) {
        this.busy = false;
        this.setStatus(remote.error, Palette.gold);
        return;
      }
    }

    if (!remote.value) {
      remote = await CloudSystem.initializeProfileProgress(local);
      if (!remote.ok) {
        this.busy = false;
        this.setStatus(remote.error, Palette.gold);
        return;
      }
    }

    const alias = this.activeAlias || AuthSystem.currentAlias();
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
      if (CloudSystem.isRemoteAhead(local, summary)) {
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
