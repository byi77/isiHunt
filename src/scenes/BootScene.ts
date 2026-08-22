/**
 * Erste Scene: erzeugt alle Texturen und geht sofort ins Menue.
 *
 * Sobald echte Assets dazukommen, wird hier zusaetzlich `preload()` befuellt
 * und ein Ladebalken angezeigt (docs/ROADMAP.md, M4).
 */

import Phaser from 'phaser';

import { APP_VERSION } from '@/config/GameConfig';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import { createTextures, TextureKey } from '@/ui/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Boot);
  }

  preload(): void {
    // Neue Dateiversion, damit installierte iOS-Web-Apps nicht die alte
    // zwischengespeicherte Logo-PNG mit Hintergrund wiederverwenden.
    this.load.image(TextureKey.Logo, './assets/isihunt-logo-v2.png');
    this.load.image(TextureKey.PlanetSternenweide, './assets/planet-sternenweide.webp');
    this.load.image(TextureKey.PlanetEisring, './assets/planet-eisring.webp');
    this.load.image(TextureKey.PlanetGlutnebel, './assets/planet-glutnebel.webp');
    this.load.image(TextureKey.PlanetNullsektor, './assets/planet-nullsektor.webp');
    this.load.image(TextureKey.PlanetSonnenkrone, './assets/planet-sonnenkrone.webp');
    // CC0-Piloten: ein 2D-Sprite-Sheet fuer den Shop und sechs CC0-
    // Partikel-Frames fuer die austauschbare Prismaflut-Aura.
    this.load.spritesheet(TextureKey.EgoCc0Scout, './assets/ego/cc0-simpleanimatedship.png', {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.image(TextureKey.EgoCc0AuraFlame01, './assets/ego/aura/cc0-flame_01.png');
    this.load.image(TextureKey.EgoCc0AuraFlame02, './assets/ego/aura/cc0-flame_02.png');
    this.load.image(TextureKey.EgoCc0AuraFlame03, './assets/ego/aura/cc0-flame_03.png');
    this.load.image(TextureKey.EgoCc0AuraFlame04, './assets/ego/aura/cc0-flame_04.png');
    this.load.image(TextureKey.EgoCc0AuraFlame05, './assets/ego/aura/cc0-flame_05.png');
    this.load.image(TextureKey.EgoCc0AuraFlame06, './assets/ego/aura/cc0-flame_06.png');
  }

  create(): void {
    createTextures(this);

    // Ladehinweis aus index.html entfernen, sobald wirklich gerendert wird.
    document.getElementById('boot')?.remove();

    // Version in die Konsole, bevor irgendetwas anderes passiert. Bei einem
    // Fehlerbericht vom Handy ist das die erste Frage: Welcher Stand lief da?
    console.warn(`isiHunt v${APP_VERSION}`);

    void this.startMenuAfterAuthReady();
  }

  private async startMenuAfterAuthReady(): Promise<void> {
    await AuthSystem.whenReady();
    if (this.scene.isActive()) this.scene.start(SceneKey.Menu);
  }
}
