import Phaser from 'phaser';
import { LIGHTING as L } from '@/config/postFx';
import { RARITY_IDS } from '@/config/rarities';
import * as EffectsQualitySystem from '@/systems/EffectsQualitySystem';

/** Was ein Relikt fuer sein Licht braucht - passt direkt auf `Collectible`. */
export interface LightSource {
  readonly x: number;
  readonly y: number;
  readonly rarity: { readonly color: number; readonly id: string };
}

/**
 * Dynamisches Licht der Spielszene (Phaser-4-Beleuchtung, ADR-0035).
 *
 * Das Schiff traegt ein Licht in seiner Triebwerksfarbe und hellt beim
 * Vorbeifliegen Randplanet und Nebel auf; epische und legendaere Relikte
 * werfen Licht in ihrer Seltenheitsfarbe. Die Lichter sind ein fester Pool,
 * pro Frame werden nur Position und Farbe gesetzt.
 */
export class SceneLighting {
  private readonly ship: Phaser.GameObjects.Light;
  private readonly relics: Phaser.GameObjects.Light[] = [];
  private readonly minRank = RARITY_IDS.indexOf(L.relic.minRarity);

  constructor(
    private readonly scene: Phaser.Scene,
    litTargets: readonly Phaser.GameObjects.GameObject[],
    shipColor: number,
    spaceVariant: number,
  ) {
    const ambient = Math.round(255 * (L.ambientByWorld[spaceVariant] ?? L.ambient));
    scene.lights.enable().setAmbientColor(Phaser.Display.Color.GetColor(ambient, ambient, ambient));
    for (const target of litTargets) {
      const lit = target as Phaser.GameObjects.Image;
      lit.setLighting?.(true);
      lit.setSelfShadow?.(true, L.selfShadow.penumbra, L.selfShadow.flatThreshold);
    }
    this.ship = scene.lights.addLight(0, 0, L.ship.radius, shipColor, L.ship.intensity, L.ship.z);
    for (let i = 0; i < L.relic.max; i++) {
      this.relics.push(
        scene.lights.addLight(0, 0, L.relic.radius, 0xffffff, 0, L.relic.z).setVisible(false),
      );
    }
  }

  update(shipX: number, shipY: number, sources: readonly LightSource[]): void {
    this.ship.setPosition(shipX, shipY);
    let used = 0;
    for (const source of sources) {
      if (used >= this.relics.length) break;
      if (RARITY_IDS.indexOf(source.rarity.id as (typeof RARITY_IDS)[number]) < this.minRank)
        continue;
      this.relics[used]!.setPosition(source.x, source.y)
        .setColor(source.rarity.color)
        .setIntensity(L.relic.intensity)
        .setVisible(true);
      used++;
    }
    for (let i = used; i < this.relics.length; i++) this.relics[i]!.setVisible(false);
  }

  destroy(): void {
    this.scene.lights.removeLight(this.ship);
    for (const light of this.relics) this.scene.lights.removeLight(light);
    this.scene.lights.disable();
  }
}

/** Licht gibt es nur auf der vollen Stufe. */
export function lightingEnabled(): boolean {
  return EffectsQualitySystem.isFull();
}
