import Phaser from 'phaser';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { SettingsView } from '@/ui/SettingsView';
import { createSceneBackdrop } from '@/ui/widgets';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super(SceneKey.Settings);
  }
  create(): void {
    SafeAreaSystem.showStatic('EINSTELLUNGEN');
    const world = getWorld(SaveSystem.load().lastWorldId);
    createSceneBackdrop(this, world);
    const view = new SettingsView(
      this,
      world.accent,
      () => this.scene.start(SceneKey.Profile),
      () => this.scene.start(SceneKey.Menu),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => view.destroy());
  }
}
