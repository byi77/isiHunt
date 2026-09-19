import Phaser from 'phaser';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { HangarView } from '@/ui/HangarView';
import { createSceneBackdrop } from '@/ui/widgets';

/** Shop-Regeln bleiben in ProgressionSystem; der Hangar probiert nur an. */
export class ShopScene extends Phaser.Scene {
  private hangar: HangarView | null = null;

  constructor() {
    super(SceneKey.Shop);
  }

  create(): void {
    SafeAreaSystem.showStatic('HANGAR');
    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);
    createSceneBackdrop(this, world);
    // Der Hangar oeffnet mit dem getragenen Schiff.
    //
    // Frueher sprang er auf das erste 3D-Modell, wenn die getragene Form
    // keines hatte - damals zeigte die Vorschau sonst nur eine flache
    // Silhouette, und das 3D-Modell war das neue Schaustueck. Seit die
    // Auswahl eine Bildleiste ist, wiegt das andere Argument schwerer: Wer
    // den Laden oeffnet, will sehen, was er traegt, und von dort aus
    // blaettern. Ein fremdes Schiff als Einstieg kostete jedes Mal die Suche
    // zurueck zum eigenen.
    this.hangar = new HangarView(
      this,
      save,
      world.accent,
      { shapes: save.shipShape, colors: save.shipColor, auras: save.shipAura },
      {
        act: (tab, id) => {
          const current = SaveSystem.load();
          if (tab === 'shapes')
            return current.ownedShipShapes.includes(id)
              ? ProgressionSystem.equipShip(id)
              : ProgressionSystem.purchaseShipShape(id);
          if (tab === 'colors')
            return current.ownedShipColors.includes(id)
              ? ProgressionSystem.equipShip(undefined, id)
              : ProgressionSystem.purchaseShipColor(id);
          return current.ownedShipAuras.includes(id)
            ? ProgressionSystem.equipShip(undefined, undefined, id)
            : ProgressionSystem.purchaseShipAura(id);
        },
        back: () => {
          this.scene.start(SceneKey.Menu);
        },
        seen: (tab) => {
          return SaveSystem.markCosmeticsSeen(tab);
        },
      },
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.hangar?.destroy();
      this.hangar = null;
    });
  }

  override update(_time: number, delta: number): void {
    this.hangar?.update(delta);
  }
}
