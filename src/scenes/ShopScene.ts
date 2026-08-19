/**
 * Der Laden: Schiffsformen und Farben gegen Muenzen.
 *
 * Zwei Reiter statt einer langen Liste - Formen und Farben verhalten sich
 * gleich (kaufen, dann anziehen), sind aber verschiedene Entscheidungen. Wer
 * eine Form sucht, will nicht an Farben vorbeiscrollen.
 *
 * Die Vorschau zeigt immer die gerade gewaehlte Kombination, nicht nur den
 * angetippten Eintrag: Eine Form sieht in Gold anders aus als in Eisblau, und
 * genau das ist der Kaufgrund.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import {
  getShipColor,
  SHIP_COLORS,
  SHIP_SHAPES,
  shipTint,
  type ShipColorDef,
  type ShipShapeDef,
} from '@/config/shop';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { playerTextureForShape, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  attachVerticalScroll,
  BACK_BUTTON_RESERVED_HEIGHT,
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

type ShopTab = 'shapes' | 'colors';

/**
 * Ein Listenelement mit gemerkter Ausgangsposition.
 *
 * Das Scrollen verschiebt relativ zu `ausgangsY` statt absolut - sonst
 * summierten sich die Verschiebungen bei jedem Ereignis auf.
 */
type ScrollElement = Phaser.GameObjects.GameObject & { y: number; ausgangsY?: number };

/** Oberkante der Kartenliste, unterhalb der Reiter. */
const LISTE_START = 470;
/** Alles ueber der Liste - Vorschau und Reiter. */
const KOPF_HOEHE = 420;
/** Ueber `Depth.UI`, damit die Liste beim Scrollen darunter verschwindet. */
const KOPF_DEPTH = 160;
const KARTE_HOEHE = 96;
const KARTE_ABSTAND = 12;

export class ShopScene extends Phaser.Scene {
  private tab: ShopTab = 'shapes';
  /** Alles unterhalb der Reiter - wird beim Wechsel komplett neu gebaut. */
  private inhalt: ScrollElement[] = [];

  constructor() {
    super(SceneKey.Shop);
  }

  create(data: { tab?: ShopTab } = {}): void {
    SafeAreaSystem.showStatic('SHOP');
    this.tab = data.tab ?? 'shapes';
    this.inhalt = [];

    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      world.bgTop,
      world.bgBottom,
      world.accent,
      world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, world.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    this.buildVorschau(world.accent);
    this.buildReiter();
    this.buildListe(world.accent);
    this.attachScroll();

    createBackButton(this, () => this.scene.start(SceneKey.Menu));
  }

  /**
   * Figur und Guthaben - beides aendert sich bei jedem Kauf.
   *
   * Der Kopfbereich liegt ueber der Liste und deckt sie ab: Beim Scrollen
   * wanderten die Karten sonst sichtbar hinter den Reitern durch.
   */
  private buildVorschau(weltAkzent: number): void {
    const save = SaveSystem.load();
    const y = 250;

    // Halbdeckende Flaeche, damit durchgescrollte Karten nicht zwischen
    // Vorschau und Reitern hindurchscheinen. Bewusst nicht voll deckend: Der
    // Weltraum-Hintergrund soll oben sichtbar bleiben, sonst wirkt der Kopf
    // wie ein aufgesetzter Balken statt wie Teil der Szene.
    this.add
      .rectangle(GAME_WIDTH / 2, KOPF_HOEHE / 2, GAME_WIDTH, KOPF_HOEHE, Palette.backdrop, 0.82)
      .setDepth(KOPF_DEPTH - 1);

    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, 190, weltAkzent, {
      alpha: 0.5,
    }).setDepth(KOPF_DEPTH);

    this.add
      .image(GAME_WIDTH / 2, y - 20, TextureKey.PlayerHalo)
      .setTint(shipTint(save, weltAkzent))
      .setScale(0.7)
      .setAlpha(0.75)
      .setDepth(KOPF_DEPTH);

