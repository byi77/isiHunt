import Phaser from 'phaser';

interface Entry {
  button: HTMLButtonElement;
  container: Phaser.GameObjects.Container;
  width: number;
  height: number;
  activate: () => void;
  geometry?: string;
  shown?: boolean;
}
const registries = new WeakMap<Phaser.Scene, Set<Entry>>();

export function accessibleButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  label: string,
  width: number,
  height: number,
  activate: () => void,
): HTMLButtonElement {
  if (!document.getElementById('isihunt-accessibility-style')) {
    const style = document.createElement('style');
    style.id = 'isihunt-accessibility-style';
    style.textContent =
      '.isihunt-canvas-button{position:fixed;z-index:80;pointer-events:none;border:0;background:transparent;color:transparent;padding:0;border-radius:10px;outline:0}.isihunt-canvas-button:focus-visible{outline:3px solid #fff;outline-offset:2px;background:rgba(255,255,255,.08)}';
    document.head.append(style);
  }
  const button = document.createElement('button');
  button.className = 'isihunt-canvas-button';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.disabled = true;
  button.hidden = true;
  button.addEventListener('click', () => {
    if (!button.disabled && !button.hidden) activate();
  });
  document.body.append(button);
  let entries = registries.get(scene);
  if (!entries) {
    entries = new Set();
    registries.set(scene, entries);
    const worldMatrix = new Phaser.GameObjects.Components.TransformMatrix();
    const parentMatrix = new Phaser.GameObjects.Components.TransformMatrix();
    const projectedMatrix = new Phaser.GameObjects.Components.TransformMatrix();
    const topLeft = new Phaser.Math.Vector2();
    const bottomRight = new Phaser.Math.Vector2();
    const update = (): void => {
      const bounds = scene.game.canvas.getBoundingClientRect();
      const sx = bounds.width / scene.scale.width;
      const sy = bounds.height / scene.scale.height;
      for (const entry of entries!) {
        let visible =
          scene.scene.isActive() && scene.input.enabled && !!entry.container.input?.enabled;
        let parent: Phaser.GameObjects.Container | null = entry.container;
        while (parent) {
          visible &&= parent.visible && parent.alpha > 0;
          parent = parent.parentContainer;
        }
        const matrix = entry.container.getWorldTransformMatrix(worldMatrix, parentMatrix);
        let scrollFactorX = entry.container.scrollFactorX;
        let scrollFactorY = entry.container.scrollFactorY;
        parent = entry.container.parentContainer;
        while (parent) {
          scrollFactorX *= parent.scrollFactorX;
          scrollFactorY *= parent.scrollFactorY;
          parent = parent.parentContainer;
        }
        const camera = scene.cameras.main;
        projectedMatrix
          .copyWithScrollFactorFrom(
            camera.matrixCombined,
            camera.scrollX,
            camera.scrollY,
            scrollFactorX,
            scrollFactorY,
          )
          .multiply(matrix);
        let depth = entry.container.depth;
        parent = entry.container.parentContainer;
        while (parent) {
          depth = Math.max(depth, parent.depth);
          parent = parent.parentContainer;
        }
        for (const object of scene.children.list) {
          const blocker = object as Phaser.GameObjects.Image;
          if (
            !blocker.input?.enabled ||
            !blocker.visible ||
            !(blocker.alpha > 0) ||
            !(blocker.depth > depth) ||
            typeof blocker.getBounds !== 'function'
          )
            continue;
          const rect = blocker.getBounds();
          if (
            rect.left <= 0 &&
            rect.top <= 0 &&
            rect.right >= scene.scale.width &&
            rect.bottom >= scene.scale.height
          )
            visible = false;
        }
        projectedMatrix.transformPoint(-entry.width / 2, -entry.height / 2, topLeft);
        projectedMatrix.transformPoint(entry.width / 2, entry.height / 2, bottomRight);
        parent = entry.container.parentContainer;
        while (parent) {
          const clip = parent.getData('layoutClipRect') as Phaser.Geom.Rectangle | undefined;
          if (clip) visible &&= topLeft.y >= clip.top && bottomRight.y <= clip.bottom;
          parent = parent.parentContainer;
        }
        visible &&=
          topLeft.x >= 0 &&
          topLeft.y >= 0 &&
          bottomRight.x <= scene.scale.width &&
          bottomRight.y <= scene.scale.height;
        if (entry.shown !== visible) {
          entry.button.hidden = !visible;
          entry.button.disabled = !visible;
          entry.shown = visible;
        }
        const geometry = `${bounds.left + topLeft.x * sx},${bounds.top + topLeft.y * sy},${(bottomRight.x - topLeft.x) * sx},${(bottomRight.y - topLeft.y) * sy}`;
        if (entry.geometry === geometry) continue;
        entry.geometry = geometry;
        Object.assign(entry.button.style, {
          left: `${bounds.left + topLeft.x * sx}px`,
          top: `${bounds.top + topLeft.y * sy}px`,
          width: `${(bottomRight.x - topLeft.x) * sx}px`,
          height: `${(bottomRight.y - topLeft.y) * sy}px`,
        });
      }
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, update);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, update);
      for (const entry of entries!) entry.button.remove();
      entries!.clear();
      registries.delete(scene);
    });
  }
  const entry = { button, container, width, height, activate };
  entries.add(entry);
  container.once(Phaser.GameObjects.Events.DESTROY, () => {
    button.remove();
    entries!.delete(entry);
  });
  return button;
}
