/** Eigene, konto-gebundene Oberfläche für zwölfstellige Belohnungscodes. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as ProgressSyncSystem from '@/systems/ProgressSyncSystem';
import { clearPendingRewardRedemption, prepareRewardRedemption } from '@/systems/RewardCodeSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createBackButton, createButton, createPanel, createSceneBackdrop } from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

export class RewardCodeScene extends Phaser.Scene {
  private busy = false;

  constructor() {
    super(SceneKey.RewardCode);
  }

  create(): void {
    SafeAreaSystem.showStatic('BELOHNUNGSCODE');
    const world = getWorld(SaveSystem.load().lastWorldId);
    createSceneBackdrop(this, world);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    if (!AuthSystem.isSignedIn()) {
      this.showSignInRequired(world.accent);
      return;
    }

    const panelY = Math.min(440, GAME_HEIGHT / 2 - 30);
    createPanel(this, GAME_WIDTH / 2, panelY, GAME_WIDTH - 120, 470, world.accent, {
      alpha: 0.62,
      radius: 20,
    });
    this.add
      .text(GAME_WIDTH / 2, panelY - 165, 'BELOHNUNGSCODE', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        panelY - 105,
        'Gib deinen zwölfstelligen Code ein.\nDie Belohnung wird direkt deinem Konto gutgeschrieben.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center');

    const status = this.add
      .text(GAME_WIDTH / 2, panelY + 160, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 160)
      .setAlign('center');
    const input = createTextInput(this, GAME_WIDTH / 2, panelY - 25, {
      placeholder: '1234-5678-9012',
      maxLength: 14,
      width: 420,
      accent: world.accent,
      numericKeyboard: true,
    });
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
        status.setText('Bitte gib einen zwölfstelligen Code ein.').setColor(Palette.gold);
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
        .setColor(toCss(world.accent));
    };
    const redeemButton = createButton(
      this,
      GAME_WIDTH / 2,
      panelY + 80,
      'CODE EINLÖSEN',
      () => void redeem(),
      { width: 420, height: 64, accent: world.accent, fontSize: FontSize.small },
    );
    controls.redeemButton = redeemButton;
  }

  private showSignInRequired(accent: number): void {
    const panelY = Math.min(430, GAME_HEIGHT / 2 - 30);
    createPanel(this, GAME_WIDTH / 2, panelY, GAME_WIDTH - 120, 360, accent, {
      alpha: 0.62,
      radius: 20,
    });
    this.add
      .text(GAME_WIDTH / 2, panelY - 115, 'BELOHNUNGSCODE', textStyle(FontSize.body, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        panelY - 38,
        'Belohnungscodes gehören immer zu einem Konto.\nMelde dich an, bevor du einen Code einlöst.',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setAlign('center');
    createButton(
      this,
      GAME_WIDTH / 2,
      panelY + 92,
      'ZUM PROFIL',
      () => this.scene.start(SceneKey.Profile),
      {
        width: 420,
        height: 64,
        accent,
        fontSize: FontSize.small,
      },
    );
  }
}
