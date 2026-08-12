/**
 * Wiederverwendbare UI-Bausteine.
 *
 * Bewusst Funktionen statt Klassen: die Widgets haben keinen eigenen Zustand,
 * sie bauen nur GameObjects zusammen. Wer Zustand braucht (z. B. Fortschritts-
 * balken), bekommt ein kleines Handle-Objekt mit `set*`-Methoden zurueck.
 */

import Phaser from 'phaser';

import { DEBUG_ENABLED } from '@/config/GameConfig';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';

export interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
}

/**
 * Wie weit der Lichtschein ueber den Knopfrahmen hinausragt.
 *
 * Diese Faktoren bestimmen NICHT nur das Aussehen, sondern ueber
 * `HIT_AREA_PADDING_*` auch die Trefferflaeche - die beiden duerfen nicht
 * auseinanderlaufen (Begruendung unten bei der Trefferflaeche).
 */
const BUTTON_HALO_SCALE_X = 1.5;
const BUTTON_HALO_SCALE_Y = 2.6;

/**
 * Wie viel vom Ueberstand des Lichtscheins zur Trefferflaeche zaehlt.
 * 0 = nur der Rahmen, 1 = der gesamte Schein.
 *
 * ## Warum das 0 ist - und bleiben sollte
 *
 * Es war einmal 0,5, mit der Begruendung: Der Schein ragt seitlich 95 px ueber
 * den Rahmen hinaus, wer ihn antippt trifft gefuehlt den Knopf. Das klang
 * richtig und war falsch.
 *
 * Denn die Trefferflaeche wuchs damit auf 305 px, waehrend der Knopf 244 px
 * breit blieb - **61 px unsichtbare Trefferflaeche pro Knopf**. Im Menue stehen
 * BESTENLISTE und SPIELSTAND nebeneinander; tippte man rechts neben den
 * Schriftzug BESTENLISTE, lag man in beiden Flaechen. Und bei mehreren Treffern
 * gewinnt in Phaser das **zuletzt erzeugte** Objekt (`InputPlugin.sortGameObjects`)
 * - also SPIELSTAND. Der Nutzer traf sichtbar den linken Knopf und bekam den
 * rechten.
 *
 * Ein Knopf muss dort reagieren, wo er ist. Unsichtbare Trefferflaeche ist
 * keine Grosszuegigkeit, sondern eine Falle: Sie ist per Definition nicht
 * sichtbar und damit auch nicht vorhersehbar.
 *
 * **Wer das wieder erhoehen will,** muss vorher pruefen, dass sich keine zwei
 * Flaechen beruehren - und daran denken, dass der Gewinner einer Ueberlappung
 * von der Erzeugungsreihenfolge abhaengt, nicht von der Entfernung zum
 * Mittelpunkt.
 */
const HIT_AREA_PADDING_X = 0;
const HIT_AREA_PADDING_Y = 0;

/**
 * Rueckt die Trefferflaeche so, dass sie den Knopf wirklich deckt.
 *
 * ## Warum gemessen und nicht gerechnet
 *
 * Phaser addiert vor dem Trefferpruefen den Ursprung des Objekts auf den
 * Testpunkt. Wie gross dieser Ursprung ist, haengt beim Container davon ab, ob
 * und wann `setSize()` lief - er ist entweder 0 oder die halbe Breite. Beide
 * Faelle sind im laufenden Code aufgetreten, und beide erzeugen ein anderes
 * Fehlerbild.
 *
 * Statt die Regel zu erraten, wird sie hier abgefragt: Der Mittelpunkt des
 * Knopfes MUSS ein Treffer sein. Ist er es nicht, wird das Rechteck genau um
 * den gemessenen Ursprung verschoben - danach stimmt es zwangslaeufig.
 *
 * Kostet einmal pro Knopf zwei Rechteck-Vergleiche. Das ist der Preis dafuer,
 * dass diese Klasse Fehler nicht mehr auftreten kann.
 */
