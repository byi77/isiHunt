/** Feste Belohnungscode-Vorlagen fuer Admins. */
import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { SceneKey } from '@/scenes/SceneKey';
import { REWARD_CAMPAIGN_PRESETS } from '@/systems/RewardCampaignPresets';
import * as CloudSystem from '@/systems/CloudSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createBackStatusText,
  createButton,
  createMenuLayout,
  createPanel,
  createVignette,
  paintSafeAreaBackdrop,
} from '@/ui/widgets';
import { createTextInput } from '@/ui/textInput';

export class AdminRewardCodesScene extends Phaser.Scene {
  private busy = false;
  private selected = REWARD_CAMPAIGN_PRESETS[0]!;
  private statusText!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;
  private codesText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKey.AdminRewardCodes);
  }

  create(): void {
    SafeAreaSystem.showStatic('BELOHNUNGSCODES');
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop);
    paintSafeAreaBackdrop(Palette.backdrop, Palette.backdrop);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
    createBackButton(this, () => this.scene.start(SceneKey.Admin));
    const sections = createMenuLayout(12).sections;
    const titleY = sections.next(130);
    this.add
      .text(GAME_WIDTH / 2, titleY, 'CODE-GENERATOR', textStyle(FontSize.heading, Palette.ink))
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        titleY + 40,
        'Vorlage waehlen · Anzahl setzen · Codes einmalig sichern',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
    this.selectionText = this.add
      .text(
        70,
        titleY + 78,
        '',
        textStyle(FontSize.small, Palette.gold, { wordWrap: { width: GAME_WIDTH - 140 } }),
      )
      .setOrigin(0, 0);
    this.renderSelection();
    let y = titleY + 155;
    for (const preset of REWARD_CAMPAIGN_PRESETS) {
      createButton(
        this,
        GAME_WIDTH / 2,
        y,
        preset.label,
        () => {
          this.selected = preset;
          this.renderSelection();
        },
        { width: 560, height: 52, accent: Palette.goldHex, fontSize: FontSize.tiny },
      );
      y += 64;
    }
    createPanel(this, GAME_WIDTH / 2, y + 52, GAME_WIDTH - 120, 130, Palette.goldHex, {
      alpha: 0.35,
      radius: 16,
    });
    const countInput = createTextInput(this, GAME_WIDTH / 2 - 105, y + 30, {
      placeholder: 'Anzahl (1–1000)',
      maxLength: 4,
      numeric: true,
      numericKeyboard: true,
      width: 250,
      accent: Palette.goldHex,
    });
    createButton(
      this,
      GAME_WIDTH / 2 + 175,
      y + 30,
      'ERZEUGEN',
      () => void this.generate(countInput.getValue()),
      { width: 190, height: 56, accent: Palette.goldHex, fontSize: FontSize.tiny },
    );
    this.codesText = this.add
      .text(
        70,
        y + 135,
        '',
        textStyle(FontSize.tiny, Palette.ink, { wordWrap: { width: GAME_WIDTH - 140 } }),
      )
      .setOrigin(0, 0)
      .setLineSpacing(6);
    this.statusText = createBackStatusText(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => countInput.destroy());
    const bottom = y + 290;
    const maxScroll = Math.max(0, bottom - (GAME_HEIGHT - 110));
    if (maxScroll) {
      this.cameras.main.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT + maxScroll);
      attachVerticalScroll(this, {
        maxScroll,
        dragZoneTop: 100,
        dragZoneBottom: GAME_HEIGHT - 110,
        onOffsetChange: (offset) => this.cameras.main.setScroll(0, offset),
      });
    }
  }

  private renderSelection(): void {
    this.selectionText?.setText(
      `AUSGEWAEHLT: ${this.selected.label}\n${this.selected.description}`,
    );
  }

  private async generate(rawCount: string): Promise<void> {
    if (this.busy) return;
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 1000) {
      this.statusText
        .setText('Bitte eine Anzahl von 1 bis 1000 eingeben.')
        .setColor(Palette.danger);
      return;
    }
    this.busy = true;
    this.codesText.setText('');
    this.statusText
      .setText('Kampagne wird angelegt und Codes werden erzeugt …')
      .setColor(Palette.inkDim);
    const result = await CloudSystem.createAdminRewardCodes({
      name: this.selected.label,
      description: this.selected.description,
      package: this.selected.package,
      count,
    });
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.statusText.setText(result.error).setColor(Palette.danger);
      return;
    }
    this.codesText.setText(
      `CODES – jetzt kopieren, sie werden nicht gespeichert:\n${result.value.join('  ')}`,
    );
    this.statusText
      .setText(`${result.value.length} aktive Codes erzeugt.`)
      .setColor(Palette.success);
  }
}
