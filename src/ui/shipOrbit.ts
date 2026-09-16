import type Phaser from 'phaser';

/** Two static arcs bracket the hull in display order; no extra update listener. */
export class ShipOrbit {
  readonly back: Phaser.GameObjects.Graphics;
  readonly front: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x = 0, y = 0, size = 96) {
    this.back = scene.add.graphics({ x, y });
    this.front = scene.add.graphics({ x, y });
    for (const [graphic, start, alpha] of [
      [this.back, Math.PI, 0.24],
      [this.front, 0, 0.7],
    ] as const) {
      graphic.lineStyle(1.5, 0xffffff, alpha);
      graphic.beginPath();
      for (let i = 0; i <= 32; i++) {
        const angle = start + (i / 32) * Math.PI;
        const px = Math.cos(angle) * size * 0.67;
        const py = Math.sin(angle) * size * 0.22;
        if (i === 0) graphic.moveTo(px, py);
        else graphic.lineTo(px, py);
      }
      graphic.strokePath();
    }
  }

  update(visible: boolean, bank = 0): void {
    this.back.setVisible(visible).setRotation(bank - 0.18);
    this.front.setVisible(visible).setRotation(bank - 0.18);
  }
}
