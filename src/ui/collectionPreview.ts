import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { RARITIES } from '@/config/rarities';
import { CollectionEffects } from './CollectionEffects';
import { TextureKey } from './textures';
import { Collectible } from '@/entities/Collectible';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';

/** Static-time visual fixture: inspect flight phases without changing a save. */
export function installCollectionPreview(scene: Phaser.Scene): void {
  const target = { x: GAME_WIDTH / 2, y: GAME_HEIGHT * 0.55 };
  const ship = scene.add.image(target.x, target.y, TextureKey.PlayerCore).setDepth(50);
  let effects: CollectionEffects;
  let quiet = false;
  const make = () =>
    new CollectionEffects(
      scene,
      () => target,
      () => {
        const unit = GAME_WIDTH / scene.game.canvas.getBoundingClientRect().width;
        return {
          left: 12 * unit,
          top: 110 * unit,
          right: GAME_WIDTH - 12 * unit,
          bottom: GAME_HEIGHT - 76 * unit,
        };
      },
      () => quiet || prefersReducedMotion(),
    );
  effects = make();
  const controls = document.createElement('div');
  Object.assign(controls.style, {
    position: 'fixed',
    bottom: '24px',
    left: '0',
    zIndex: '10000',
    maxWidth: '240px',
    background: '#101820',
  });
  const label = document.createElement('span');
  label.style.color = 'white';
  let elapsed = 0;
  const button = (title: string, action: () => void) => {
    const element = document.createElement('button');
    element.textContent = title;
    element.onclick = action;
    controls.append(element);
  };
  const fill = (count: number) => {
    effects.destroy();
    effects = make();
    elapsed = 0;
    for (let i = 0; i < count; i++)
      effects.add(
        { x: target.x + (i % 2 ? 80 : -80), y: target.y - 130 - (i % 3) * 32 },
        RARITIES[i % 6]!,
        (i + 1) * 100,
      );
    label.textContent = `${count} Fänge · ${elapsed} ms`;
  };
  button('6 Seltenheiten', () => fill(6));
  let relics: Collectible[] = [];
  button('Relikte ansehen', () => {
    relics.forEach((relic) => relic.destroy());
    relics = RARITIES.map((rarity, i) => {
      const relic = new Collectible(
        scene,
        160 + (i % 3) * 200,
        300 + Math.floor(i / 3) * 180,
        rarity,
        TextureKey.PlanetSternenweide,
        { driftAngle: 0 },
      );
      scene.tweens.killTweensOf(relic);
      return relic.setScale(1);
    });
  });
  button('50 Fänge', () => fill(50));
  button('Ruhige Variante', () => {
    quiet = true;
    fill(6);
  });
  button('Randfang', () => {
    effects.destroy();
    effects = make();
    elapsed = 0;
    effects.add({ x: 10, y: 180 }, RARITIES[5]!, 1000);
    label.textContent = 'Randfang · 0 ms';
  });
  button('+120 ms', () => {
    elapsed += 120;
    effects.update(120);
    label.textContent = `${elapsed} ms`;
  });
  controls.append(label);
  document.body.append(controls);
  scene.events.once('shutdown', () => {
    controls.remove();
    effects.destroy();
    ship.destroy();
    relics.forEach((relic) => relic.destroy());
  });
}
