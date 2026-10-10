import Phaser from 'phaser';
import { PLAYFIELD_VISUALS as V } from '@/config/playfieldVisuals';

function texture(scene: Phaser.Scene, layer: number | 'cross'): string {
  const key = `playfield-star-${layer}`;
  if (scene.textures.exists(key)) return key;
  const size = V.starTextureSize;
  const canvas = scene.textures.createCanvas(key, size, size)!;
  const ctx = canvas.getContext();
  const center = size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  if (layer === 'cross') {
    ctx.lineWidth = 0.7;
    ctx.moveTo(center - 3, center);
    ctx.lineTo(center + 3, center);
    ctx.moveTo(center, center - 3);
    ctx.lineTo(center, center + 3);
    ctx.stroke();
  } else {
    ctx.arc(center, center, V.starRadius[layer]!, 0, Math.PI * 2);
    ctx.fill();
  }
  canvas.refresh();
  return key;
}

function hash(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Statische Sternpunkte bleiben im GPU-Puffer statt Kreisgeometrie je Frame. */
export function createPlayfieldStars(
  scene: Phaser.Scene,
  width: number,
  height: number,
  variant: number,
  tint: number,
): Phaser.GameObjects.Container[] {
  return V.starCounts.map((count, layer) => {
    const container = scene.add.container(0, 0);
    const stars = scene.add.spriteGPULayer(texture(scene, layer), count);
    container.add(stars);
    const crosses =
      layer === 2 ? scene.add.spriteGPULayer(texture(scene, 'cross'), Math.ceil(count / 5)) : null;
    if (crosses) container.add(crosses);
    const member: Phaser.Types.GameObjects.SpriteGPULayer.Member = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      scrollFactorX: 1,
      scrollFactorY: 1,
      creationTime: 0,
      frame: 0,
      tintMode: Phaser.TintModes.MULTIPLY,
      tintBlend: 1,
      tintTopLeft: tint,
      tintTopRight: tint,
      tintBottomLeft: tint,
      tintBottomRight: tint,
      alphaTopLeft: 1,
      alphaTopRight: 1,
      alphaBottomLeft: 1,
      alphaBottomRight: 1,
      alpha: 1,
    };
    for (let i = 0; i < count; i++) {
      member.x = hash(i, layer, variant) * (width + 48) - 24;
      member.y = hash(layer, i + 19, variant) * (height + 48) - 24;
      const brightness = 0.45 + hash(i, 31, layer) * 0.55;
      member.alpha = V.starAlpha[layer]! * brightness;
      stars.addMember(member);
      if (crosses && i % 5 === 0) {
        member.alpha = 0.12;
        crosses.addMember(member);
      }
    }
    return container;
  });
}
