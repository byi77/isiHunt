/** Kleine, sichtbare Scroll-Hilfe fuer lange Wartungsseiten. */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { Depth } from '@/ui/depth';
import { Palette } from '@/ui/theme';

type FixedObject = Phaser.GameObjects.GameObject & {
  setScrollFactor(x: number, y?: number): FixedObject;
  setDepth(value: number): FixedObject;
};

/**
 * Macht eine Scene per Mausrad sowie per Ziehen am rechten Scroll-Balken
 * vertikal scrollbar. Die feste Unterkante bleibt absichtlich frei: Dort
 * liegt auf allen Unterseiten der Zurueck-Knopf.
 */
export function enableVerticalScroll(
  scene: Phaser.Scene,
  contentHeight: number,
  fixedObjects: FixedObject[] = [],
): void {
  const maxScroll = Math.max(0, contentHeight - GAME_HEIGHT);
  if (maxScroll === 0) return;

  const camera = scene.cameras.main;
  camera.setBounds(0, 0, GAME_WIDTH, contentHeight);
  camera.setScroll(0, 0);

  for (const object of fixedObjects) object.setScrollFactor(0).setDepth(Depth.Overlay + 2);

  const protectedZone = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 70, GAME_WIDTH, 140, Palette.backdrop, 0.94)
    .setScrollFactor(0)
    .setDepth(Depth.Overlay);
  protectedZone.setInteractive();

  const trackTop = 230;
  const trackHeight = GAME_HEIGHT - 390;
  const track = scene.add
    .rectangle(GAME_WIDTH - 22, trackTop + trackHeight / 2, 8, trackHeight, 0x9aa3bd, 0.34)
    .setScrollFactor(0)
    .setDepth(Depth.Overlay + 3);
  const thumbHeight = Math.max(58, (GAME_HEIGHT / contentHeight) * trackHeight);
  const thumb = scene.add
    .rectangle(GAME_WIDTH - 22, trackTop + thumbHeight / 2, 14, thumbHeight, Palette.goldHex, 0.8)
    .setScrollFactor(0)
    .setDepth(Depth.Overlay + 4)
    .setInteractive({ useHandCursor: true });

  const updateThumb = (): void => {
    const availableTrack = trackHeight - thumbHeight;
    thumb.y = trackTop + thumbHeight / 2 + (camera.scrollY / maxScroll) * availableTrack;
  };
  const setScroll = (scrollY: number): void => {
    camera.setScroll(0, Phaser.Math.Clamp(scrollY, 0, maxScroll));
    updateThumb();
  };

  let dragging = false;
  let dragOffset = 0;
  const onWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: unknown,
    _dx: number,
    dy: number,
  ): void => {
    setScroll(camera.scrollY + dy);
  };
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.x < GAME_WIDTH - 52) return;
    dragging = true;
    dragOffset = pointer.y - thumb.y;
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging) return;
    const availableTrack = trackHeight - thumbHeight;
    const top = trackTop + thumbHeight / 2;
    const ratio = Phaser.Math.Clamp((pointer.y - dragOffset - top) / availableTrack, 0, 1);
    setScroll(ratio * maxScroll);
  };
  const onUp = (): void => {
    dragging = false;
  };

  scene.input.on('wheel', onWheel);
  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('wheel', onWheel);
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointerupoutside', onUp);
    track.destroy();
    thumb.destroy();
    protectedZone.destroy();
  });
}
