import Phaser from 'phaser';
import { SHIP_SHAPES, getShipShape } from '@/config/shop';
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
    const initialShape = getShipShape(save.shipShape).threeDAssetId
      ? save.shipShape
      : (SHIP_SHAPES.find((shape) => shape.threeDAssetId)?.id ?? save.shipShape);
    this.hangar = new HangarView(
      this,
      save,
      world.accent,
      { shapes: initialShape, colors: save.shipColor, auras: save.shipAura },
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
