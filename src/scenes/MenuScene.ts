/**
 * Startbildschirm: Charakterfortschritt, Weltenauswahl, Start.
 *
 * Der Bildschirm ist die "Charakteruebersicht" des Spiels - hier sieht man auf
 * einen Blick, wo man steht, und was das naechste Level freischaltet.
 */

import Phaser from 'phaser';

import { DEBUG_ENABLED, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createAmbientMotes, createBar, createButton, createWorldBackdrop } from '@/ui/widgets';

export class MenuScene extends Phaser.Scene {
  private selectedWorld!: WorldDef;

  constructor() {
    super(SceneKey.Menu);
  }

  create(): void {
    const save = SaveSystem.load();
    const unlocked = WORLDS.filter((w) => w.unlockLevel <= save.level);
    this.selectedWorld =
      unlocked.find((w) => w.id === save.lastWorldId) ??
      unlocked[unlocked.length - 1] ??
      WORLDS[0]!;

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.selectedWorld.bgTop,
      this.selectedWorld.bgBottom,
    );
    createAmbientMotes(this, GAME_WIDTH, GAME_HEIGHT, this.selectedWorld.accent);

    this.buildTitle();
    this.buildCharacterPanel(save.level);
    this.buildWorldList(save.level);
    this.buildFooter(save.bestScore);
  }

  private buildTitle(): void {
    const title = this.add
      .text(
        GAME_WIDTH / 2,
        96,
        'isiHunt',
        textStyle(FontSize.title, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 152, 'JAGE DAS LICHT', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setLetterSpacing(8);

    this.tweens.add({
      targets: title,
      y: 92,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /** Level, XP-Balken und offene Talentpunkte. */
  private buildCharacterPanel(level: number): void {
    const save = SaveSystem.load();
    const progress = ProgressionSystem.getLevelProgress(save);
    const y = 232;

    this.add
      .text(60, y, `Level ${level}`, textStyle(FontSize.large, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5);

    this.add
      .text(
        GAME_WIDTH - 60,
        y,
        `${progress.xpInLevel} / ${progress.xpNeeded} XP`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(1, 0.5);

    const bar = createBar(this, 60, y + 34, GAME_WIDTH - 120, 10, this.selectedWorld.accent);
    bar.setRatio(progress.ratio);

    if (save.talentPoints > 0) {
      this.add
        .text(
          60,
          y + 62,
          `${save.talentPoints} Talentpunkt${save.talentPoints === 1 ? '' : 'e'} verfuegbar  (Vergabe folgt)`,
          textStyle(FontSize.tiny, Palette.gold),
        )
        .setOrigin(0, 0.5);
    }
  }

  /** Weltenliste mit Sperr-Zustand. */
  private buildWorldList(level: number): void {
    const startY = 366;
    const rowHeight = 104;

    this.add
      .text(60, startY - 34, 'WELTEN', textStyle(FontSize.tiny, Palette.inkDim))
      .setLetterSpacing(6);

    WORLDS.forEach((world, index) => {
      const y = startY + index * rowHeight;
      const isUnlocked = world.unlockLevel <= level;
      const isSelected = world.id === this.selectedWorld.id;

      const row = this.add.container(GAME_WIDTH / 2, y + rowHeight / 2 - 18);

      const bg = this.add
        .image(0, 0, TextureKey.Pixel)
        .setDisplaySize(GAME_WIDTH - 120, rowHeight - 14)
        .setTint(world.accent)
        .setAlpha(isSelected ? 0.22 : 0.08);

      const border = this.add.graphics();
      border.lineStyle(isSelected ? 3 : 1.5, world.accent, isUnlocked ? 0.9 : 0.25);
      border.strokeRoundedRect(
        -(GAME_WIDTH - 120) / 2,
        -(rowHeight - 14) / 2,
        GAME_WIDTH - 120,
        rowHeight - 14,
        12,
      );

      const name = this.add
        .text(
          -(GAME_WIDTH - 120) / 2 + 24,
          -16,
          world.name,
          textStyle(FontSize.body, isUnlocked ? toCss(world.accent) : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5);

      const subtitle = this.add
        .text(
          -(GAME_WIDTH - 120) / 2 + 24,
          16,
          isUnlocked ? world.flavor : `Freigeschaltet ab Level ${world.unlockLevel}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5);
      subtitle.setWordWrapWidth(GAME_WIDTH - 200);

      row.add([bg, border, name, subtitle]);

      if (!isUnlocked) {
        row.setAlpha(0.5);
        return;
      }

      row.setSize(GAME_WIDTH - 120, rowHeight - 14);
      row.setInteractive(
        new Phaser.Geom.Rectangle(
          -(GAME_WIDTH - 120) / 2,
          -(rowHeight - 14) / 2,
          GAME_WIDTH - 120,
          rowHeight - 14,
        ),
        Phaser.Geom.Rectangle.Contains,
      );

      row.on('pointerup', () => {
        SaveSystem.update((data) => {
          data.lastWorldId = world.id;
        });
        // Neu aufbauen ist hier billiger und fehlerfreier als selektives Update.
        this.scene.restart();
      });
    });
  }

  private buildFooter(bestScore: number): void {
    createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 168,
      'JAGD BEGINNEN',
      () => {
        this.scene.start(SceneKey.Game, { worldId: this.selectedWorld.id });
      },
      {
        width: 440,
        accent: this.selectedWorld.accent,
        fontSize: FontSize.large,
      },
    );

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 92,
        `Bestwert: ${bestScore.toLocaleString('de-DE')}`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    const hint = DEBUG_ENABLED
      ? 'Ziehen zum Steuern  ·  am PC: WASD / Pfeiltasten  ·  Debug: 1-6, L, K, J, P, 0'
      : 'Ziehen zum Steuern  ·  am PC: WASD / Pfeiltasten';

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 48, hint, textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 80)
      .setAlign('center');
  }
}
