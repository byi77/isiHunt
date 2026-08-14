/**
 * Sichtbarmachung der Trefferflaechen. Nur im Dev-Build.
 *
 * ## Warum es das gibt
 *
 * Die Knoepfe liessen sich auf dem iPhone nicht zuverlaessig druecken. Zwei
 * Korrekturen aus reiner Ueberlegung heraus haben es nicht behoben - die eine
 * hat es sogar verschlimmert. Der Grund dafuer ist einfach: Es wurde geraten,
 * wo gemessen werden musste.
 *
 * Dieses Werkzeug zeichnet, was Phaser tatsaechlich fuer anfassbar haelt, und
 * schreibt jeden Tipp mit. Damit laesst sich in einer Minute entscheiden, was
 * sonst nur zu vermuten ist:
 *
 * | Beobachtung                                | Bedeutung                        |
 * | ------------------------------------------ | -------------------------------- |
 * | Rahmen liegt neben dem sichtbaren Knopf    | Koordinaten verschoben           |
 * | Rahmen liegt richtig, Punkt daneben        | Tippziel zu klein                |
 * | Punkt IM Rahmen, Knopf reagiert trotzdem nicht | Ereignis geht woanders hin   |
 *
 * Der dritte Fall ist der, den man ohne dieses Bild nie findet.
 *
 * Einschalten: `?hitboxes` an die Adresse haengen. Bleibt ueber Scene-Wechsel
 * hinweg aktiv, weil der Wert in der Adresse steht und nicht im Zustand.
 */

import Phaser from 'phaser';

import { DEBUG_ENABLED } from '@/config/GameConfig';

/** Ganz oben - ueber allem, auch ueber Einblendungen. */
const DEBUG_DEPTH = 10_000;

export function isHitDebugEnabled(): boolean {
  if (!DEBUG_ENABLED) return false;
  return new URLSearchParams(window.location.search).has('hitboxes');
}

/**
 * Schreibt die Messwerte in ein HTML-Element ueber dem Canvas.
 *
 * Warum nicht in die Konsole: Auf einem iPhone ohne angeschlossenen Mac ist die
 * Konsole nicht erreichbar. Diese Anzeige laesst sich abfotografieren.
 */
function ensurePanel(): HTMLElement {
  const existing = document.getElementById('hit-debug-panel');
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = 'hit-debug-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    right: '0',
    zIndex: '99999',
    background: 'rgba(0,0,0,0.88)',
    color: '#00ff88',
    font: '12px/1.35 monospace',
    padding: '6px 8px',
    whiteSpace: 'pre-wrap',
    pointerEvents: 'none',
  });
  document.body.appendChild(panel);
  return panel;
}

/**
 * Zeichnet die Trefferflaeche jedes interaktiven Objekts der Scene und markiert
 * jeden Tipp.
 *
 * Bewusst in `update` neu gezeichnet statt einmalig: Objekte kommen und gehen
 * (Pause-Bildschirm, Ergebnisphasen), und ein veraltetes Bild waere schlimmer
 * als keines.
 */
