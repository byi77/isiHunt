import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { Palette, textStyle } from '@/ui/theme';
import { createBar, createButton, createPanel } from '@/ui/widgets';
import type { ButtonHandle } from '@/ui/widgets';

export interface ResultSection {
  title: string;
  lines: string[];
  highlight?: boolean;
  progress?: number;
}

export interface ResultContent {
  title: string;
  score: string;
  subtitle: string;
  badge?: string;
  sections: ResultSection[];
}

/** Feste Aktionen; beliebig viele Belohnungen bleiben im Detailbereich erreichbar. */
export class ResultView {
  private destroyed = false;
  private pendingMessage = '';
  private buttons: ButtonHandle[] = [];
  private root!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Container;
  private maskShape!: Phaser.GameObjects.Graphics;
  private mask!: Phaser.Display.Masks.GeometryMask;
  private scroll = 0;
  private maxScroll = 0;
  private top = 0;
  private bottom = 0;
  private drag: { id: number; y: number } | null = null;
  private indicator!: Phaser.GameObjects.Text;
  private readonly resize = (): void => this.build();
  private readonly down = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.y >= this.top && pointer.y <= this.bottom)
      this.drag = { id: pointer.id, y: pointer.y };
  };
  private readonly move = (pointer: Phaser.Input.Pointer): void => {
    if (!this.drag || this.drag.id !== pointer.id || !pointer.isDown) return;
    this.setScroll(this.scroll + this.drag.y - pointer.y);
    this.drag.y = pointer.y;
  };
  private readonly up = (): void => {
    this.drag = null;
  };
  private readonly wheel = (
    pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _x: number,
    y: number,
  ): void => {
    if (pointer.y >= this.top && pointer.y <= this.bottom) this.setScroll(this.scroll + y);
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: ResultContent,
    private readonly accent: number,
    private readonly actions: { label: string; run(): void }[],
  ) {
    this.build();
    scene.scale.on('resize', this.resize);
    scene.input.on('pointerdown', this.down);
    scene.input.on('pointermove', this.move);
    scene.input.on('pointerup', this.up);
    scene.input.on('pointerupoutside', this.up);
    scene.input.on('wheel', this.wheel);
    scene.events.once('shutdown', this.destroy, this);
    if (!prefersReducedMotion()) {
      scene.tweens.add({ targets: this.root, alpha: { from: 0.65, to: 1 }, duration: 220 });
    }
  }

  private build(): void {
    if (this.root) this.scene.tweens.killTweensOf(this.root);
    this.root?.destroy();
    this.buttons = [];
    this.mask?.destroy();
    this.maskShape?.destroy();
    this.drag = null;
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    const unit = GAME_WIDTH / Math.max(1, canvas.width);
    const margin = 16 * unit;
    const width = GAME_WIDTH - margin * 2;
    const safeBottom = document.getElementById('safe-bottom')?.getBoundingClientRect().bottom;
    const inset = safeBottom === undefined ? 0 : Math.max(0, canvas.bottom - safeBottom) * unit;
    this.root = this.scene.add.container(0, 0).setDepth(150);
    const addText = (
      parent: Phaser.GameObjects.Container,
      value: string,
      y: number,
      size: number,
      color: string,
      bold = false,
      padding = 0,
    ): Phaser.GameObjects.Text => {
      const label = this.scene.add.text(
        margin + padding,
        y,
        value,
        textStyle(size * unit, color, {
          fontStyle: bold ? 'bold' : 'normal',
          wordWrap: { width: width - padding * 2, useAdvancedWrap: true },
        }),
      );
      parent.add(label);
      return label;
    };
    let y = 14 * unit;
    const heading = addText(this.root, this.content.title, y, 12, Palette.inkDim, true);
    y += heading.height + 6 * unit;
    const score = addText(this.root, this.content.score, y, 42, Palette.ink, true);
    score.setWordWrapWidth(0);
    // Auch sehr grosse Punktzahlen bleiben innerhalb der festen Kopfbreite.
    if (score.width > width) score.setScale(width / score.width);
    y += score.displayHeight + 4 * unit;
    if (this.content.badge) {
      const badge = addText(this.root, this.content.badge, y, 14, Palette.gold, true);
      y += badge.height + 5 * unit;
    }
    const subtitle = addText(this.root, this.content.subtitle, y, 12, Palette.inkDim);
    this.top = y + subtitle.height + 12 * unit;
    const actionTop = GAME_HEIGHT - inset - (18 + this.actions.length * 52) * unit;
    this.bottom = actionTop - 26 * unit;
    this.body = this.scene.add.container(0, this.top);
    this.root.add(this.body);
    this.maskShape = this.scene.make.graphics({ x: 0, y: 0 });
    this.maskShape
      .fillStyle(0xffffff)
      .fillRect(0, this.top, GAME_WIDTH, Math.max(0, this.bottom - this.top));
    this.mask = this.maskShape.createGeometryMask();
    this.body.setMask(this.mask);
    this.body.setData(
      'layoutClipRect',
      new Phaser.Geom.Rectangle(0, this.top, GAME_WIDTH, Math.max(0, this.bottom - this.top)),
    );
    let bodyY = 0;
    for (const section of this.content.sections) {
      const card = this.scene.add.container(0, bodyY);
      this.body.add(card);
      let rowY = 12 * unit;
      const title = addText(
        card,
        section.title,
        rowY,
        14,
        section.highlight ? Palette.gold : Palette.ink,
        true,
        12 * unit,
      );
      rowY += title.height + 8 * unit;
      if (section.progress !== undefined) {
        const bar = createBar(
          this.scene,
          margin + 12 * unit,
          rowY + 3 * unit,
          width - 24 * unit,
          6 * unit,
          this.accent,
        );
        bar.setRatio(section.progress);
        card.add(bar.container);
        rowY += 18 * unit;
      }
      for (const line of section.lines) {
        const text = addText(card, line, rowY, 14, Palette.inkDim, false, 12 * unit);
        rowY += text.height + 7 * unit;
      }
      rowY += 5 * unit;
      const panel = createPanel(
        this.scene,
        GAME_WIDTH / 2,
        rowY / 2,
        width,
        rowY,
        section.highlight ? Palette.goldHex : this.accent,
        { alpha: 0.94, radius: 12 * unit },
      );
      card.addAt(panel, 0);
      bodyY += rowY + 10 * unit;
    }
    this.maxScroll = Math.max(0, bodyY - 10 * unit - (this.bottom - this.top));
    this.indicator = addText(this.root, '', this.bottom + 5 * unit, 11, Palette.inkDim);
    this.setScroll(this.scroll);
    this.actions.forEach((action, index) => {
      const button = createButton(
        this.scene,
        GAME_WIDTH / 2,
        actionTop + (22 + index * 52) * unit,
        action.label,
        action.run,
        {
          width,
          height: 44 * unit,
          fontSize: 16 * unit,
          accent: index === 0 ? Palette.goldHex : this.accent,
          variant: index === 0 ? 'primary' : 'secondary',
        },
      );
      this.root.add(button.container);
      button.setEnabled(!this.pendingMessage);
      this.buttons.push(button);
    });
  }

  private setScroll(value: number): void {
    this.scroll = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.body.y = this.top - this.scroll;
    this.indicator.setText(
      this.pendingMessage ||
        (this.maxScroll > 0
          ? this.scroll >= this.maxScroll - 1
            ? 'Ende der Details · nach unten wischen'
            : 'Weitere Details · nach oben wischen'
          : 'Alle Details'),
    );
  }

  setPending(message: string): void {
    this.pendingMessage = message;
    this.indicator.setText(message);
    for (const button of this.buttons) button.setEnabled(false);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    this.scene.scale.off('resize', this.resize);
    this.scene.input.off('pointerdown', this.down);
    this.scene.input.off('pointermove', this.move);
    this.scene.input.off('pointerup', this.up);
    this.scene.input.off('pointerupoutside', this.up);
    this.scene.input.off('wheel', this.wheel);
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy();
    this.mask.destroy();
    this.maskShape.destroy();
  }
}