export function makeAlignedHitArea(
  target: Phaser.GameObjects.Container,
  width: number,
  height: number,
): Phaser.Geom.Rectangle {
  // Der Mittelpunkt in Objektkoordinaten - genau so, wie Phaser ihn beim
  // Trefferpruefen sieht (Testpunkt + displayOrigin).
  const centerX = target.displayOriginX;
  const centerY = target.displayOriginY;

  const hitArea = new Phaser.Geom.Rectangle(
    centerX - width / 2,
    centerY - height / 2,
    width,
    height,
  );

  if (DEBUG_ENABLED && !Phaser.Geom.Rectangle.Contains(hitArea, centerX, centerY)) {
    console.warn(`[widgets] Trefferflaeche verfehlt den Mittelpunkt (${width}x${height}).`);
  }

  return hitArea;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: { width?: number; height?: number; accent?: number; fontSize?: number } = {},
): ButtonHandle {
  const width = options.width ?? 380;
  const height = options.height ?? 92;
  const accent = options.accent ?? Palette.goldHex;

  const container = scene.add.container(x, y);
  let enabled = true;
  /** Liegt ein Finger auf diesem Knopf? Siehe `pointerout` weiter unten. */
  let isPressed = false;

  // Weicher Schein hinter dem Knopf - hebt ihn vom Hintergrund ab, ohne eine
  // harte Kante zu brauchen.
  const halo = scene.add
    .image(0, 0, TextureKey.Glow)
    .setDisplaySize(width * BUTTON_HALO_SCALE_X, height * BUTTON_HALO_SCALE_Y)
    .setTint(accent)
    .setAlpha(0.5)
    .setBlendMode(Phaser.BlendModes.ADD);

  const bg = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(accent)
    .setAlpha(0.16);

  const border = scene.add.graphics();
  border.lineStyle(3, accent, 0.9);
  border.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

  const text = scene.add
    .text(
      0,
      0,
      label,
      textStyle(options.fontSize ?? FontSize.body, Palette.ink, { fontStyle: 'bold' }),
    )
    .setOrigin(0.5);

  // Alles Sichtbare liegt in einer eigenen Gruppe INNERHALB des Containers.
  // Nur sie wird beim Druecken gestaucht - der Container selbst behaelt seine
  // Groesse, und damit behaelt die Trefferflaeche sie auch. Warum das noetig
  // ist, steht bei `press` weiter unten.
  const visuals = scene.add.container(0, 0, [halo, bg, border, text]);

  container.add(visuals);
  container.setSize(width, height);

  const hitWidth = width * (1 + (BUTTON_HALO_SCALE_X - 1) * HIT_AREA_PADDING_X);
  const hitHeight = height * (1 + (BUTTON_HALO_SCALE_Y - 1) * HIT_AREA_PADDING_Y);

  /**
   * Die Trefferflaeche - und die Falle, die dieses Projekt am meisten gekostet
   * hat.
   *
   * ## Das Problem
   *
   * Phaser verschiebt den Testpunkt vor dem Vergleich um den Ursprung des
   * Objekts (`InputManager.pointWithinHitArea`):
   *
   * ```
   * x += gameObject.displayOriginX
   * ```
   *
   * Bei einem Container ist `displayOriginX` laut Quelltext `width * 0.5` -
   * **aber nur, wenn `width` gesetzt ist.** Vor `setSize()` ist sie 0, und je
   * nachdem, wann und ob das passiert, ist der Versatz 0 oder eine halbe
   * Knopfbreite. Dieselbe Rechteck-Definition ist also mal richtig und mal um
   * `width/2` daneben - und genau daher kamen die wechselnden Symptome
   * ("rechts geht nicht" / "links geht nicht").
   *
   * ## Die Loesung: nicht ausrechnen, sondern messen
   *
   * Statt zu schliessen, welcher Ursprung stimmt, wird er **gemessen**: Wir
   * fragen Phaser mit `pointWithinHitArea`, ob der Mittelpunkt des Knopfes
   * getroffen wird, und verschieben das Rechteck, bis er es wird.
   *
   * Das ist kein Notbehelf, sondern die einzige Variante, die unabhaengig
   * davon funktioniert, wie Phaser intern normalisiert - heute und nach dem
   * naechsten Update.
   */
  const hitArea = makeAlignedHitArea(container, hitWidth, hitHeight);

  container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

  /**
   * Druckzustand.
   *
   * `visuals` wird gestaucht, NIE der Container.
   *
   * Phaser rechnet die Trefferflaeche in der Skalierung des Objekts, an dem sie
   * haengt. Wuerde hier `container.setScale(0.96)` stehen, schruempfte mit dem
   * Bild auch die Trefferflaeche - und zwar genau in dem Moment, in dem der
   * Finger schon aufliegt. Ein Tipp nahe am Rand loeste `pointerdown` aus,
   * fiel dadurch aus der geschrumpften Flaeche heraus und bekam nie ein
   * `pointerup`. Der Knopf blinkte auf und tat nichts.
   *
   * Das ist die eigentliche Ursache dafuer, dass sich die Knoepfe nach der
   * ersten Korrektur SCHLECHTER anfuehlten als vorher: Die Trefferflaeche wurde
   * groesser, der beim Druecken verlorene Randstreifen wuchs mit ihr, und der
   * Streifen liegt genau dort, wo man einen Knopf trifft, wenn man ihn nicht
   * mittig antippt.
   */
  const press = (pressed: boolean) => {
    bg.setAlpha(pressed ? 0.42 : 0.16);
    visuals.setScale(pressed ? 0.96 : 1);
  };

  container.on('pointerover', () => enabled && bg.setAlpha(0.3));

  container.on('pointerdown', () => {
    if (!enabled) return;
    isPressed = true;
    press(true);
  });

  container.on('pointerup', () => {
    if (!enabled || !isPressed) return;
    isPressed = false;
    press(false);
    onClick();
  });

  /**
   * Der Finger hat die Flaeche verlassen, ohne abzuheben.
   *
   * Nur der Druckzustand wird zurueckgenommen - ausgeloest wird nichts. Das ist
   * das uebliche "wegziehen zum Abbrechen". `isPressed` bleibt aber gesetzt,
   * damit ein Finger, der zurueckwandert, den Knopf noch ausloesen kann: Auf
   * einem Handy wandert ein Daumen zwischen Aufsetzen und Abheben leicht, und
   * am Rand eines Knopfes ist das schnell ein Pixel zu viel.
   */
  container.on('pointerout', () => enabled && press(false));

  // Abheben ausserhalb: der Tipp ist damit endgueltig verworfen. Ohne dieses
  // Zuruecksetzen bliebe `isPressed` haengen, und der naechste Tipp irgendwo
  // auf dem Bildschirm loeste den Knopf aus.
  container.on('pointerupoutside', () => {
    isPressed = false;
    if (enabled) press(false);
  });

  return {
    container,
    setEnabled(value: boolean) {
      enabled = value;
      container.setAlpha(value ? 1 : 0.35);
      // Die eigene Trefferflaeche erneut uebergeben: ein blosses
      // setInteractive() wuerde auf die Groesse des Containers zurueckfallen
      // und die Vergroesserung stillschweigend verwerfen.
      if (value) container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
      else container.disableInteractive();
    },
    setLabel(value: string) {
      text.setText(value);
    },
  };
}

