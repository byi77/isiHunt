import type Phaser from 'phaser';
import { COLLECTION_VISUALS as V } from '@/config/collectionVisuals';
import { RARITY_IDS, type RarityDef } from '@/config/rarities';
import { prefersReducedMotion, rarityMarker } from '@/systems/AccessibilitySystem';
import {
  boxesOverlap,
  collectionLabelBox,
  collectionPoint,
  type EffectBox,
  type Point,
} from './collectionMotion';
import { Depth } from './depth';
import { textStyle } from './theme';

/*
 * Die Druckwelle einer gefangenen Punktzahl.
 *
 * Keine Balancing-Werte, sondern die Form einer Bewegung - sie veraendern
 * nichts am Spiel, nur daran, wie sich ein Fang anfuehlt. Die Budgets, die
 * tatsaechlich begrenzen (Lebensdauer, Anzahl), stehen dagegen in
 * `config/collectionVisuals.ts`.
 *
 * Dieselbe Bewegung wie in `widgets.ts` fuer Straf- und Hindernisanzeigen -
 * absichtlich, damit ein Fang und ein Treffer dieselbe Sprache sprechen. Die
 * Umsetzung unterscheidet sich trotzdem: Dort traegt ein Tween je Anzeige die
 * Bewegung, hier rechnet ein gemeinsamer Takt sie fuer bis zu acht
 * gleichzeitige Faenge aus dem Alter.
 */

/** Groesse zu Beginn, als Anteil der Lesegroesse. Der Anlauf des Schlags. */
const LABEL_START = 0.4;

/** Wie lange der Aufschlag auf Lesegroesse dauert. */
const LABEL_HIT_MS = 70;

/** Wie weit sich die Zahl bis zum Verschwinden zusaetzlich ausdehnt. */
const LABEL_END_SCALE = 1.7;

/** Ein Gluecktreffer reisst weiter auf - er ist der seltenere Moment. */
const LABEL_END_SCALE_CRIT = 2.4;

/** Wie weit sie dabei nach oben davonzieht. */
const LABEL_RISE_PX = 46;

interface Capture {
  origin: Point;
  color: number;
  rank: number;
  age: number;
  reduced: boolean;
  /** Gluecktreffer - reisst weiter auf als ein normaler Fang. */
  crit: boolean;
  label: Phaser.GameObjects.Text;
  box: EffectBox | null;
}

/** One graphics layer and at most eight labels; no emitter/tween per catch. */
export class CollectionEffects {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly clip: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private captures: Capture[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: () => Point,
    private readonly bounds: () => EffectBox,
    private readonly reducedMotion: () => boolean = prefersReducedMotion,
  ) {
    // Live targets and hazards always draw over the decoration.
    this.graphics = scene.add.graphics().setDepth(Depth.Collectible - 1);
    this.clip = scene.add.graphics().setVisible(false);
    this.mask = this.clip.createGeometryMask();
    this.graphics.setMask(this.mask);
  }