export function attachHitDebug(scene: Phaser.Scene): void {
  if (!isHitDebugEnabled()) return;

  const graphics = scene.add.graphics().setDepth(DEBUG_DEPTH).setScrollFactor(0);

  const readout = scene.add
    .text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#00ff88',
      backgroundColor: '#000000cc',
      padding: { x: 6, y: 4 },
    })
    .setDepth(DEBUG_DEPTH)
    .setScrollFactor(0);

  /** Letzte Tipps, damit ein Fehlgriff sichtbar stehen bleibt. */
  const taps: { x: number; y: number; hit: boolean }[] = [];

  scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    // `hitTest` fragt Phaser selbst - genau das, was beim echten Tipp passiert.
    const under = scene.input.hitTestPointer(pointer);
    taps.push({ x: pointer.worldX, y: pointer.worldY, hit: under.length > 0 });
    if (taps.length > 12) taps.shift();

    const names = under.map((o) => o.constructor.name).join(', ') || 'NICHTS';

    // Die gesamte Umrechnungskette nachrechnen, Schritt fuer Schritt. Wenn der
    // Tipp woanders landet, als er gehoert, weicht genau eine dieser Zeilen ab.
    const scale = scene.scale;
    const bounds = scale.canvasBounds;
    const rect = scale.canvas.getBoundingClientRect();

    // Was Phaser rechnet, gegen das, was mit frisch gemessenem Rechteck
    // herauskaeme. Eine Abweichung heisst: die Masse sind veraltet.
    const erwartetX = (pointer.event as PointerEvent).clientX ?? 0;
    const frischX = ((erwartetX - rect.left) * scale.baseSize.width) / rect.width;

    readout.setText(
      [
        `Spiel      ${pointer.worldX.toFixed(0)} / ${pointer.worldY.toFixed(0)}`,
        `frisch     ${frischX.toFixed(0)}   Abweichung ${(pointer.worldX - frischX).toFixed(0)}`,
        `Getroffen  ${names}`,
        `bounds  l=${bounds.left.toFixed(1)} w=${bounds.width.toFixed(1)}`,
        `rect    l=${rect.left.toFixed(1)} w=${rect.width.toFixed(1)}`,
        `dScale  ${scale.displayScale.x.toFixed(3)} / ${scale.displayScale.y.toFixed(3)}`,
        `zoom ${scale.zoom}  dpr ${window.devicePixelRatio}`,
      ].join('\n'),
    );

    // Fuer jedes interaktive Objekt: wo liegt es, und trifft der Tipp hinein?
    // Das ist die entscheidende Gegenueberstellung - sie zeigt, ob Phaser ein
    // ANDERES Objekt meldet als dasjenige, in dessen Flaeche der Tipp faellt.
    const zeilen: string[] = [];
    for (const object of scene.children.list) {
      const io = object.input;
      if (!io?.enabled) continue;

      const src = object as unknown as { x: number; y: number; width?: number };
      const w = src.width ?? 0;
      if (w <= 0) continue;

      const links = src.x - w / 2;
      const rechts = src.x + w / 2;
      const drin = pointer.worldX >= links && pointer.worldX <= rechts;
      const gemeldet = under.includes(object);

      if (drin || gemeldet) {
        zeilen.push(
          `  ${links.toFixed(0)}..${rechts.toFixed(0)}` +
            ` drin=${drin ? 'JA' : 'nein'} phaser=${gemeldet ? 'JA' : 'nein'}` +
            (drin !== gemeldet ? '  << WIDERSPRUCH' : ''),
        );
      }
    }

    ensurePanel().textContent = [
      `Tipp Spiel  ${pointer.worldX.toFixed(0)} / ${pointer.worldY.toFixed(0)}`,
      `client      ${erwartetX.toFixed(1)}   frisch ${frischX.toFixed(0)}  Abw ${(pointer.worldX - frischX).toFixed(0)}`,
      `bounds  l=${bounds.left.toFixed(1)} w=${bounds.width.toFixed(1)}`,
      `rect    l=${rect.left.toFixed(1)} w=${rect.width.toFixed(1)}`,
      `dScale  ${scale.displayScale.x.toFixed(4)}  base ${scale.baseSize.width}`,
      `Pointer ${scene.input.manager.pointersTotal}  Scene ${scene.scene.key}`,
      `getroffen: ${names}`,
      ...zeilen,
    ].join('\n');

    console.warn('[hitDebug]', {
      spiel: [Math.round(pointer.worldX), Math.round(pointer.worldY)],
      frisch: Math.round(frischX),
      abweichung: Math.round(pointer.worldX - frischX),
      bounds: { l: bounds.left, w: bounds.width },
      rect: { l: rect.left, w: rect.width },
      displayScale: [scale.displayScale.x, scale.displayScale.y],
      getroffen: names,
      zeilen,
    });
  });

  runHitAreaSelfTest(scene);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.removeAllListeners('pointerdown');
  });

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
    graphics.clear();

    for (const object of scene.children.list) {
      const input = (object as Phaser.GameObjects.GameObject).input;
      if (!input?.enabled) continue;

      const shape = input.hitArea as Phaser.Geom.Rectangle | undefined;
      if (!shape || typeof shape.width !== 'number') continue;

      const source = object as unknown as {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        originX?: number;
        originY?: number;
        width?: number;
        height?: number;
      };

      // Die Trefferflaeche liegt in den Koordinaten des Objekts und wird von
      // Phaser mit dessen Skalierung verrechnet - hier genauso, damit das
      // gezeichnete Rechteck wirklich das ist, was getestet wird.
      const originX = source.originX ?? 0;
      const originY = source.originY ?? 0;
      const offsetX = originX * (source.width ?? 0);
      const offsetY = originY * (source.height ?? 0);

      const left = source.x + (shape.x - offsetX) * source.scaleX;
      const top = source.y + (shape.y - offsetY) * source.scaleY;

      graphics.lineStyle(2, 0x00ff88, 0.9);
      graphics.strokeRect(left, top, shape.width * source.scaleX, shape.height * source.scaleY);
    }

    for (const tap of taps) {
      graphics.fillStyle(tap.hit ? 0x00ff88 : 0xff3355, 0.9);
      graphics.fillCircle(tap.x, tap.y, 7);
    }
  });
}

