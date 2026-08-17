/** Serverseitige Test- und Reset-Werkzeuge fuer Wartungsadmins. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createBackStatusText,
  createButton,
  createMenuLayout,
  createPanel,
  createVignette,
  paintSafeAreaBackdrop,
} from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

export class AdminUsersScene extends Phaser.Scene {
  private busy = false;
  private resetArmed = false;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKey.AdminUsers);
  }

  create(): void {
    SafeAreaSystem.showStatic('BENUTZER-WERKZEUGE');
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop);
    paintSafeAreaBackdrop(Palette.backdrop, Palette.backdrop);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
    createBackButton(this, () => this.scene.start(SceneKey.Admin));

    const sections = createMenuLayout().sections;
    const titleY = sections.next(120);
    this.add
      .text(
        GAME_WIDTH / 2,
        titleY,
        'PROFIL ÜBER ALIAS BEARBEITEN',
        textStyle(FontSize.heading, Palette.ink),
      )
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        titleY + 58,
        'Push: Level 50 + 5000 Coins · Reset: Level 1 + alles leer',
        textStyle(FontSize.tiny, Palette.inkDim, { align: 'center' }),
      )
      .setOrigin(0.5)
      .setAlign('center');

    createPanel(this, GAME_WIDTH / 2, titleY + 180, GAME_WIDTH - 120, 250, Palette.goldHex, {
      alpha: 0.4,
      radius: 18,
    });

    this.statusText = createBackStatusText(this);
    const aliasInput = createTextInput(this, GAME_WIDTH / 2, titleY + 145, {
      placeholder: 'Alias des Profils, z. B. emre',
      maxLength: 16,
      width: 440,
      accent: Palette.goldHex,
      onSubmit: () => void this.boost(aliasInput.getValue()),
    });

    createButton(
      this,
      GAME_WIDTH / 2 - 125,
      titleY + 245,
      'LEVEL 50 + 5000 C',
      () => void this.boost(aliasInput.getValue()),
      { width: 230, height: 62, accent: Palette.goldHex, fontSize: FontSize.tiny },
    );
    const resetButton = createButton(
      this,
      GAME_WIDTH / 2 + 125,
      titleY + 245,
      'USER RESETTEN',
      () => void this.reset(aliasInput.getValue(), resetButton),
      { width: 230, height: 62, accent: 0xff6b6b, fontSize: FontSize.tiny },
    );

    // Nur das DOM-Eingabefeld raeumt sich hier selbst auf: Phaser zerstoert
    // beim Szenenwechsel bereits alle GameObjects der Szene, bevor SHUTDOWN
    // an diesen Listener geht. boostButton/resetButton.setEnabled(false) rief
    // hier zuvor disableInteractive() auf einem schon zerstoerten Container
    // auf und liess das Spiel beim Verlassen dieser Szene abstuerzen.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      aliasInput.destroy();
    });
    // Nicht automatisch fokussieren: Auf Mobilgeräten öffnet der sofortige
    // Fokus die Bildschirmtastatur und schiebt bzw. verdeckt genau den
    // festen Zurück-Bereich am unteren Rand. Das Alias-Feld bleibt ganz
    // normal antippbar, ohne die Navigation zu blockieren.
  }

  private async boost(alias: string): Promise<void> {
    if (this.busy) return;
    const safeAlias = alias.trim().toLowerCase();
    if (!safeAlias) {
      this.statusText.setText('Bitte zuerst einen Alias eingeben.').setColor(Palette.gold);
      return;
    }

    this.busy = true;
    this.statusText.setText('Profil wird gesetzt …').setColor(Palette.inkDim);
    const result = await CloudSystem.adminBoostUser(safeAlias);
    this.busy = false;
    if (!result.ok) {
      this.statusText.setText(result.error).setColor(Palette.danger);
      return;
    }
    this.resetArmed = false;
    this.statusText
      .setText(`${safeAlias}: Level 50 und 50000 Coins gesetzt.`)
      .setColor(Palette.success);
  }

  private async reset(alias: string, button: ReturnType<typeof createButton>): Promise<void> {
    if (this.busy) return;
    const safeAlias = alias.trim().toLowerCase();
    if (!safeAlias) {
      this.statusText.setText('Bitte zuerst einen Alias eingeben.').setColor(Palette.gold);
      return;
    }
    if (!this.resetArmed) {
      this.resetArmed = true;
      button.setLabel('WIRKLICH RESETTEN?');
      this.statusText
        .setText('Noch einmal tippen: Highscore, Erfolge, Runs und Coins werden gelöscht.')
        .setColor(Palette.danger);
      return;
    }

    this.busy = true;
    this.statusText.setText('Profil wird zurückgesetzt …').setColor(Palette.inkDim);
    const result = await CloudSystem.adminResetUser(safeAlias);
    this.busy = false;
    this.resetArmed = false;
    button.setLabel('USER RESETTEN');
    if (!result.ok) {
      this.statusText.setText(result.error).setColor(Palette.danger);
      return;
    }
    this.statusText
      .setText(`${safeAlias}: Profil vollständig zurückgesetzt.`)
      .setColor(Palette.success);
  }
}