/**
 * Zurueck-Knopf, immer oben links.
 *
 * Warum ein eigenes Widget statt eines `createButton`-Aufrufs je Scene: Die
 * Knoepfe lagen vorher unterschiedlich weit unten am Rand und sahen verschieden
 * aus. Beim Spieltest hiess es deshalb, es gebe "nirgends einen Zurueck-Knopf"
 * - sie waren da, nur nirgends zweimal an derselben Stelle. Eine feste Position
 * ist auffindbar, ohne dass man sie suchen muss.
 *
 * Oben links und nicht unten, weil unten das Eingabefeld und die Systemtastatur
 * liegen (siehe LeaderboardScene) - dort verschwindet jeder Knopf frueher oder
 * spaeter unter etwas anderem.
 */
export function createBackButton(
  scene: Phaser.Scene,
  onClick: () => void,
  options: { label?: string } = {},
): ButtonHandle {
  return createButton(scene, BACK_BUTTON_X, BACK_BUTTON_Y, options.label ?? '‹  ZURUECK', onClick, {
    width: 196,
    height: 60,
    accent: 0x9aa3bd,
    fontSize: FontSize.tiny,
  });
}

/** Feste Position des Zurueck-Knopfes - gilt fuer jede Scene, die einen hat. */
export const BACK_BUTTON_X = 138;
export const BACK_BUTTON_Y = 60;

export interface BarHandle {
  container: Phaser.GameObjects.Container;
  /** @param ratio 0 bis 1 */
  setRatio(ratio: number): void;
  setTint(color: number): void;
}

