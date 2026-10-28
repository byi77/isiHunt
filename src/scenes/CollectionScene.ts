import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/GameConfig';
import { RARITIES } from '@/config/rarities';
import { WORLDS, getWorld } from '@/config/worlds';
import { STARS_PER_WORLD, worldStarCount, worldStarLabel } from '@/config/worldStars';
import { SceneKey } from '@/scenes/SceneKey';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { planetTextureForVariant } from '@/ui/textures';
import { InterfaceStyle, Palette, textStyle, uiFont, uiUnit } from '@/ui/theme';
import { ClipMask } from '@/ui/clipMask';
import {
  attachVerticalScroll,
  createBackButton,
  createButton,
  createPanel,
  createSceneBackdrop,
} from '@/ui/widgets';
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
    const u = uiUnit(this);
    const margin = InterfaceStyle.spacing * u;
    const padding = InterfaceStyle.padding * u;
    const gap = InterfaceStyle.spacing * u;
    const width = GAME_WIDTH - margin * 2;
    const buttonWidth = (width - gap) / 2;
    (['relics', 'worlds'] as const).forEach((option, index) =>
      createButton(
        this,
        margin + buttonWidth / 2 + index * (buttonWidth + gap),
        28 * u,
        option === 'relics' ? 'Relikte' : 'Welten',
        () => this.scene.restart({ tab: option }),
        {
          width: buttonWidth,
          height: 44 * u,
          fontSize: uiFont(this, 'button'),
          variant: tab === option ? 'selected' : 'secondary',
        },
      ),
    );
    const summary =
      tab === 'relics'
        ? `${Object.values(save.collected)
            .reduce((sum, count) => sum + count, 0)
            .toLocaleString('de-DE')} Relikte gesammelt`
        : `${WORLDS.filter((entry) => entry.unlockLevel <= save.level).length} von ${WORLDS.length} Welten · ${WORLDS.reduce((sum, entry) => sum + worldStarCount(save.unlockedAchievements, entry.id), 0)} von ${WORLDS.length * STARS_PER_WORLD} ★`;
    this.add
      .text(GAME_WIDTH / 2, 72 * u, summary, textStyle(uiFont(this, 'tiny'), Palette.inkDim))
      .setOrigin(0.5);
    const listTop = 96 * u;
    const listBottom = GAME_HEIGHT - 80 * u;
    const content = this.add.container(0, listTop);
    const clipRect = new Phaser.Geom.Rectangle(
      0,
      listTop,
      GAME_WIDTH,
      Math.max(0, listBottom - listTop),
    );
    const clip = new ClipMask(this, content).set(clipRect);
    content.setData('layoutClipRect', clipRect);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clip.destroy());
    const entries =
      tab === 'relics'
        ? RARITIES.map((rarity, index) => {
            const count = save.collected[rarity.id] ?? 0;
            return {
              name: rarity.label,
              variant: index,
              unlocked: count > 0,
              accent: rarity.color,
              description:
                count > 0 ? `${count.toLocaleString('de-DE')} gesammelt` : 'Noch nicht entdeckt',
              detail: '',
            };
          })
        : WORLDS.map((entry) => {
            const unlocked = entry.unlockLevel <= save.level;
            const scoreBonus = Math.round((entry.scoreMultiplier - 1) * 100);
            const xpBonus = Math.round((entry.xpMultiplier - 1) * 100);
            return {
              name: entry.name,
              variant: entry.spaceVariant,
              unlocked,
              accent: entry.accent,
              description: unlocked ? entry.plannedModifier : `Ab Level ${entry.unlockLevel}`,
              detail: `${worldStarLabel(worldStarCount(save.unlockedAchievements, entry.id))} · ${scoreBonus === 0 && xpBonus === 0 ? 'Basisbelohnung' : `+${scoreBonus}% Punkte · +${xpBonus}% XP`}`,
            };
          });
    let top = 0;
    for (const entry of entries) {
      const textX = margin + padding + 76 * u;
      const wrap = width - padding * 2 - 76 * u;
      let y = top + padding;
      const title = this.add.text(
        textX,
        y,
        entry.name,
        textStyle(uiFont(this, 'heading'), Palette.ink, {
          fontStyle: 'bold',
          wordWrap: { width: wrap, useAdvancedWrap: true },
        }),
      );
      y += title.height + 8 * u;
      const description = this.add.text(
        textX,
        y,
        entry.description,
        textStyle(uiFont(this, 'body'), Palette.ink, {
          wordWrap: { width: wrap, useAdvancedWrap: true },
        }),
      );
      y += description.height + 8 * u;
      const detail = this.add.text(
        textX,
        y,
        entry.detail,
        textStyle(uiFont(this, 'tiny'), Palette.inkDim, {
          wordWrap: { width: wrap, useAdvancedWrap: true },
        }),
      );
      y += detail.height + padding;
      const height = Math.max(y - top, 100 * u);
      const image = this.add
        .image(margin + padding + 28 * u, top + height / 2, planetTextureForVariant(entry.variant))
        .setDisplaySize(56 * u, 56 * u)
        .setTint(entry.unlocked ? 0xffffff : 0x26333a);
      const panel = createPanel(
        this,
        GAME_WIDTH / 2,
        top + height / 2,
        width,
        height,
        entry.unlocked ? entry.accent : Palette.panelBorder,
      );
      content.add([panel, image, title, description, detail]);
      if (tab === 'relics') {
        const rank = this.add.graphics();
        rank.lineStyle(u, entry.unlocked ? entry.accent : Palette.medalLocked, 0.9);
        rank.strokeCircle(image.x, image.y, 30 * u);
        rank.fillStyle(entry.unlocked ? entry.accent : Palette.medalLocked, 0.9);
        for (let marker = 0; marker <= entry.variant; marker++) {
          rank.fillCircle(
            image.x + (marker - entry.variant / 2) * 5 * u,
            image.y + 37 * u,
            1.5 * u,
          );
        }
        content.add(rank);
      }

      top += height + gap;
    }
    const maxScroll = Math.max(0, top - gap - (listBottom - listTop));
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: listTop,
      dragZoneBottom: listBottom,
      onOffsetChange: (offset) => content.setY(listTop - offset),
    });
  }
}
