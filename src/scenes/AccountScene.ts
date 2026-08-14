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

export class AccountScene extends Phaser.Scene {
  private busy = false;
  private statusText!: Phaser.GameObjects.Text;
  private aliasInput: TextInputHandle | null = null;
  private passwordInput: TextInputHandle | null = null;
  private activeAlias = '';
  private actionObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SceneKey.Account);
  }

  create(): void {
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
    createBackButton(this, () => this.scene.start(SceneKey.Settings));

    this.add
      .text(GAME_WIDTH / 2, 130, 'PROFIL VERBINDEN', textStyle(FontSize.heading, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.add
      .text(
        GAME_WIDTH / 2,
        184,
        'Auf iPhone und iPad denselben Fortschritt nutzen',
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

    this.buildCurrentState(world.accent);
    void AuthSystem.refresh().then((result) => {
      if (result.ok && result.value && this.scene.isActive()) this.scene.restart();
    });
    this.events.once('shutdown', () => {
      this.aliasInput?.destroy();
      this.passwordInput?.destroy();
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
      .text(GAME_WIDTH / 2, 270, 'ALIAS UND PASSWORT', textStyle(FontSize.body, Palette.gold))
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
    this.passwordInput = createTextInput(this, GAME_WIDTH / 2, 490, {
      placeholder: 'Passwort',
      inputType: 'password',
      width: 480,
      accent,
      onSubmit: () => void this.signIn(),
    });

    const signIn = createButton(this, GAME_WIDTH / 2, 625, 'ANMELDEN', () => void this.signIn(), {
      width: 440,
      height: 76,
      accent,
      fontSize: FontSize.body,
    });
    const signUp = createButton(
      this,
      GAME_WIDTH / 2,
      730,
      'NEUES PROFIL ANLEGEN',
      () => void this.signUp(),
      { width: 440, height: 70, accent: 0x9aa3bd, fontSize: FontSize.small },
    );

    this.actionObjects = [signIn.container, signUp.container];
    this.statusText.setText(
      'Dein Profil bleibt freiwillig. Ohne Login kannst du weiter offline spielen.',
    );
  }

  private buildSignedIn(accent: number): void {
    const alias = AuthSystem.currentAlias() ?? 'angemeldetes Profil';
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
    if (this.busy || !this.aliasInput || !this.passwordInput) return;
    const alias = AuthSystem.normalizeAlias(this.aliasInput.getValue());
    const password = this.passwordInput.getValue();
    if (!AuthSystem.isValidAlias(alias) || !password) {
      this.setStatus(
        `Alias: ${AuthSystem.ALIAS_MIN_LENGTH}-${AuthSystem.ALIAS_MAX_LENGTH} Zeichen, nur a-z, 0-9, - und _`,
        Palette.gold,
      );
      return;
    }

    this.activeAlias = alias;
    this.busy = true;
    this.setStatus('Anmeldung wird geprüft ...', Palette.inkDim);
    const result = await AuthSystem.signIn(alias, password);
    if (!result.ok) {
      this.busy = false;
      this.setStatus(result.error, Palette.gold);
      return;
    }

    await this.syncProfile();
  }

  private async signUp(): Promise<void> {
    if (this.busy || !this.aliasInput || !this.passwordInput) return;
    const alias = AuthSystem.normalizeAlias(this.aliasInput.getValue());
    const password = this.passwordInput.getValue();
    if (!AuthSystem.isValidAlias(alias) || password.length < 6) {
      this.setStatus(
        `Alias: ${AuthSystem.ALIAS_MIN_LENGTH}-${AuthSystem.ALIAS_MAX_LENGTH} Zeichen; Passwort mindestens 6 Zeichen.`,
        Palette.gold,
      );
      return;
    }

    this.activeAlias = alias;
    this.busy = true;
    this.setStatus('Profil wird angelegt ...', Palette.inkDim);
    const result = await AuthSystem.signUp(alias, password);
    if (!result.ok) {
      this.busy = false;
      this.setStatus(result.error, Palette.gold);
      return;
    }
    if (!result.value) {
      this.busy = false;
      this.setStatus(
        'Profil angelegt. Bitte prüfe die Alias-Konfiguration im Backend.',
        Palette.success,
      );
      return;
    }

    await this.syncProfile();
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
    this.passwordInput?.destroy();
    this.aliasInput = null;
    this.passwordInput = null;
  }
}
