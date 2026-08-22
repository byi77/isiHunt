/**
 * Der Laden: Schiffsformen, Farben und Auren gegen Muenzen.
 *
 * Drei Reiter statt einer langen Liste - alle drei verhalten sich gleich
 * (kaufen, dann anziehen), sind aber verschiedene Entscheidungen. Wer eine
 * Form sucht, will nicht an Farben vorbeiscrollen.
 *
 * Die Vorschau zeigt immer die gerade gewaehlte Kombination, nicht nur den
 * angetippten Eintrag: Eine Form sieht in Gold anders aus als in Eisblau, und
 * genau das ist der Kaufgrund.
 *
 * ## Warum die Vorschau laeuft und nicht steht
 *
 * Fuer Formen und Farben genuegt ein Standbild - beide sind auf einem
 * Screenshot zu beurteilen. Fuer eine Aura nicht: Ihr ganzer Kaufgrund ist
 * das, was ein Standbild gerade nicht zeigt. Die Vorschau spielt die
 * angeprobte Aura deshalb tatsaechlich ab (`update()`), sonst gaebe jemand
 * zehntausend Muenzen fuer etwas aus, das er vorher nie gesehen hat.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import {
  auraLevelReached,
  getShipAura,
  getShipColor,
  getShipShape,
  SHIP_AURAS,
  SHIP_COLORS,
  SHIP_SHAPES,
  shipTint,
  type ShipAuraDef,
  type ShipColorDef,
  type ShipShapeDef,
} from '@/config/shop';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import {
  cosmeticCategoryLabel,
  cosmeticStatusText,
  getCosmeticCollectionSummary,
  getShopCollectionSummaryText,
} from '@/systems/CosmeticCollectionSystem';
import * as ProgressionSystem from '@/systems/ProgressionSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { auraAssetForId, threeDAssetForId } from '@/ui/egoAssets';
import {
  applyTintShift,
  AURA_FRAME_RUHE,
  SHIP_ANIMATIONS,
  stehendesBild,
} from '@/ui/shipAnimations';
import { playerTextureForShape, TextureKey } from '@/ui/textures';
import { ThreeDShipPreview } from '@/ui/threeDShipPreview';
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

type ShopTab = 'shapes' | 'colors' | 'auras';

/**
 * Ein Listenelement mit gemerkter Ausgangsposition.
 *
 * Das Scrollen verschiebt relativ zu `ausgangsY` statt absolut - sonst
 * summierten sich die Verschiebungen bei jedem Ereignis auf.
 */
type ScrollElement = Phaser.GameObjects.GameObject & { y: number; ausgangsY?: number };

/** Oberkante der Kartenliste, unterhalb der Reiter. */
const LISTE_START = 430;
/** Alles ueber der Liste - Vorschau und Reiter. */
const KOPF_HOEHE = 380;
/** Mittelpunkt des kompakten Vorschau-Panels. */
const VORSCHAU_Y = 176;
/** Y-Position der drei Reiter unterhalb der Vorschau. */
const REITER_Y = 345;
/** Ueber `Depth.UI`, damit die Liste beim Scrollen darunter verschwindet. */
const KOPF_DEPTH = 160;
const KARTE_HOEHE = 96;
const KARTE_ABSTAND = 12;
/** Breite des Kauf-/Anziehen-Knopfs am rechten Kartenrand. */
const KNOPF_BREITE = 150;
const VORSCHAU_3D_BREITE = 260;
const VORSCHAU_3D_HOEHE = 140;

