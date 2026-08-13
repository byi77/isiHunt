/**
 * Erste Scene: erzeugt alle Texturen und geht sofort ins Menue.
 *
 * Sobald echte Assets dazukommen, wird hier zusaetzlich `preload()` befuellt
 * und ein Ladebalken angezeigt (docs/ROADMAP.md, M4).
 */

import Phaser from 'phaser';

import { APP_VERSION } from '@/config/GameConfig';
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

    // Version in die Konsole, bevor irgendetwas anderes passiert. Bei einem
    // Fehlerbericht vom Handy ist das die erste Frage: Welcher Stand lief da?
    console.warn(`isiHunt v${APP_VERSION}`);

    this.scene.start(SceneKey.Menu);
  }
}
