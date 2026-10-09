import Phaser from 'phaser';
import { ACHIEVEMENTS } from '@/config/achievements';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import {
  achievementCategoryLabel,
  filterAchievements,
  getNextAchievement,
  getAchievementProgress,
} from '@/systems/AchievementProgressSystem';
import type { AchievementFilter } from '@/systems/AchievementProgressSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { createAchievementBadge } from '@/ui/achievementBadge';
import { ClipMask } from '@/ui/clipMask';
import { InterfaceStyle, Palette, textStyle, uiFont, uiUnit } from '@/ui/theme';
import {
  attachVerticalScroll,
  createBackButton,
  createButton,
  createPanel,
  createSceneBackdrop,
} from '@/ui/widgets';

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Achievements);
  }

  create(data: { page?: number; filter?: AchievementFilter } = {}): void {
    SafeAreaSystem.showStatic('ERFOLGE');
    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);
    createSceneBackdrop(this, world);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));
    const u = uiUnit(this);
    const margin = InterfaceStyle.spacing * u;
    const padding = InterfaceStyle.padding * u;
    const gap = InterfaceStyle.spacing * u;
    const width = GAME_WIDTH - margin * 2;
    const left = margin + padding;
    const unlocked = save.unlockedAchievements.filter((id) =>
      ACHIEVEMENTS.some((entry) => entry.id === id),
    ).length;
    this.add
      .text(
        GAME_WIDTH / 2,
        16 * u,
        `${unlocked} von ${ACHIEVEMENTS.length} freigeschaltet`,
        textStyle(uiFont(this, 'body'), Palette.ink),
      )
      .setOrigin(0.5);
    const filter = data.filter ?? 'all';
    const filtered = filterAchievements(ACHIEVEMENTS, save, filter);
    const tabs: readonly { id: AchievementFilter; label: string }[] = [
      { id: 'all', label: 'Alle' },
      { id: 'near', label: 'Bald' },
      { id: 'open', label: 'Offen' },
      { id: 'unlocked', label: 'Erreicht' },
    ];
    const columns = this.game.canvas.getBoundingClientRect().width >= 600 ? 4 : 2;
    const tabWidth = (width - gap * (columns - 1)) / columns;
    tabs.forEach(({ id, label }, index) =>
      createButton(
        this,
        margin + tabWidth / 2 + (index % columns) * (tabWidth + gap),
        (60 + Math.floor(index / columns) * 56) * u,
        label,
        () => this.scene.restart({ filter: id, page: 0 }),
        {
          width: tabWidth,
          height: 44 * u,
          fontSize: uiFont(this, 'button'),
          variant: id === filter ? 'primary' : 'secondary',
        },
      ),
    );
    const listTop = (columns === 2 ? 150 : 94) * u;
    const listBottom = GAME_HEIGHT - 130 * u;
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
    const pageSize = 8;
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(pageCount - 1, Math.max(0, data.page ?? 0));
    const entries = filtered.slice(page * pageSize, (page + 1) * pageSize);
    const nextAchievement = getNextAchievement(ACHIEVEMENTS, save);
    let top = 0;
    const addText = (
      value: string,
      x: number,
      y: number,
      role: 'heading' | 'body' | 'tiny',
      color: string,
      wrap: number,
      bold = false,
    ) => {
      const text = this.add.text(
        x,
        y,
        value,
        textStyle(uiFont(this, role), color, {
          fontStyle: bold ? 'bold' : 'normal',
          wordWrap: { width: wrap, useAdvancedWrap: true },
        }),
      );
      content.add(text);
      return text;
    };
    for (const achievement of entries) {
      const done = save.unlockedAchievements.includes(achievement.id);
      const progress = getAchievementProgress(achievement, save);
      const textX = left + 52 * u;
      const textWidth = width - padding * 2 - 52 * u;
      let y = top + padding;
      const meta = addText(
        `RANG ${achievement.rank} · +${achievement.coinReward} Coins`,
        textX,
        y,
        'tiny',
        Palette.inkDim,
        textWidth,
      );
      y += meta.height + 6 * u;
      const title = addText(achievement.name, textX, y, 'heading', Palette.gold, textWidth, true);
      content.add(
        createAchievementBadge(
          this,
          left + 20 * u,
          y + 20 * u,
          progress.category,
          achievement.rank,
          done,
          20 * u,
        ),
      );
      y += title.height + 8 * u;
      const description = addText(
        achievement.description,
        textX,
        y,
        'body',
        Palette.ink,
        textWidth,
      );
      y += description.height + gap;
      const state =
        achievement.id === nextAchievement?.id
          ? 'NÄCHSTES ZIEL'
          : done
            ? 'ERREICHT'
            : achievementCategoryLabel(progress.category);
      const status = addText(
        state,
        left,
        y,
        'tiny',
        done ? Palette.success : Palette.inkDim,
        width - padding * 2,
        true,
      );
      y += status.height + 4 * u;
      const detail = addText(
        progress.trackable ? `FORTSCHRITT ${progress.label}` : progress.label,
        left,
        y,
        'tiny',
        Palette.inkDim,
        width - padding * 2,
      );
      y += detail.height + padding;
      const height = Math.max(y - top, 108 * u);
      const panel = createPanel(
        this,
        GAME_WIDTH / 2,
        top + height / 2,
        width,
        height,
        done ? Palette.goldHex : world.accent,
      );
      content.addAt(panel, 0);
      top += height + gap;
    }
    if (!entries.length) {
      addText(
        filter === 'near'
          ? 'Noch kein Erfolg kurz vor dem Ziel. Spiele weiter und schau später wieder vorbei.'
          : 'Hier gibt es derzeit keine Erfolge.',
        left,
        padding,
        'body',
        Palette.inkDim,
        width - padding * 2,
      );
    }
    const maxScroll = Math.max(0, top - gap - (listBottom - listTop));
    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: listTop,
      dragZoneBottom: listBottom,
      onOffsetChange: (offset) => content.setY(listTop - offset),
    });
    const pageY = GAME_HEIGHT - 96 * u;
    this.add
      .text(
        GAME_WIDTH / 2,
        pageY,
        `SEITE ${page + 1} / ${pageCount}`,
        textStyle(uiFont(this, 'tiny'), Palette.inkDim),
      )
      .setOrigin(0.5);
    const previous = createButton(
      this,
      margin + 22 * u,
      pageY,
      '‹',
      () => this.scene.restart({ page: page - 1, filter }),
      { width: 44 * u, height: 44 * u, fontSize: uiFont(this, 'heading') },
    );
    previous.setEnabled(page > 0);
    const next = createButton(
      this,
      GAME_WIDTH - margin - 22 * u,
      pageY,
      '›',
      () => this.scene.restart({ page: page + 1, filter }),
      { width: 44 * u, height: 44 * u, fontSize: uiFont(this, 'heading') },
    );
    next.setEnabled(page < pageCount - 1);
  }
}
