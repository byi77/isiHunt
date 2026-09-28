import Phaser from 'phaser';
import { getLastRunReport, PERFORMANCE_BUDGETS } from '@/systems/PerformanceSystem';

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
    // `body` sperrt Markieren und Gesten fuers Spiel (index.html). Hier muss
    // man den Bericht auf dem Handy markieren und scrollen koennen.
    userSelect: 'text',
    webkitUserSelect: 'text',
    touchAction: 'auto',
  });
  const title = document.createElement('summary');
  title.textContent = 'Layoutprüfung';
  const refresh = document.createElement('button');
  refresh.textContent = 'Neu messen';
  const share = document.createElement('button');
  share.textContent = 'Teilen';
  const summary = document.createElement('div');
  summary.id = 'isihunt-layout-summary';
  Object.assign(summary.style, { font: 'bold 13px monospace', margin: '6px 0' });
  const report = document.createElement('pre');
  report.id = 'isihunt-layout-report';
  panel.append(title, refresh, share, summary, report);

  // Auf iOS oeffnet das Teilen-Menue (Nachricht, Notizen, Mail); ohne
  // Web-Share landet der Bericht in der Zwischenablage. Markieren allein
  // reichte nicht: Der Bericht ist mehrere Bildschirme lang.
  share.addEventListener('click', () => {
    const text = `${summary.textContent ?? ''}\n\n${report.textContent ?? ''}`;
    if (typeof navigator.share === 'function') {
      navigator.share({ title: 'isiHunt Layoutprüfung', text }).catch(() => undefined);
      return;
    }
    navigator.clipboard?.writeText(text).then(
      () => (share.textContent = 'Kopiert'),
      () => (share.textContent = 'Kopieren fehlgeschlagen'),
    );
  });
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
    // Die drei Werte, die ueber die Bildrate entscheiden, als eine Zeile -
    // damit reicht zur Not ein Screenshot.
    const lastRun = getLastRunReport();
    summary.textContent = lastRun
      ? `Letzter Run: P95 ${lastRun.frameP95Ms.toFixed(1)} ms (Budget ${PERFORMANCE_BUDGETS.frameP95Ms}) · ` +
        `zu langsam ${(lastRun.frameOverBudgetRatio * 100).toFixed(1)} % ` +
        `(Budget ${PERFORMANCE_BUDGETS.frameOverBudgetRatio * 100} %) · ${lastRun.passed ? 'OK' : 'NICHT OK'}`
      : 'Noch kein Run gemessen - erst eine Jagd spielen.';
    report.textContent = JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        viewport: { width: innerWidth, height: innerHeight },
        canvas: canvas.toJSON(),
        scenes: scenes.map((scene) => scene.scene.key),
        lastRun,
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
