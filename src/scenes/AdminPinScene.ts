/** Lokale PIN-Schranke vor dem Wartungsbereich. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createButton,
  createPanel,
  createMenuLayout,
  createVignette,
  paintSafeAreaBackdrop,
} from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

export class AdminPinScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.AdminPin);
  }

  create(): void {
    SafeAreaSystem.showStatic('WARTUNGSZUGANG');
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop);
    paintSafeAreaBackdrop(Palette.backdrop, Palette.backdrop);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    const cardY = createMenuLayout().sections.next(220);
    this.add
      .text(
        GAME_WIDTH / 2,
        cardY - 65,
        'PIN nach der Versions-Geste eingeben',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);
    createPanel(this, GAME_WIDTH / 2, cardY, GAME_WIDTH - 150, 220, Palette.goldHex, {
      alpha: 0.4,
      radius: 18,
    });

    const status = this.add
      .text(GAME_WIDTH / 2, cardY + 98, '', textStyle(FontSize.small, Palette.danger))
      .setOrigin(0.5);
    const input = createTextInput(this, GAME_WIDTH / 2, cardY, {
      inputType: 'password',
      placeholder: 'PIN',
      maxLength: 6,
      numeric: true,
      numericKeyboard: true,
      width: 300,
      accent: Palette.goldHex,
      onSubmit: () => submit(),
    });
    const submit = (): void => {
      if (input.getValue() !== SaveSystem.MAINTENANCE_PIN) {
        status.setText('PIN nicht korrekt.');
        input.setValue('');
        input.focus();
        return;
      }
      this.scene.start(SceneKey.Admin);
    };
    createButton(this, GAME_WIDTH / 2, cardY + 60, 'WARTUNG OEFFNEN', submit, {
      width: 300,
      height: 62,
      accent: Palette.goldHex,
      fontSize: FontSize.small,
    });
    input.focus();
  }
}