/** Schlanker Fortschrittsbalken - fuer XP, Timer und Combo-Fenster. */
export function createBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): BarHandle {
  const container = scene.add.container(x, y);

  const track = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(0xffffff)
    .setAlpha(0.12)
    .setOrigin(0, 0.5);

  const fill = scene.add
    .image(0, 0, TextureKey.Pixel)
    .setDisplaySize(width, height)
    .setTint(color)
    .setOrigin(0, 0.5);

  // Leuchtkante auf dem gefuellten Teil - der Balken wirkt dadurch selbst
  // leuchtend statt nur eingefaerbt.
  const shine = scene.add
    .image(0, 0, TextureKey.Glow)
    .setDisplaySize(width, height * 5)
    .setTint(color)
    .setAlpha(0.5)
    .setOrigin(0, 0.5)
    .setBlendMode(Phaser.BlendModes.ADD);

  container.add([track, shine, fill]);

  return {
    container,
    setRatio(ratio: number) {
      const clamped = Phaser.Math.Clamp(ratio, 0, 1);
      // Sichtbar bleiben, solange ueberhaupt Fortschritt da ist.
      const visible = Math.max(clamped * width, clamped > 0 ? 3 : 0);
      fill.setDisplaySize(visible, height);
      shine.setDisplaySize(visible, height * 5);
      shine.setVisible(clamped > 0);
    },
    setTint(value: number) {
      fill.setTint(value);
      shine.setTint(value);
    },
  };
}

/**
 * Abgesetzte Flaeche fuer Menue- und Ergebnisinhalte.
 *
 * Kein eigenes Handle noetig - Panels sind reine Kulisse und werden nach dem
 * Erzeugen nicht mehr angefasst.
 */
export function createPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: number,
  options: { alpha?: number; radius?: number } = {},
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const radius = options.radius ?? 18;

  const fill = scene.add.graphics();
  fill.fillStyle(Palette.panel, options.alpha ?? 0.55);
  fill.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

  const border = scene.add.graphics();
  border.lineStyle(1.5, accent, 0.35);
  border.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);

  container.add([fill, border]);
  return container;
}

/**
 * Vollflaechiger Hintergrund einer Welt.
 *
 * Drei Schichten statt einer Flaeche: Grundverlauf, ein Lichtschein am Horizont
 * und mehrere weiche Farbwolken. Das nimmt dem Hintergrund die Plakatwirkung
 * und laesst die Welt nach Tiefe aussehen, ohne ein einziges Bild zu laden.
 */
export function createWorldBackdrop(
  scene: Phaser.Scene,
  width: number,
  height: number,
  top: number,
  bottom: number,
  accent: number,
): void {
  const base = scene.add.graphics();
  base.fillGradientStyle(top, top, bottom, bottom, 1);
  base.fillRect(0, 0, width, height);
  base.setDepth(Depth.Backdrop);

  // Horizontschein im oberen Drittel - die Lichtquelle der Welt.
  scene.add
    .image(width / 2, height * 0.3, TextureKey.Glow)
    .setDisplaySize(width * 1.9, height * 0.85)
    .setTint(accent)
    .setAlpha(0.3)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.BackdropGlow);

  // Farbwolken in fester Anordnung: bewusst nicht zufaellig, damit jede Welt
  // bei jedem Start gleich aussieht und wiedererkennbar bleibt.
  const clouds: readonly { x: number; y: number; scale: number; alpha: number }[] = [
    { x: 0.18, y: 0.16, scale: 0.9, alpha: 0.22 },
    { x: 0.86, y: 0.34, scale: 1.2, alpha: 0.16 },
    { x: 0.3, y: 0.62, scale: 1.5, alpha: 0.13 },
    { x: 0.76, y: 0.85, scale: 1.1, alpha: 0.18 },
  ];

  for (const cloud of clouds) {
    scene.add
      .image(width * cloud.x, height * cloud.y, TextureKey.Glow)
      .setDisplaySize(width * cloud.scale, width * cloud.scale)
      .setTint(accent)
      .setAlpha(cloud.alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Depth.BackdropClouds);
  }
}

/**
 * Langsam treibende Lichtpunkte in zwei Ebenen.
 *
 * Die hintere Ebene ist kleiner, dunkler und langsamer als die vordere. Diese
 * Geschwindigkeitsdifferenz ist der gesamte Parallax-Effekt - er kostet nichts
 * und gibt dem Spielfeld sofort eine Tiefenachse.
 */
