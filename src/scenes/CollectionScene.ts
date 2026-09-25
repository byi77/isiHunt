/** Visuelles Album aus dem bereits gespeicherten Fortschritt. */

import Phaser from 'phaser';

import { GAME_WIDTH } from '@/config/GameConfig';
import { RARITIES } from '@/config/rarities';
import { WORLDS, getWorld } from '@/config/worlds';
import { STARS_PER_WORLD, worldStarCount, worldStarLabel } from '@/config/worldStars';
import { SceneKey } from '@/scenes/SceneKey';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { planetTextureForVariant } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import { createBackButton, createButton, createPanel, createSceneBackdrop } from '@/ui/widgets';

type AlbumTab = 'relics' | 'worlds';

export class CollectionScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Collection);
  }

  create(data: { tab?: AlbumTab } = {}): void {
    SafeAreaSystem.showStatic('SAMMLUNG');
    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);
    const tab = data.tab === 'worlds' ? 'worlds' : 'relics';
    createSceneBackdrop(this, world);
    createBackButton(this, () => this.scene.start(SceneKey.Profile));

    for (const [index, option] of (['relics', 'worlds'] as const).entries()) {
      createButton(
        this,
        index === 0 ? 190 : 530,
        94,
        option === 'relics' ? 'RELIKTE' : 'WELTEN',
        () => this.scene.restart({ tab: option }),
        {
          width: 290,
          height: 82,
          fontSize: FontSize.small,
          variant: tab === option ? 'primary' : 'secondary',
        },
      );
    }

    const summary =
      tab === 'relics'
        ? `${Object.values(save.collected)
            .reduce((sum, count) => sum + count, 0)
            .toLocaleString('de-DE')} Relikte gesammelt`
        : `${WORLDS.filter((entry) => entry.unlockLevel <= save.level).length} von ${WORLDS.length} Welten · ${WORLDS.reduce(
            (sum, entry) => sum + worldStarCount(save.unlockedAchievements, entry.id),
            0,
          )} von ${WORLDS.length * STARS_PER_WORLD} ★`;
    this.add
      .text(GAME_WIDTH / 2, 177, summary, textStyle(FontSize.small, Palette.inkDim))
      .setOrigin(0.5);

    if (tab === 'relics') {
      RARITIES.forEach((rarity, index) => {
        const x = index % 2 === 0 ? 190 : 530;
        const y = 320 + Math.floor(index / 2) * 245;
        const count = save.collected[rarity.id] ?? 0;
        createPanel(this, x, y, 300, 218, rarity.color, {
          alpha: count > 0 ? 0.62 : 0.3,
          radius: 18,
        });
        this.add
          .image(x, y - 38, planetTextureForVariant(index))
          .setDisplaySize(84, 84)
          .setTint(count > 0 ? 0xffffff : 0x26333a);
        const rank = this.add.graphics();
        rank.lineStyle(2, count > 0 ? rarity.color : Palette.medalLocked, 0.9);
        rank.strokeCircle(x, y - 38, 43);
        for (let marker = 0; marker <= index; marker++) {
          rank.fillStyle(count > 0 ? rarity.color : Palette.medalLocked, 0.9);
          rank.fillCircle(x + (marker - index / 2) * 10, y + 12, 2.5);
        }
        this.add
          .text(
            x,
            y + 30,
            rarity.label,
            textStyle(FontSize.small, count > 0 ? toCss(rarity.color) : Palette.inkDim, {
              fontStyle: 'bold',
            }),
          )
          .setOrigin(0.5);
        this.add
          .text(
            x,
            y + 73,
            count > 0 ? `${count.toLocaleString('de-DE')} gesammelt` : 'Noch nicht entdeckt',
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0.5);
      });
    } else {
      WORLDS.forEach((entry, index) => {
        const x = index % 2 === 0 ? 190 : 530;
        const y = 270 + Math.floor(index / 2) * 200;
        const unlocked = entry.unlockLevel <= save.level;
        createPanel(this, x, y, 300, 186, unlocked ? entry.accent : Palette.panelBorder, {
          alpha: unlocked ? 0.62 : 0.3,
          radius: 16,
        });
        this.add
          .image(x - 88, y, planetTextureForVariant(entry.spaceVariant))
          .setDisplaySize(74, 74)
          .setTint(unlocked ? 0xffffff : 0x26333a);
        this.add
          .text(
            x - 88,
            y + 56,
            worldStarLabel(worldStarCount(save.unlockedAchievements, entry.id)),
            textStyle(FontSize.tiny, unlocked ? toCss(entry.accent) : Palette.inkDim, {
              fontStyle: 'bold',
            }),
          )
          .setOrigin(0.5);
        this.add
          .text(
            x - 40,
            y - 48,
            entry.name,
            textStyle(FontSize.small, unlocked ? Palette.ink : Palette.inkDim, {
              fontStyle: 'bold',
            }),
          )
          .setOrigin(0, 0.5)
          .setWordWrapWidth(185);
        this.add
          .text(
            x - 40,
            y - 19,
            // Gesperrte Welten zeigen nur die Schwelle: Der Modifikatortext
            // bricht dort auf vier Zeilen um und laeuft in die Belohnung.
            // Der Weltauftrag steht als dritter Stern in der Weltinfo.
            unlocked ? entry.plannedModifier : `Ab Level ${entry.unlockLevel}`,
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0, 0)
          .setWordWrapWidth(178)
          .setLineSpacing(1);
        const scoreBonus = Math.round((entry.scoreMultiplier - 1) * 100);
        const xpBonus = Math.round((entry.xpMultiplier - 1) * 100);
        this.add
          .text(
            x - 40,
            y + 46,
            scoreBonus === 0 && xpBonus === 0
              ? 'Basisbelohnung'
              : `+${scoreBonus}% Punkte\n+${xpBonus}% XP`,
            textStyle(FontSize.tiny, unlocked ? toCss(entry.accent) : Palette.inkDim, {
              fontStyle: 'bold',
            }),
          )
          .setOrigin(0, 0)
          .setLineSpacing(1);
      });
    }
  }
}
