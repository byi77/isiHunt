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
      const walk = (
        objects: Phaser.GameObjects.GameObject[],
        inheritedAlpha = 1,
        clip?: Phaser.Geom.Rectangle,
      ): void => {
        for (const object of objects) {
          const item = object as Phaser.GameObjects.Container;
          if (!item.visible || !item.active || inheritedAlpha * item.alpha < 0.05) continue;
          // Die View liefert dieselbe Weltgeometrie wie ihre rechteckige Maske.
          const ownClip = item.data?.get('layoutClipRect') as Phaser.Geom.Rectangle | undefined;
          const effectiveClip =
            ownClip && clip ? Phaser.Geom.Rectangle.Intersection(ownClip, clip) : (ownClip ?? clip);
          if (object instanceof Phaser.GameObjects.Text) {
            const fullBounds = object.getBounds();
            const bounds = effectiveClip
              ? Phaser.Geom.Rectangle.Intersection(fullBounds, effectiveClip)
              : fullBounds;
            if (bounds.width > 0 && bounds.height > 0)
              texts.push({
                scene: scene.scene.key,
                text: object.text,
                rect: screenBox(bounds, object.scrollFactorX, object.scrollFactorY),
              });
          }
          if (object instanceof Phaser.GameObjects.Image && object.depth >= 0) {
            images.push({
              scene: scene.scene.key,
              texture: object.texture.key,
              frame: object.frame.name,
              rect: screenBox(object.getBounds(), object.scrollFactorX, object.scrollFactorY),
            });
          }
          if (
            object instanceof Phaser.GameObjects.Container &&
            inheritedAlpha * object.alpha >= 0.5 &&
            object.getData('layoutRole') === 'worldPlanet'
          ) {
            const matrix = object.getWorldTransformMatrix();
            const center = matrix.transformPoint(0, 0);
            images.push({
              scene: scene.scene.key,
              texture: 'world-planet-envelope',
              rect: screenBox(
                new Phaser.Geom.Rectangle(
                  center.x - object.width / 2,
                  center.y - object.height / 2,
                  object.width,
                  object.height,
                ),
              ),
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
            walk(object.list, inheritedAlpha * object.alpha, effectiveClip);
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
        performance: scenes
          .map((scene) => ({
            scene: scene.scene.key,
            report:
              (
                scene as Phaser.Scene & { getPerformanceReport?: () => unknown }
              ).getPerformanceReport?.() ?? null,
          }))
          .filter((entry) => entry.report !== null),
        texts,
        buttons,
        images,
        planetTextures: game.textures
          .getTextureKeys()
          .filter((key) => key.startsWith('world-sphere-'))
          .map((key) => {
            const source = game.textures.get(key).source[0]!;
            return { key, width: source.width, height: source.height };
          }),
        updateListeners: scenes.map((scene) => ({
          scene: scene.scene.key,
          count: scene.events.listenerCount(Phaser.Scenes.Events.UPDATE),
        })),
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
