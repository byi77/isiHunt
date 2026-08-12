/**
 * Erste Scene: erzeugt alle Texturen und geht sofort ins Menue.
 *
 * Sobald echte Assets dazukommen, wird hier zusaetzlich `preload()` befuellt
 * und ein Ladebalken angezeigt (docs/ROADMAP.md, M4).
 */

import Phaser from 'phaser';

import { SceneKey } from '@/scenes/SceneKey';
import { createTextures } from '@/ui/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  create(): void {
    createTextures(this);

    // Ladehinweis aus index.html entfernen, sobald wirklich gerendert wird.
    document.getElementById('boot')?.remove();

    this.scene.start(SceneKey.Menu);
  }
}