export class ShopScene extends Phaser.Scene {
  private tab: ShopTab = 'shapes';
  /** Alles unterhalb der Reiter - wird beim Wechsel komplett neu gebaut. */
  private inhalt: ScrollElement[] = [];
  /**
   * Was die Vorschau gerade zeigt - nicht zwingend das Getragene.
   *
   * Ohne Anprobe liess sich eine Form nur nach dem Kauf betrachten: In der
   * Zeile steht sie winzig, und wer 2 600 Muenzen ausgibt, will vorher sehen,
   * was er bekommt. Ein Tipp auf die Karte legt sie hier ab; die Vorschau
   * zeichnet sich daraufhin neu.
   */
  private anprobeShape: string | null = null;
  private anprobeColor: string | null = null;
  private anprobeAura: string | null = null;
  /** Laufzeit der Vorschau-Aura. Siehe `update()`. */
  private vorschauAuraMs = 0;
  /** Grundfarbe der Vorschau ohne Aura - die Aura verschiebt von hier aus. */
  private vorschauFarbe = 0xffffff;
  /** Die mitlaufenden Symbole der Aura-Karten, siehe `buildAuraKarte`. */
  private auraSymbole: {
    bild: Phaser.GameObjects.Image;
    animIndex: number | null;
    grundfarbe: number;
  }[] = [];
  private vorschauBild!: Phaser.GameObjects.Image;
  private vorschauHalo!: Phaser.GameObjects.Image;
  private vorschauName!: Phaser.GameObjects.Text;
  private vorschau3dDom!: Phaser.GameObjects.DOMElement;
  private vorschau3d!: ThreeDShipPreview;
  /**
   * Wie weit die Liste gerade gescrollt ist.
   *
   * Ein Kauf startet die Scene neu; ohne diesen Wert sprang die Liste dabei
   * an den Anfang, und wer weit unten kaufte, musste sich seine Stelle neu
   * suchen.
   */
  private scrollOffset = 0;

  constructor() {
    super(SceneKey.Shop);
  }