    this.add
      .image(GAME_WIDTH / 2, y - 20, playerTextureForShape(save.shipShape))
      .setTint(shipTint(save, weltAkzent))
      .setScale(0.85)
      .setDepth(KOPF_DEPTH);

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 62,
        `${save.coins.toLocaleString('de-DE')} MÜNZEN`,
        textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setDepth(KOPF_DEPTH);
  }

  private buildReiter(): void {
    const y = 385;
    const breite = 200;
    const luecke = 16;
    const links = (GAME_WIDTH - (breite * 2 + luecke)) / 2;

    const reiter: readonly { readonly id: ShopTab; readonly label: string }[] = [
      { id: 'shapes', label: 'FORMEN' },
      { id: 'colors', label: 'FARBEN' },
    ];

    reiter.forEach((eintrag, index) => {
      const aktiv = this.tab === eintrag.id;
      const taste = createButton(
        this,
        links + breite / 2 + index * (breite + luecke),
        y,
        eintrag.label,
        () => {
          if (aktiv) return;
          // Neustart statt Teil-Neuaufbau: Die Scene ist klein, und ein
          // vollstaendiger Aufbau kann keinen alten Zustand mitschleppen.
          this.scene.restart({ tab: eintrag.id });
        },
        {
          width: breite,
          height: 58,
          accent: aktiv ? Palette.goldHex : 0x9aa3bd,
          fontSize: FontSize.small,
        },
      );
      taste.container.setDepth(KOPF_DEPTH);
    });
  }

  private buildListe(weltAkzent: number): void {
    for (const objekt of this.inhalt) objekt.destroy();
    this.inhalt = [];

    if (this.tab === 'shapes') {
      SHIP_SHAPES.forEach((shape, index) => this.buildFormKarte(shape, index, weltAkzent));
      return;
    }
    SHIP_COLORS.forEach((color, index) => this.buildFarbKarte(color, index, weltAkzent));
  }

  /**
   * Macht die Liste scrollbar, wenn sie laenger ist als der freie Platz.
   *
   * Sieben Formen brauchen 748 Pixel; auf einem iPhone 13 bleiben unter den
   * Reitern und ueber der Zurueck-Zone nur rund 620. Ohne Scrollen war die
   * letzte Karte (Krone) hinter dem Zurueck-Balken verborgen - sichtbar erst
   * im Screenshot, weil die Karten formal "innerhalb der Spielflaeche" lagen
   * und der Playtest sie deshalb nicht beanstandete.
   */
  private attachScroll(): void {
    const listeOben = this.karteY(0) - KARTE_HOEHE / 2;
    const anzahl = this.tab === 'shapes' ? SHIP_SHAPES.length : SHIP_COLORS.length;
    const listeUnten = this.karteY(anzahl - 1) + KARTE_HOEHE / 2;
    const sichtbarBis = GAME_HEIGHT - BACK_BUTTON_RESERVED_HEIGHT;
    const maxScroll = Math.max(0, listeUnten - sichtbarBis + 20);

    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: listeOben,
      dragZoneBottom: sichtbarBis,
      onOffsetChange: (offset) => {
        for (const objekt of this.inhalt) {
          if (objekt.ausgangsY === undefined) continue;
          objekt.y = objekt.ausgangsY - offset;
        }
      },
    });
  }

  /** Y-Mitte der Karte an Position `index`. */
  private karteY(index: number): number {
    return LISTE_START + index * (KARTE_HOEHE + KARTE_ABSTAND) + KARTE_HOEHE / 2;
  }

  private buildFormKarte(shape: ShipShapeDef, index: number, weltAkzent: number): void {
    const save = SaveSystem.load();
    const besitzt = save.ownedShipShapes.includes(shape.id);
    const getragen = save.shipShape === shape.id;
    const y = this.karteY(index);

    this.buildKarte({
      y,
      getragen,
      akzent: weltAkzent,
      titel: shape.name,
      untertitel: shape.description,
      knopf: this.knopfText(besitzt, getragen, shape.cost),
      knopfAktiv: !getragen && (besitzt || save.coins >= shape.cost),
      onClick: () => {
        if (getragen) return;
        const ergebnis = besitzt
          ? ProgressionSystem.equipShip(shape.id, undefined)
          : ProgressionSystem.purchaseShipShape(shape.id);
        if (ergebnis) this.scene.restart({ tab: this.tab });
      },
      symbol: (x: number, mitteY: number) =>
        this.add
          .image(x, mitteY, playerTextureForShape(shape.id))
          .setTint(shipTint(save, weltAkzent))
          .setScale(0.42),
    });
  }

  private buildFarbKarte(color: ShipColorDef, index: number, weltAkzent: number): void {
    const save = SaveSystem.load();
    const besitzt = save.ownedShipColors.includes(color.id);
    const getragen = save.shipColor === color.id;
    const y = this.karteY(index);

    this.buildKarte({
      y,
      getragen,
      akzent: weltAkzent,
      titel: color.name,
      untertitel: color.color === null ? 'Passt sich der Welt an.' : '',
      knopf: this.knopfText(besitzt, getragen, color.cost),
      knopfAktiv: !getragen && (besitzt || save.coins >= color.cost),
      onClick: () => {
        if (getragen) return;
        const ergebnis = besitzt
          ? ProgressionSystem.equipShip(undefined, color.id)
          : ProgressionSystem.purchaseShipColor(color.id);
        if (ergebnis) this.scene.restart({ tab: this.tab });
      },
      symbol: (x: number, mitteY: number) =>
        this.add
          .image(x, mitteY, TextureKey.Glow)
          .setTint(getShipColor(color.id).color ?? weltAkzent)
          .setScale(0.55),
    });
  }

  private knopfText(besitzt: boolean, getragen: boolean, kosten: number): string {
    if (getragen) return 'AN';
    if (besitzt) return 'ANZIEHEN';
    return `${kosten.toLocaleString('de-DE')}`;
  }

  private buildKarte(optionen: {
    y: number;
    getragen: boolean;
    akzent: number;
    titel: string;
    untertitel: string;
    knopf: string;
    knopfAktiv: boolean;
    onClick: () => void;
    symbol: (x: number, y: number) => Phaser.GameObjects.Image;
  }): void {
    const { y, getragen, akzent, titel, untertitel, knopf, knopfAktiv, onClick, symbol } = optionen;

    // Das Getragene bekommt den goldenen Rahmen - so ist ohne Text zu sehen,
    // was gerade an der Figur haengt.
    const panel = createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, KARTE_HOEHE, akzent, {
      alpha: getragen ? 0.72 : 0.45,
    });
    this.inhalt.push(panel as ScrollElement);
    this.inhalt.push(symbol(120, y) as ScrollElement);

    // Textbreite bis vor den Knopf begrenzen. Ohne das lief die Beschreibung
    // unter die Taste und war dort nicht mehr lesbar.
    const textBreite = GAME_WIDTH - 130 - 150 / 2 - 180 - 16;

    this.inhalt.push(
      this.add
        .text(180, y - (untertitel ? 16 : 0), titel, textStyle(FontSize.body, Palette.ink))
        .setOrigin(0, 0.5) as ScrollElement,
    );

    if (untertitel) {
      this.inhalt.push(
        this.add
          .text(180, y + 18, untertitel, {
            ...textStyle(FontSize.tiny, Palette.inkDim),
            wordWrap: { width: textBreite },
          })
          .setOrigin(0, 0.5) as ScrollElement,
      );
    }

    const taste = createButton(this, GAME_WIDTH - 130, y, knopf, onClick, {
      width: 150,
      height: 56,
      accent: getragen ? Palette.goldHex : akzent,
      fontSize: FontSize.tiny,
    });
    taste.setEnabled(knopfAktiv);
    this.inhalt.push(taste.container as ScrollElement);

    // Ausgangsposition merken - `attachScroll` verschiebt relativ dazu.
    for (const objekt of this.inhalt) {
      objekt.ausgangsY ??= objekt.y;
    }
  }
}