  add(origin: Point, rarity: RarityDef, points: number, crit = false): void {
    if (this.captures.length >= V.maxActive) this.captures.shift()!.label.destroy();
    const unit = 720 / Math.max(1, this.scene.game.canvas.getBoundingClientRect().width);
    const rank = RARITY_IDS.indexOf(rarity.id);
    // Im Spielfeld steht nur die Zahl - und zwar in der Farbe der Seltenheit.
    //
    // Frueher trug dieses Label drei Zeilen: Seltenheitssymbol und -name,
    // Serienbonus und XP. Im Moment des Fangs ist davon nur eines
    // interessant, naemlich wie viel es gab; der Rest zwang zum Lesen,
    // waehrend das Spiel weiterlief (gemeldet 2026-09-19). Serienbonus und
    // XP stehen jetzt oben im HUD, wo ohnehin schon SERIE und Multiplikator
    // liegen - dort kann man sie ansehen, wenn man will, statt sie zu
    // ueberfliegen zu muessen.
    //
    // Die Farbe ersetzt das Seltenheitssymbol als schnellere Auskunft. Fuer
    // Farbfehlsichtige bleibt das Symbol bei den seltenen Stufen erhalten -
    // genau dort, wo der Unterschied zaehlt.
    const zahl = `+${points.toLocaleString('de-DE')}`;
    // Beim Gluecktreffer steht hier nur die Zahl, obwohl er der groessere
    // Moment ist: Seinen Namen traegt seit 2026-09-19 der Schriftzug im HUD.
    // Ein zusaetzliches "x3" am Feld-Label waere dieselbe Auskunft ein
    // zweites Mal, 200 Pixel weiter unten und im selben Augenblick.
    // Groesse, Farbe und Ausdehnung bleiben ihm - sie sagen "hier war etwas
    // Besonderes", ohne dass man zweimal dasselbe liest.
    const text = crit ? zahl : rank >= 4 ? `${rarityMarker(rarity.id)} ${zahl}` : zahl;
    const label = this.scene.add
      .text(
        0,
        0,
        text,
        textStyle(
          Math.round((crit ? 20 : 15) * unit),
          crit ? '#ffd84d' : `#${rarity.color.toString(16).padStart(6, '0')}`,
          {
            fontStyle: 'bold',
            stroke: '#101820',
            strokeThickness: (crit ? 6 : 4) * unit,
            align: 'center',
          },
        ),
      )
      .setDepth(Depth.FloatingScore)
      .setWordWrapWidth(170 * unit)
      // Um die Mitte skalieren, nicht um die linke obere Ecke: Sonst liefe die
      // Zahl beim Aufreissen nach rechts unten weg, statt sich auszudehnen.
      // Die Position wird unten entsprechend um die halbe Kastengroesse
      // versetzt gesetzt.
      .setOrigin(0.5);
    const capture: Capture = {
      origin: { ...origin },
      color: rarity.color,
      rank,
      age: 0,
      reduced: this.reducedMotion(),
      crit,
      label,
      box: null,
    };
    this.captures.push(capture);
    this.update(0);
  }

  update(deltaMs: number): void {
    if (this.captures.length === 0) return;
    const bounds = this.bounds();
    const target = this.target();
    this.graphics.clear();
    this.clip
      .clear()
      .fillStyle(0xffffff)
      .fillRect(
        bounds.left,
        bounds.top,
        Math.max(0, bounds.right - bounds.left),
        Math.max(0, bounds.bottom - bounds.top),
      );
    const occupied: EffectBox[] = [
      { left: target.x - 58, right: target.x + 58, top: target.y - 58, bottom: target.y + 58 },
    ];
    this.captures = this.captures.filter((capture) => {
      capture.age += Math.max(0, deltaMs);
      if (capture.age >= V.lifetimeMs) {
        capture.label.destroy();
        return false;
      }
      // OS changes take effect for already active captures too.
      capture.reduced ||= this.reducedMotion();
      this.draw(capture, target);
      const previous = capture.box;
      const inside =
        previous &&
        previous.left >= bounds.left &&
        previous.right <= bounds.right &&
        previous.top >= bounds.top &&
        previous.bottom <= bounds.bottom;
      const box = inside
        ? previous
        : collectionLabelBox(
            capture.origin,
            capture.label.width + 8,
            capture.label.height + 8,
            bounds,
            occupied,
          );
      capture.box = box;
      capture.label.setVisible(box !== null && !occupied.some((other) => boxesOverlap(box, other)));
      if (box) {
        // Der Kasten beschreibt die Flaeche, die dieses Label belegt; der
        // Ursprung liegt in seiner Mitte (siehe `setOrigin` oben).
        const mitteX = box.left + (box.right - box.left) / 2;
        const mitteY = box.top + (box.bottom - box.top) / 2;
        if (capture.reduced) {
          capture.label.setPosition(mitteX, mitteY).setScale(1).setAlpha(1);
        } else {
          // Die Druckwelle: hervorschnellen, weiter aufreissen, verwehen.
          //
          // Vorher stand die Zahl still an ihrem Platz und wurde in den
          // letzten 180 ms ausgeblendet - deshalb wirkte ein Fang statisch,
          // waehrend die Strafanzeigen ueber `floatingScore` laengst eine
          // Bewegung hatten (gemeldet 2026-09-19: "sehe ich bei den
          // Strafpunkten, aber nicht beim Einsammeln").
          //
          // Bewusst ohne Tween: Diese Klasse verwaltet bis zu acht gleichzeitige
          // Faenge ueber einen gemeinsamen Takt und kommt deshalb ohne
          // Tween-Objekte je Fang aus. Der Verlauf wird aus dem Alter
          // gerechnet, damit das so bleibt.
          const t = Math.min(1, capture.age / V.lifetimeMs);
          // Aufschlag: in den ersten Prozent der Lebenszeit auf Lesegroesse.
          const schlag = Math.min(1, capture.age / LABEL_HIT_MS);
          // Quadratisch abgebremst - schnell da, dann ruhig.
          const anlauf = LABEL_START + (1 - LABEL_START) * (1 - (1 - schlag) * (1 - schlag));
          // Danach dehnt es sich durchgehend weiter aus.
          const ziel = capture.crit ? LABEL_END_SCALE_CRIT : LABEL_END_SCALE;
          const dehnung = 1 + (ziel - 1) * t * t;
          // Aufsteigen mit stark abgebremster Kurve: fast die ganze Strecke
          // liegt im ersten Drittel - das ist der Teil, der als
          // "weggeschleudert" gelesen wird.
          const aufstieg = 1 - (1 - t) * (1 - t) * (1 - t);
          capture.label
            .setPosition(mitteX, mitteY - LABEL_RISE_PX * aufstieg)
            .setScale(anlauf * dehnung);
          // Verwehen laeuft ueber die ganze Ausdehnung statt nur am Ende: Das
          // Verblassen IST der Effekt, nicht sein Abschluss.
          capture.label.setAlpha(Math.min(1, (1 - t) * 1.6));
        }
        occupied.push(box);
      }
      return true;
    });
  }