/**
 * Misst fuer jedes interaktive Objekt, wo es TATSAECHLICH reagiert.
 *
 * Statt zu rechnen, wo die Trefferflaeche liegen sollte, wird sie abgetastet:
 * Von der Objektmitte aus wird nach links und rechts geprueft, bis Phaser das
 * Objekt nicht mehr meldet. Der Vergleich der beiden Distanzen sagt sofort, ob
 * die Flaeche mittig sitzt.
 *
 * Warum das noetig war: Vier Anlaeufe an demselben Fehler beruhten auf
 * Ueberlegungen darueber, was Phaser wohl tut. Diese Funktion fragt es.
 */
function runHitAreaSelfTest(scene: Phaser.Scene): void {
  // Ein Frame warten, damit alle Objekte der Scene angelegt sind.
  scene.time.delayedCall(0, () => {
    const manager = scene.input.manager;
    const report: Record<string, string>[] = [];

    for (const object of scene.children.list) {
      const input = object.input;
      if (!input?.enabled) continue;

      const source = object as unknown as { x: number; y: number; width?: number };
      const width = source.width ?? 0;
      if (width <= 0) continue;

      /** Meldet Phaser dieses Objekt an dieser Weltposition? */
      const hits = (worldX: number): boolean => {
        const point = new Phaser.Math.Vector2(worldX, source.y);
        return manager.pointWithinHitArea(
          object,
          point.x - source.x + (object as unknown as { displayOriginX: number }).displayOriginX,
          point.y - source.y + (object as unknown as { displayOriginY: number }).displayOriginY,
        );
      };

      let left = 0;
      while (left < width && hits(source.x - left - 1)) left++;

      let right = 0;
      while (right < width && hits(source.x + right + 1)) right++;

      const versatz = (right - left) / 2;
      report.push({
        Objekt: object.constructor.name,
        x: String(Math.round(source.x)),
        Breite: String(Math.round(width)),
        links: String(left),
        rechts: String(right),
        Versatz: versatz === 0 ? 'mittig' : `${versatz > 0 ? '+' : ''}${Math.round(versatz)} px`,
      });
    }

    if (report.length > 0) {
      console.warn(
        `[hitDebug] Trefferflächen in ${scene.scene.key}:\n` +
          report
            .map(
              (row) =>
                `  ${row.Objekt?.padEnd(12)} x=${row.x?.padStart(4)} b=${row.Breite?.padStart(4)}` +
                `  links=${row.links?.padStart(4)} rechts=${row.rechts?.padStart(4)}  ${row.Versatz}`,
            )
            .join('\n'),
      );
    }
  });
}
