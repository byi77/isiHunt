/**
 * Vereinheitlichte Steuerung: Touch/Maus UND Tastatur liefern denselben
 * normalisierten Richtungsvektor. Die Scene weiss nicht, womit gespielt wird.
 *
 * Touch (Primaersteuerung, Handy):
 *   Finger irgendwo auf den Bildschirm legen und ziehen - die Figur laeuft zum
 *   Finger. Bewusst KEIN "Figur klebt am Finger": so verdeckt die Hand nie das
 *   Ziel, und der Sammelradius bleibt sichtbar.
 *
 * Tastatur (Test am Rechner, siehe README):
 *   WASD oder Pfeiltasten.
 */

import Phaser from 'phaser';

import { POINTER_DEADZONE } from '@/config/GameConfig';

export class InputController {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private readonly wasd: Record<'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key> | undefined;
  private readonly direction = new Phaser.Math.Vector2();

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = {
        w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Mehrere Finger gleichzeitig: der zuletzt aufgesetzte fuehrt.
    scene.input.addPointer(2);
  }

  /**
   * Aktuelle Bewegungsrichtung, Laenge zwischen 0 und 1.
   * Tastatur hat Vorrang, solange eine Taste gehalten wird.
   */
  getDirection(fromX: number, fromY: number): Phaser.Math.Vector2 {
    const keyboard = this.readKeyboard();
    if (keyboard.lengthSq() > 0) return keyboard;

    return this.readPointer(fromX, fromY);
  }

  private readKeyboard(): Phaser.Math.Vector2 {
    this.direction.set(0, 0);

    const left = this.cursors?.left.isDown || this.wasd?.a.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.d.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.w.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.s.isDown;

    if (left) this.direction.x -= 1;
    if (right) this.direction.x += 1;
    if (up) this.direction.y -= 1;
    if (down) this.direction.y += 1;

    // Normalisieren, damit Diagonalen nicht schneller sind als Geradeaus.
    if (this.direction.lengthSq() > 0) this.direction.normalize();

    return this.direction;
  }

  private readPointer(fromX: number, fromY: number): Phaser.Math.Vector2 {
    const pointer = this.activePointer();
    if (!pointer) return this.direction.set(0, 0);

    const dx = pointer.worldX - fromX;
    const dy = pointer.worldY - fromY;
    const distance = Math.hypot(dx, dy);

    if (distance <= POINTER_DEADZONE) return this.direction.set(0, 0);

    // Nahe am Ziel wird abgebremst - verhindert Ueberschwingen am Finger.
    const throttle = Phaser.Math.Clamp(distance / 90, 0.15, 1);
    return this.direction.set((dx / distance) * throttle, (dy / distance) * throttle);
  }

  private activePointer(): Phaser.Input.Pointer | null {
    const pointers = [
      this.scene.input.activePointer,
      this.scene.input.pointer1,
      this.scene.input.pointer2,
    ];

    for (const pointer of pointers) {
      if (pointer?.isDown) return pointer;
    }

    return null;
  }
}