  private draw(c: Capture, target: Point): void {
    const g = this.graphics;
    if (c.reduced) {
      g.lineStyle(2, c.color, 0.7);
      g.strokeEllipse(c.origin.x, c.origin.y, 30 + c.rank * 4, 16 + c.rank * 2);
      return;
    }
    const ringT = Math.min(1, c.age / V.ringMs);
    if (ringT < 1) {
      g.lineStyle(2, c.color, (1 - ringT) * 0.75);
      const radius = 12 + (24 + c.rank * 5) * (1 - (1 - ringT) ** 3);
      const ringCount = c.rank >= 5 ? 3 : c.rank >= 4 ? 2 : 1;
      for (let ring = 0; ring < ringCount; ring++) {
        g.beginPath();
        for (let step = 0; step <= 48; step++) {
          const angle = (step / 48) * Math.PI * 2;
          const x = Math.cos(angle) * (radius + ring * 8);
          const y = Math.sin(angle) * (radius + ring * 8) * 0.42;
          const px = c.origin.x + x * 0.94 + y * 0.34;
          const py = c.origin.y - x * 0.34 + y * 0.94;
          if (step === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      if (c.rank >= 5) {
        // Das hoechste Relikt bekommt einen facettierten Siegelrand statt
        // bloss mehr Partikel. Die vier Markierungen bleiben klein genug,
        // um weder Zahl noch Schiff zu verdecken.
        const sealRadius = radius + 18;
        g.lineStyle(1.5, 0xffffff, (1 - ringT) * 0.68);
        for (let facet = 0; facet < 4; facet++) {
          const angle = (facet / 4) * Math.PI * 2 + Math.PI / 4;
          const cx = c.origin.x + Math.cos(angle) * sealRadius;
          const cy = c.origin.y + Math.sin(angle) * sealRadius * 0.42;
          g.beginPath();
          g.moveTo(cx, cy - 4);
          g.lineTo(cx + 3, cy);
          g.lineTo(cx, cy + 4);
          g.lineTo(cx - 3, cy);
          g.closePath();
          g.strokePath();
        }
      }
    }
    const t = Math.min(1, c.age / (V.baseFlightMs + c.rank * V.flightStepMs));
    if (t >= 1) return;
    for (let i = 0; i < V.baseShards + c.rank; i++) {
      const angle = i * 2.4;
      const start = { x: c.origin.x + Math.cos(angle) * 8, y: c.origin.y + Math.sin(angle) * 8 };
      const bend = (i % 2 ? -1 : 1) * Math.min(V.maxBend, 16 + i * 6);
      const p = collectionPoint(start, target, t, bend);
      const tail = collectionPoint(start, target, Math.max(0, t - 0.12), bend);
      g.lineStyle(2 + c.rank * 0.2, c.color, (1 - t) * 0.9);
      g.lineBetween(tail.x, tail.y, p.x, p.y);
      g.fillStyle(0xffffff, (1 - t) * 0.9);
      g.fillCircle(p.x, p.y, 2 + c.rank * 0.25);
    }
  }

  destroy(): void {
    for (const capture of this.captures) capture.label.destroy();
    this.captures = [];
    this.graphics.clearMask();
    this.mask.destroy();
    this.clip.destroy();
    this.graphics.destroy();
  }
}