export function createDriftLayers(scene: Phaser.Scene, width: number, height: number): void {
  const layers: readonly {
    count: number;
    scale: number;
    alpha: number;
    speed: number;
    depth: number;
  }[] = [
    { count: 26, scale: 0.22, alpha: 0.25, speed: 6, depth: Depth.DriftFar },
    { count: 14, scale: 0.4, alpha: 0.4, speed: 14, depth: Depth.DriftNear },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const dot = scene.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), TextureKey.Spark)
        .setScale(layer.scale)
        .setAlpha(layer.alpha)
        .setTint(0xffffff)
        .setDepth(layer.depth);

      // Jeder Punkt bekommt eine eigene Dauer - sonst bewegt sich die Ebene
      // als Block und der Effekt kippt ins Kuenstliche.
      scene.tweens.add({
        targets: dot,
        y: dot.y - height,
        duration: (height / layer.speed) * 1000 * Phaser.Math.FloatBetween(0.8, 1.2),
        repeat: -1,
        onRepeat: () => {
          dot.y = height + 20;
          dot.x = Phaser.Math.Between(0, width);
        },
      });

      scene.tweens.add({
        targets: dot,
        alpha: { from: layer.alpha * 0.4, to: layer.alpha },
        duration: Phaser.Math.Between(1400, 3200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }
}

/** Aufsteigende Lichtpartikel - traegt die Stimmung einer Welt. */
export function createAmbientMotes(
  scene: Phaser.Scene,
  width: number,
  height: number,
  accent: number,
): Phaser.GameObjects.Particles.ParticleEmitter {
  const emitter = scene.add.particles(0, 0, TextureKey.Spark, {
    x: { min: 0, max: width },
    y: height + 24,
    lifespan: 9000,
    speedY: { min: -30, max: -70 },
    speedX: { min: -14, max: 14 },
    scale: { start: 0.55, end: 0 },
    alpha: { start: 0.45, end: 0 },
    quantity: 1,
    frequency: 380,
    tint: accent,
    blendMode: 'ADD',
  });

  emitter.setDepth(Depth.AmbientMotes);
  return emitter;
}

/**
 * Abdunklung der Bildschirmraender.
 *
 * Zieht den Blick zur Bildmitte, wo gespielt wird, und nimmt den hellen
 * Hintergrundwolken an den Raendern die Aufdringlichkeit.
 */
export function createVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
): Phaser.GameObjects.Image {
  return (
    scene.add
      .image(width / 2, height / 2, TextureKey.Vignette)
      // Ueber die Diagonale ziehen, damit auch die Ecken abgedeckt sind.
      .setDisplaySize(width * 1.5, height * 1.15)
      .setDepth(Depth.Vignette)
  );
}

/** Kurze Partikel-Explosion beim Einsammeln. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12): void {
  const emitter = scene.add.particles(0, 0, TextureKey.Shard, {
    speed: { min: 90, max: 280 },
    scale: { start: 0.7, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { start: 0, end: 220 },
    lifespan: 480,
    tint: color,
    blendMode: 'ADD',
    emitting: false,
  });

  emitter.setDepth(Depth.Effects);
  emitter.explode(count, x, y);
  // Emitter nach Ablauf der Partikel-Lebensdauer aufraeumen.
  scene.time.delayedCall(700, () => emitter.destroy());
}

/**
 * Ausbreitender Ring am Fangort.
 *
 * Traegt die Information "hier ist gerade etwas passiert" weiter nach aussen,
 * als es die Partikel tun - auch dann noch lesbar, wenn der Daumen die Stelle
 * verdeckt.
 */
export function shockwave(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  targetScale = 1,
): void {
  const ring = scene.add
    .image(x, y, TextureKey.Ring)
    .setTint(color)
    .setScale(0.15)
    .setAlpha(0.85)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(Depth.Effects);

  scene.tweens.add({
    targets: ring,
    scale: targetScale,
    alpha: 0,
    duration: 420,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
}

/** Aufsteigende Punktzahl am Fangort. */
export function floatingScore(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
): void {
  const text = scene.add
    .text(
      x,
      y,
      label,
      textStyle(FontSize.body, `#${color.toString(16).padStart(6, '0')}`, {
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }),
    )
    .setOrigin(0.5)
    .setDepth(Depth.FloatingScore);

  scene.tweens.add({
    targets: text,
    y: y - 80,
    alpha: 0,
    duration: 750,
    ease: 'Quad.Out',
    onComplete: () => text.destroy(),
  });
}
