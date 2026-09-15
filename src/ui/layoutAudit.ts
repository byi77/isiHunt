import Phaser from 'phaser';

/** Opt-in-Werkzeug: misst sichtbare Darstellung und tatsächliche rechteckige Trefferflächen. */
export function installLayoutAudit(game: Phaser.Game): void {
  if (document.getElementById('isihunt-layout-audit')) return;
  const panel = document.createElement('details');
  panel.id = 'isihunt-layout-audit';
  Object.assign(panel.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    zIndex: '2147483000',
    color: '#ffffff',
    background: '#101820',
    font: '11px monospace',
    maxWidth: '100vw',
    maxHeight: '70vh',
    overflow: 'auto',
  });
  const title = document.createElement('summary');
  title.textContent = 'Layoutprüfung';
  const refresh = document.createElement('button');
  refresh.textContent = 'Neu messen';
  const report = document.createElement('pre');
  report.id = 'isihunt-layout-report';
  panel.append(title, refresh, report);
  document.body.append(panel);

  const capture = (): void => {
    const canvas = game.canvas.getBoundingClientRect();
    const sx = canvas.width / game.scale.width;
    const sy = canvas.height / game.scale.height;
    const texts: unknown[] = [];
    const buttons: unknown[] = [];
    const images: unknown[] = [];
    const scenes = game.scene.getScenes(true);
    for (const scene of scenes) {
      const camera = scene.cameras.main;
      // Phaser nutzt diese Matrix beim Rendern, exportiert sie aber nicht im Camera-Typ.
      const cameraMatrix = (
        camera as unknown as {
          matrix: Phaser.GameObjects.Components.TransformMatrix;
        }
      ).matrix;
      const screenBox = (bounds: Phaser.Geom.Rectangle, scrollX = 1, scrollY = 1) => {
        const corners = [
          [bounds.left, bounds.top],
          [bounds.right, bounds.top],
          [bounds.right, bounds.bottom],
          [bounds.left, bounds.bottom],
        ].map(([x, y]) =>
          cameraMatrix.transformPoint(x! - camera.scrollX * scrollX, y! - camera.scrollY * scrollY),
        );
        const left = canvas.left + Math.min(...corners.map((p) => p.x)) * sx;
        const top = canvas.top + Math.min(...corners.map((p) => p.y)) * sy;
        const right = canvas.left + Math.max(...corners.map((p) => p.x)) * sx;
        const bottom = canvas.top + Math.max(...corners.map((p) => p.y)) * sy;
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };
      const walk = (objects: Phaser.GameObjects.GameObject[], inheritedAlpha = 1): void => {
        for (const object of objects) {
          const item = object as Phaser.GameObjects.Container;
          if (!item.visible || !item.active || inheritedAlpha * item.alpha < 0.05) continue;
          if (object instanceof Phaser.GameObjects.Text) {
            texts.push({
              scene: scene.scene.key,
              text: object.text,
              rect: screenBox(object.getBounds(), object.scrollFactorX, object.scrollFactorY),
            });
          }
          if (object instanceof Phaser.GameObjects.Image && object.depth >= 0) {
            images.push({
              scene: scene.scene.key,
              texture: object.texture.key,
              rect: screenBox(object.getBounds(), object.scrollFactorX, object.scrollFactorY),
            });
          }
          if (
            object instanceof Phaser.GameObjects.Container &&
            object.input?.hitArea instanceof Phaser.Geom.Rectangle
          ) {
            const hit = object.input.hitArea;
            const matrix = object.getWorldTransformMatrix();
            const a = matrix.transformPoint(
              hit.left - object.displayOriginX,
              hit.top - object.displayOriginY,
            );
            const b = matrix.transformPoint(
              hit.right - object.displayOriginX,
              hit.bottom - object.displayOriginY,
            );
            const data = object.getData('uiButton') as { label: string } | undefined;
            buttons.push({
              scene: scene.scene.key,
              label: data?.label ?? '(Container)',
              enabled: object.input.enabled,
              rect: screenBox(
                new Phaser.Geom.Rectangle(a.x, a.y, b.x - a.x, b.y - a.y),
                object.scrollFactorX,
                object.scrollFactorY,
              ),
            });
          }
          if (object instanceof Phaser.GameObjects.Container)
            walk(object.list, inheritedAlpha * object.alpha);
        }
      };
      walk(scene.children.list);
    }
    report.textContent = JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        viewport: { width: innerWidth, height: innerHeight },
        canvas: canvas.toJSON(),
        scenes: scenes.map((scene) => scene.scene.key),
        texts,
        buttons,
        images,
        domCanvases: [...document.querySelectorAll('canvas')].map((element) =>
          element.getBoundingClientRect().toJSON(),
        ),
      },
      null,
      2,
    );
  };
  refresh.addEventListener('click', capture);
  panel.addEventListener('toggle', () => {
    if (panel.open) capture();
  });
  game.events.once(Phaser.Core.Events.DESTROY, () => panel.remove());
}