  create(
    data: {
      tab?: ShopTab;
      anprobeShape?: string;
      anprobeColor?: string;
      anprobeAura?: string;
      scrollOffset?: number;
    } = {},
  ): void {
    SafeAreaSystem.showStatic('SHOP');
    this.tab = data.tab ?? 'shapes';
    this.inhalt = [];
    this.auraSymbole = [];
    // Die Anprobe ueberlebt den Neustart, den ein Kauf ausloest - sonst
    // spraenge die Vorschau nach jedem Kauf auf das Getragene zurueck.
    this.anprobeShape = data.anprobeShape ?? null;
    this.anprobeColor = data.anprobeColor ?? null;
    this.anprobeAura = data.anprobeAura ?? null;
    this.vorschauAuraMs = 0;
    // Beim Reiterwechsel bewusst bei 0 anfangen - die andere Liste hat mit
    // der Stelle nichts zu tun.
    this.scrollOffset = data.scrollOffset ?? 0;

    const save = SaveSystem.load();
    const world = getWorld(save.lastWorldId);

    // 3D-Piloten sind im Formen-Reiter sofort sichtbar: Wer den Shop oeffnet,
    // soll die neue Vorschau vor dem Kauf sehen koennen. Ist bereits ein
    // 3D-Pilot ausgeruestet, bleibt natuerlich dieser die Vorschau.
    const erster3DShape = SHIP_SHAPES.find((shape) => shape.threeDAssetId !== undefined);
    if (
      this.tab === 'shapes' &&
      this.anprobeShape === null &&
      getShipShape(save.shipShape).threeDAssetId === undefined
    ) {
      this.anprobeShape = erster3DShape?.id ?? null;
    }

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
    this.blendeAusserhalbAus();

    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    // Alle Trefferflaechen beim Verlassen abmelden.
    //
    // Phasers Eingabe-Plugin behaelt interaktive Objekte einer geschlossenen
    // Scene sonst in seiner Liste. Sichtbar wurde das an einer ganz anderen
    // Stelle: Nach einem Besuch im Laden liess sich der Profilbildschirm nicht
    // mehr wischen - der Playtest meldete "Inhalt wanderte 0 px". Die
    // ProfileScene selbst war unversehrt (gleiche Objekte, gleicher
    // Scroll-Handler); es waren die zurueckgebliebenen Ladenflaechen, die den
    // Zeiger abfingen.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const objekt of this.inhalt) {
        if (objekt.input) this.input.disable(objekt);
      }
      // Neu-Markierungen gelten fuer einen Besuch, der aktuelle Kauf bleibt
      // separat als "zuletzt gekauft" sichtbar.
      SaveSystem.markCosmeticsSeen(this.tab);
      this.vorschau3d.destroy();
      this.vorschau3dDom.destroy();
    });
  }

  /**
   * Figur und Guthaben - beides aendert sich bei jedem Kauf.
   *
   * Der Kopfbereich liegt ueber der Liste und deckt sie ab: Beim Scrollen
   * wanderten die Karten sonst sichtbar hinter den Reitern durch.
   */
  private buildVorschau(weltAkzent: number): void {
    const save = SaveSystem.load();
    // Die Kopfzone sitzt bewusst hoeher und kompakter. Die Panel-Oberkante
    // liegt damit bei rund y=61 im Canvas (auf dem Geraet etwa bei Pixel 125),
    // ohne den Safe-Area-Ticker zu beruehren.
    const y = VORSCHAU_Y;

    // Voll deckende Flaeche unter dem Kopfbereich.
    //
    // Ein erster Versuch liess sie bei 0,82 halbtransparent, damit der
    // Weltraum-Hintergrund oben sichtbar bleibt. Bei dreissig Karten schienen
    // die durchgescrollten Titel dann sichtbar durch die Vorschau - Lesbarkeit
    // geht hier vor Atmosphaere. Der Hintergrund bleibt unterhalb der Liste
    // ohnehin zu sehen.
    this.add
      .rectangle(GAME_WIDTH / 2, KOPF_HOEHE / 2, GAME_WIDTH, KOPF_HOEHE, Palette.backdrop, 1)
      .setDepth(KOPF_DEPTH - 1);

    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, 230, weltAkzent, {
      alpha: 0.5,
    }).setDepth(KOPF_DEPTH);

    this.vorschauHalo = this.add
      .image(GAME_WIDTH / 2, y - 30, TextureKey.PlayerHalo)
      .setScale(0.7)
      .setAlpha(0.75)
      .setDepth(KOPF_DEPTH);

    this.vorschauBild = this.add
      .image(GAME_WIDTH / 2, y - 30, TextureKey.PlayerCore)
      .setScale(0.85)
      .setDepth(KOPF_DEPTH);

    this.vorschau3dDom = this.add
      .dom(GAME_WIDTH / 2, y - 45, 'canvas', {
        width: `${VORSCHAU_3D_BREITE}px`,
        height: `${VORSCHAU_3D_HOEHE}px`,
      })
      .setDepth(KOPF_DEPTH + 1)
      .setVisible(false);
    // Auch die Shop-Vorschau ist nur Darstellung. `ThreeDShipPreview` setzt
    // das Canvas selbst auf none, Phaser wuerde den DOMElement-Wert beim
    // Rendern aber sonst wieder auf `auto` setzen.
    this.vorschau3dDom.pointerEvents = 'none';
    this.vorschau3d = new ThreeDShipPreview(
      this.vorschau3dDom.node as HTMLCanvasElement,
      VORSCHAU_3D_BREITE,
      VORSCHAU_3D_HOEHE,
      (available) => {
        // Die CSS-Sichtbarkeit des Canvas reicht bei Phaser-DOMElementen
        // nicht: Phaser schreibt die Anzeige des Wrappers beim Rendern
        // erneut. Nur der Wrapper garantiert, dass beim Laden/Wechseln kein
        // altes 3D-Bild neben dem 2D-Fallback stehen bleibt.
        this.vorschau3dDom.setVisible(available);
        this.vorschauBild.setVisible(!available);
      },
    );

    this.vorschauName = this.add
      .text(GAME_WIDTH / 2, y + 32, '', textStyle(FontSize.small, Palette.ink))
      .setOrigin(0.5)
      .setDepth(KOPF_DEPTH);

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 68,
        `${save.coins.toLocaleString('de-DE')} MÜNZEN`,
        textStyle(FontSize.tiny, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setDepth(KOPF_DEPTH);

    const summary = getShopCollectionSummaryText(save);
    this.add
      .text(GAME_WIDTH / 2, y + 91, summary.counts, textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setDepth(KOPF_DEPTH);
    this.add
      .text(GAME_WIDTH / 2, y + 110, summary.activity, textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5)
      .setDepth(KOPF_DEPTH);

    this.zeichneVorschau(weltAkzent);
  }

  /**
   * Setzt Bild, Farbe und Namen der Vorschau.
   *
   * Zeigt die Anprobe, wenn eine laeuft, sonst das Getragene. Der Name macht
   * den Unterschied lesbar - ohne ihn waere nicht klar, ob man gerade sein
   * eigenes Schiff sieht oder ein fremdes.
   */
  private zeichneVorschau(weltAkzent: number): void {
    const save = SaveSystem.load();
    const shapeId = this.anprobeShape ?? save.shipShape;
    const colorId = this.anprobeColor ?? save.shipColor;
    const auraId = this.anprobeAura ?? save.shipAura;
    const farbe = getShipColor(colorId).color ?? weltAkzent;
    const shape = getShipShape(shapeId);
    const threeDAsset = threeDAssetForId(shape.threeDAssetId);

    this.vorschauFarbe = farbe;
    this.vorschauBild.setTexture(playerTextureForShape(shapeId)).setTint(farbe).setVisible(true);
    this.vorschau3d.setModel(threeDAsset, farbe);
    this.vorschauHalo.setTint(farbe);
    // Beim Wechsel von vorn: Mitten im Sog einer Singularitaet einzusteigen
    // sieht aus wie ein Fehler, nicht wie eine Bewegung.
    this.vorschauAuraMs = 0;
    this.spieleVorschauAura(0);

    const angeprobt =
      this.anprobeShape !== null || this.anprobeColor !== null || this.anprobeAura !== null;
    const aura = getShipAura(auraId);
    // Die Aura nur nennen, wenn eine getragen wird - "Pfeil · Gold · Keine"
    // liest sich wie ein Mangel.
    const teile = [getShipShape(shapeId).name, getShipColor(colorId).name];
    if (aura.animIndex !== null) teile.push(aura.name);
    const name = teile.join(' · ');
    this.vorschauName.setText(angeprobt ? `${name}  (Vorschau)` : name);
    this.vorschauName.setColor(angeprobt ? Palette.gold : Palette.inkDim);
  }

  /**
   * Spielt die Aura der Vorschau ab.
   *
   * Phaser ruft `update()` je Frame - dieselbe Rechnung, die im Spiel an der
   * Figur haengt (`Player.applyAura`), laeuft hier auf dem Vorschaubild. Die
   * Bewegung ist damit garantiert dieselbe, die man nach dem Kauf bekommt:
   * Sie stammt aus derselben Funktion und nicht aus einer nachgebauten
   * Tween-Kette, die beim naechsten Feinschliff auseinanderliefe.
   */
  override update(_time: number, delta: number): void {
    if (this.vorschauBild === undefined) return;
    this.vorschauAuraMs += delta;
    this.spieleVorschauAura(this.vorschauAuraMs);
    this.vorschau3d.update(delta);

    for (const eintrag of this.auraSymbole) {
      // Unsichtbare Karten nicht rechnen: Bei neun Auren ist das wenig, aber
      // `blendeAusserhalbAus` hat sie ohnehin abgeschaltet.
      if (!eintrag.bild.visible) continue;
      const animation = eintrag.animIndex === null ? undefined : SHIP_ANIMATIONS[eintrag.animIndex];
      const frame =
        animation === undefined
          ? AURA_FRAME_RUHE
          : prefersReducedMotion()
            ? stehendesBild(animation)
            : animation(this.vorschauAuraMs);
      // 0,42 ist die Grundgroesse der Kartensymbole, siehe `buildAuraKarte`.
      eintrag.bild.setScale(0.42 * frame.scaleX, 0.42 * frame.scaleY);
      eintrag.bild.rotation = frame.rotation;
      eintrag.bild.setAlpha(frame.alpha);
      eintrag.bild.setTint(applyTintShift(eintrag.grundfarbe, frame.tint));
    }
  }

  /** Setzt einen Augenblick der angeprobten Aura auf das Vorschaubild. */
  private spieleVorschauAura(timeMs: number): void {
    const auraId = this.anprobeAura ?? SaveSystem.load().shipAura;
    const auraDefinition = getShipAura(auraId);
    const index = auraDefinition.animIndex;
    const animation = index === null ? undefined : SHIP_ANIMATIONS[index];
    const frame =
      animation === undefined
        ? AURA_FRAME_RUHE
        : prefersReducedMotion()
          ? stehendesBild(animation)
          : animation(timeMs);

    const auraAsset = auraAssetForId(auraDefinition.assetId);
    if (auraAsset !== undefined) {
      const frameIndex =
        Math.floor(timeMs / auraAsset.frameDurationMs) % auraAsset.frameTextureKeys.length;
      const textureKey = auraAsset.frameTextureKeys[frameIndex] ?? auraAsset.frameTextureKeys[0];
      if (textureKey !== undefined) this.vorschauHalo.setTexture(textureKey);
      this.vorschauHalo.setScale(
        auraAsset.previewScaleMultiplier,
        auraAsset.previewScaleMultiplier,
      );
    } else {
      this.vorschauHalo.setTexture(TextureKey.PlayerHalo).setScale(0.7);
    }

    // 0,85 ist die Grundgroesse der Schiffsvorschau, siehe `buildVorschau`.
    this.vorschauBild.setScale(0.85 * frame.scaleX, 0.85 * frame.scaleY);
    this.vorschauBild.rotation = frame.rotation;
    this.vorschauBild.setAlpha(frame.alpha);
    this.vorschauBild.setTint(applyTintShift(this.vorschauFarbe, frame.tint));
  }

  private buildReiter(): void {
    const y = REITER_Y;
    const luecke = 12;
    const save = SaveSystem.load();
    const reiter: readonly { readonly id: ShopTab; readonly label: string }[] = (
      ['shapes', 'colors', 'auras'] as const
    ).map((id) => {
      const summary = getCosmeticCollectionSummary(save, id);
      return { id, label: `${cosmeticCategoryLabel(id)} ${summary.owned}/${summary.total}` };
    });
    // Breite aus der Anzahl rechnen statt fest: Mit dem dritten Reiter passen
    // die frueheren 200 px nicht mehr nebeneinander, und ein Knopf, der ueber
    // den Rand haengt, ist genau das, was die `controls`-Suite meldet.
    const breite = (GAME_WIDTH - 60 - luecke * (reiter.length - 1)) / reiter.length;
    const links = (GAME_WIDTH - (breite * reiter.length + luecke * (reiter.length - 1))) / 2;

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
    if (this.tab === 'auras') {
      SHIP_AURAS.forEach((aura, index) => this.buildAuraKarte(aura, index, weltAkzent));
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
    const anzahl = this.eintraegeImReiter();
    const listeUnten = this.karteY(anzahl - 1) + KARTE_HOEHE / 2;
    const sichtbarBis = GAME_HEIGHT - BACK_BUTTON_RESERVED_HEIGHT;
    const maxScroll = Math.max(0, listeUnten - sichtbarBis + 20);

    attachVerticalScroll(this, {
      maxScroll,
      dragZoneTop: listeOben,
      dragZoneBottom: sichtbarBis,
      startOffset: this.scrollOffset,
      onOffsetChange: (offset) => {
        this.scrollOffset = offset;
        for (const objekt of this.inhalt) {
          if (objekt.ausgangsY === undefined) continue;
          objekt.y = objekt.ausgangsY - offset;
        }
        this.blendeAusserhalbAus();
      },
    });
  }

  /**
   * Blendet alles aus, was gerade nicht im Sichtfenster liegt.
   *
   * Bei dreissig Karten reicht die Liste weit ueber den Bildschirmrand
   * hinaus. Ohne dieses Ausblenden liegen Knoepfe ausserhalb der
   * Spielflaeche - der Playtest meldet das zu Recht als Fehler, denn ein
   * anklickbares Element, das niemand sehen kann, ist ein Bedienfehler.
   *
   * `setVisible(false)` statt Zerstoeren: Die Karten kommen beim Scrollen
   * zurueck, und ein Neuaufbau bei jedem Bildpunkt waere teuer.
   */
  private blendeAusserhalbAus(): void {
    const oben = KOPF_HOEHE;
    const unten = GAME_HEIGHT - BACK_BUTTON_RESERVED_HEIGHT;
    // Eine Karte ist eine Einheit. Wenn nur ihr Mittelpunkt knapp unter dem
    // Kopf liegt, stehen Titel, Symbol oder Button sonst bereits im
    // Vorschau-/Reiterbereich. Das ist besonders auffällig bei den vielen
    // 2D-Formen, weil deren Symbole nicht vom DOM-Layer der 3D-Vorschau
    // maskiert werden können.
    const minKartenMitte = oben + KARTE_HOEHE / 2 + 1;
    const maxKartenMitte = unten - KARTE_HOEHE / 2 - 1;
    for (const objekt of this.inhalt) {
      const sichtbar = objekt.y > minKartenMitte && objekt.y < maxKartenMitte;
      const ziel = objekt as ScrollElement & {
        setVisible?: (wert: boolean) => unknown;
        input?: { enabled: boolean } | null;
      };
      ziel.setVisible?.(sichtbar);
      // Auch die Trefferflaeche abschalten: Ein unsichtbarer, aber
      // anklickbarer Knopf faengt Tipps ab, die dem darunterliegenden
      // Element gelten.
      if (ziel.input) ziel.input.enabled = sichtbar;
    }
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
      status: cosmeticStatusText(save, 'shapes', shape.id, getragen),
      untertitel: shape.threeDAssetId ? `3D-Vorschau · ${shape.description}` : shape.description,
      knopf: this.knopfText(besitzt, getragen, shape.cost),
      knopfAktiv: !getragen && (besitzt || save.coins >= shape.cost),
      onClick: () => {
        if (getragen) return;
        const ergebnis = besitzt
          ? ProgressionSystem.equipShip(shape.id, undefined)
          : ProgressionSystem.purchaseShipShape(shape.id);
        if (!ergebnis) return;
        // Scroll-Position mitgeben: Ohne sie spraenge die Liste beim Neustart
        // an den Anfang, und wer weit unten kauft, verliert seine Stelle.
        this.scene.restart({
          tab: this.tab,
          anprobeShape: this.anprobeShape,
          anprobeColor: this.anprobeColor,
          anprobeAura: this.anprobeAura,
          scrollOffset: this.scrollOffset,
        });
      },
      // Ein Tipp auf die Zeile probiert an, ohne zu kaufen. Der Kauf laeuft
      // ausschliesslich ueber den Knopf rechts - sonst waere jede Beruehrung
      // ein Kaufrisiko.
      onAnprobe: () => {
        this.anprobeShape = shape.id === SaveSystem.load().shipShape ? null : shape.id;
        this.zeichneVorschau(weltAkzent);
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
      status: cosmeticStatusText(save, 'colors', color.id, getragen),
      untertitel: color.color === null ? 'Passt sich der Welt an.' : 'Feste Schiffsfarbe.',
      knopf: this.knopfText(besitzt, getragen, color.cost),
      knopfAktiv: !getragen && (besitzt || save.coins >= color.cost),
      onClick: () => {
        if (getragen) return;
        const ergebnis = besitzt
          ? ProgressionSystem.equipShip(undefined, color.id)
          : ProgressionSystem.purchaseShipColor(color.id);
        if (!ergebnis) return;
        this.scene.restart({
          tab: this.tab,
          anprobeShape: this.anprobeShape,
          anprobeAura: this.anprobeAura,
          scrollOffset: this.scrollOffset,
        });
      },
      onAnprobe: () => {
        this.anprobeColor = color.id === SaveSystem.load().shipColor ? null : color.id;
        this.zeichneVorschau(weltAkzent);
      },
      symbol: (x: number, mitteY: number) =>
        this.add
          .image(x, mitteY, TextureKey.Glow)
          .setTint(getShipColor(color.id).color ?? weltAkzent)
          .setScale(0.55),
    });
  }

  /**
   * Eine Aura-Karte.
   *
   * Das Symbol links zeigt die **eigene Figur** in der Bewegung dieser Aura,
   * nicht ein abstraktes Zeichen: Eine Aura laesst sich nur an einer Form
   * beurteilen, und die Form, die zaehlt, ist die getragene. Anders als bei
   * Formen und Farben laeuft das Symbol deshalb mit - siehe `update()`.
   */
  private buildAuraKarte(aura: ShipAuraDef, index: number, weltAkzent: number): void {
    const save = SaveSystem.load();
    const besitzt = save.ownedShipAuras.includes(aura.id);
    const getragen = save.shipAura === aura.id;
    const stufeReicht = auraLevelReached(aura, save.level);
    const y = this.karteY(index);

    // Eine gesperrte Aura bleibt sichtbar und anprobierbar.
    //
    // Sie zu verstecken, bis die Stufe erreicht ist, waere der naheliegende
    // Weg - und der falsche: Ein Fernziel wirkt nur, wenn man es sieht. Wer
    // auf Stufe 12 die Prismaflut laufen sieht und "ab Stufe 50" darunter
    // liest, hat einen Grund weiterzuspielen. Wer sie nie zu Gesicht bekommt,
    // vermisst sie auch nicht.
    this.buildKarte({
      y,
      getragen,
      akzent: weltAkzent,
      titel: aura.name,
      status: cosmeticStatusText(save, 'auras', aura.id, getragen),
      untertitel: aura.description,
      knopf: stufeReicht ? this.knopfText(besitzt, getragen, aura.cost) : `STUFE ${aura.minLevel}`,
      knopfAktiv: stufeReicht && !getragen && (besitzt || save.coins >= aura.cost),
      onClick: () => {
        if (getragen || !stufeReicht) return;
        const ergebnis = besitzt
          ? ProgressionSystem.equipShip(undefined, undefined, aura.id)
          : ProgressionSystem.purchaseShipAura(aura.id);
        if (!ergebnis) return;
        this.scene.restart({
          tab: this.tab,
          anprobeShape: this.anprobeShape,
          anprobeColor: this.anprobeColor,
          scrollOffset: this.scrollOffset,
        });
      },
      onAnprobe: () => {
        this.anprobeAura = aura.id === SaveSystem.load().shipAura ? null : aura.id;
        this.zeichneVorschau(weltAkzent);
      },
      symbol: (x: number, mitteY: number) => {
        const bild = this.add
          .image(x, mitteY, playerTextureForShape(this.anprobeShape ?? save.shipShape))
          .setTint(shipTint(save, weltAkzent))
          .setScale(0.42);
        // Die Karte merkt sich ihre Aura, damit `update()` sie fortschreiben
        // kann, ohne die Zuordnung neu suchen zu muessen.
        this.auraSymbole.push({
          bild,
          animIndex: aura.animIndex,
          grundfarbe: shipTint(save, weltAkzent),
        });
        return bild;
      },
    });
  }

  /** Wie viele Eintraege der aktive Reiter hat. */
  private eintraegeImReiter(): number {
    if (this.tab === 'shapes') return SHIP_SHAPES.length;
    if (this.tab === 'auras') return SHIP_AURAS.length;
    return SHIP_COLORS.length;
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
    status: string;
    untertitel: string;
    knopf: string;
    knopfAktiv: boolean;
    onClick: () => void;
    onAnprobe: () => void;
    symbol: (x: number, y: number) => Phaser.GameObjects.Image;
  }): void {
    const {
      y,
      getragen,
      akzent,
      titel,
      status,
      untertitel,
      knopf,
      knopfAktiv,
      onClick,
      onAnprobe,
      symbol,
    } = optionen;

    // Das Getragene bekommt den goldenen Rahmen - so ist ohne Text zu sehen,
    // was gerade an der Figur haengt.
    const panel = createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 100, KARTE_HOEHE, akzent, {
      alpha: getragen ? 0.72 : 0.45,
    });
    this.inhalt.push(panel as ScrollElement);

    // Die Anprobe-Flaeche ist ein eigenes, unsichtbares Rechteck - nicht die
    // Trefferflaeche des Panels.
    //
    // Zwei Gruende. Erstens liefert `createPanel` einen Container ohne eigene
    // Geometrie; `setInteractive()` braucht dort eine ausdrueckliche Flaeche.
    // Zweitens muss sie VOR dem Kaufknopf enden, sonst loeste ein Tipp auf
    // "ANZIEHEN" auch die Anprobe aus. Eine versetzte Trefferflaeche am
    // Container loest das nicht: Der Playtest liest ihre Groesse, rechnet sie
    // aber um die Container-Mitte (`x - w/2`) und meldete deshalb eine
    // Ueberlappung, die es gar nicht gab. Ein eigenes Rechteck hat seinen
    // eigenen Mittelpunkt - damit stimmen Wirkung und Messung ueberein.
    const anprobeBreite = GAME_WIDTH - 100 - KNOPF_BREITE - 30;
    const anprobe = this.add
      .rectangle(50 + anprobeBreite / 2, y, anprobeBreite, KARTE_HOEHE, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    anprobe.on('pointerup', onAnprobe);
    this.inhalt.push(anprobe as ScrollElement);
    this.inhalt.push(symbol(120, y) as ScrollElement);

    // Textbreite bis vor den Knopf begrenzen. Ohne das lief die Beschreibung
    // unter die Taste und war dort nicht mehr lesbar.
    const textBreite = GAME_WIDTH - 130 - KNOPF_BREITE / 2 - 180 - 16;

    this.inhalt.push(
      this.add
        .text(
          180,
          y - 35,
          status,
          textStyle(FontSize.tiny, getragen ? Palette.gold : Palette.inkDim, {
            fontStyle: 'bold',
          }),
        )
        .setOrigin(0, 0.5) as ScrollElement,
    );

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
      width: KNOPF_BREITE,
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
