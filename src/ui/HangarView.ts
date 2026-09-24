import type Phaser from 'phaser';
import {
  getShipAura,
  getShipColor,
  getShipShape,
  SHIP_AURAS,
  SHIP_COLORS,
  SHIP_SHAPES,
} from '@/config/shop';
import { WORLDS, getWorld } from '@/config/worlds';
import type { SaveData } from '@/types';
import {
  cosmeticStatusText,
  getShopCollectionSummaryText,
} from '@/systems/CosmeticCollectionSystem';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { auraAssetForId, threeDAssetForId } from './egoAssets';
import { createDomIcon } from './iconography';
import { ThreeDShipPreview } from './threeDShipPreview';
import { planetTextureForVariant, playerTextureForShape } from './textures';
import { AURA_FRAME_RUHE, applyTintShift, SHIP_ANIMATIONS, stehendesBild } from './shipAnimations';
import './hangar.css';

/*
 * Wann ein Ziehen ueber die Vorschau blaettert statt zu drehen.
 *
 * Keine Balancing-Werte, sondern Eigenschaften der Geste - deshalb hier und
 * nicht in `config/`. Alle sechs Bedingungen muessen zutreffen; jede einzelne
 * waere fuer sich zu grosszuegig.
 *
 * Die Werte sind bewusst streng gewaehlt: Ein uebersehener Wisch kostet einen
 * zweiten Versuch, ein faelschlich erkannter dagegen die begonnene Drehung.
 * Im Zweifel wird gedreht.
 */

/** Mindestabstand zwischen Anfang und Ende. Rund ein Daumenbreit. */
const SWIPE_MIN_PX = 48;

/**
 * Mindesttempo. Der eigentliche Unterschied zwischen den Gesten.
 *
 * 1,2 px/ms sind 48 Pixel in 40 ms - ein Schnipser. Eine Drehung, bei der man
 * dem Schiff mit den Augen folgt, liegt deutlich darunter; gemessen an einem
 * bewusst gefuehrten Ziehen etwa um den Faktor drei.
 */
const SWIPE_MIN_SPEED_PX_PER_MS = 1.2;

/**
 * Laengstmoegliche Dauer.
 *
 * Zusaetzlich zum Tempo, weil ein sehr langer Wisch auch bei gemaechlichem
 * Tempo den Schwellwert erreichen kann. Was ueber eine Viertelsekunde dauert,
 * ist ein Ziehen.
 */
const SWIPE_MAX_MS = 260;

/** Wie stark der Abstand waagerecht ueberwiegen muss (Ende gegen Anfang). */
const SWIPE_AXIS_RATIO = 3;

/** Wie flach der zurueckgelegte WEG bleiben muss - faengt den Drehbogen. */
const SWIPE_PATH_RATIO = 0.45;

/** Wie gerade der Weg sein muss: Strecke hoechstens so viel mal der Abstand. */
const SWIPE_STRAIGHTNESS = 1.15;

export type HangarTab = 'shapes' | 'colors' | 'auras';
export interface HangarSelection {
  shapes: string;
  colors: string;
  auras: string;
}

/** DOM-Bedienung bleibt in CSS-Pixeln gross; Phaser liefert Texturen und den Takt. */
export class HangarView {
  private readonly root = document.createElement('section');
  private readonly abort = new AbortController();
  private preview!: ThreeDShipPreview;
  private readonly host = document.createElement('div');
  private readonly stage = document.createElement('div');
  private readonly fallback = document.createElement('div');
  private readonly hull = document.createElement('div');
  private readonly aura = document.createElement('div');
  private readonly hint = document.createElement('p');
  private readonly name = document.createElement('p');
  private readonly equippedSummary = document.createElement('p');
  private readonly status = document.createElement('p');
  private readonly description = document.createElement('p');
  private readonly balance = document.createElement('span');
  private readonly collection = document.createElement('p');
  private readonly gallery = document.createElement('div');
  private readonly counter = document.createElement('p');
  private readonly buy = document.createElement('button');
  private readonly photoWorld = document.createElement('select');
  private readonly tabs = new Map<HangarTab, HTMLButtonElement>();
  private readonly textures = new Map<string, string>();
  /**
   * Die Kacheln des gerade gezeigten Reiters, nach Id.
   *
   * Gehalten, damit ein Wechsel nur zwei Kacheln umfaerben muss statt die
   * ganze Leiste neu zu bauen. Ein vollstaendiger `replaceChildren()` bei
   * jedem Tipp setzte die Scrollposition auf Null zurueck - man verlor beim
   * Durchblaettern staendig die Stelle, an der man war.
   */
  private tiles = new Map<string, HTMLButtonElement>();
  private tilesTab: HangarTab | null = null;
  private tab: HangarTab = 'shapes';
  private elapsed = 0;
  private fallbackAngle = 0;
  private pointer: { id: number; x: number; y: number } | null = null;
  /** Start der laufenden Geste auf der Vorschau - Ort und Zeit. */
  private swipeStart: { x: number; y: number; t: number } | null = null;
  /** Zurueckgelegte Gesamtstrecke; trennt einen geraden Wisch vom Bogen. */
  private swipeDistance = 0;
  /** Aufsummierte senkrechte Bewegung; faengt den Drehbogen, der flach endet. */
  private swipeVertical = 0;
  private frameRequest = 0;
  private available = false;
  private previewVisible = true;
  private observer: IntersectionObserver | null = null;
  private force2d = false;
  private readonly resize = (): void => {
    cancelAnimationFrame(this.frameRequest);
    this.frameRequest = requestAnimationFrame(() => this.position());
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private save: SaveData,
    private readonly accent: number,
    private readonly selection: HangarSelection,
    private readonly callbacks: {
      act(tab: HangarTab, id: string): SaveData | null;
      back(): void;
      seen(tab: HangarTab): SaveData;
    },
  ) {
    this.root.className = 'isihunt-hangar';
    this.root.setAttribute('aria-label', 'Hangar');
    const content = document.createElement('div');
    content.className = 'hangar-content';
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = 'Dein Hangar';
    this.balance.className = 'hangar-balance';
    header.append(title, this.balance);
    const previewArea = document.createElement('div');
    previewArea.className = 'hangar-preview';
    previewArea.tabIndex = 0;
    previewArea.setAttribute('role', 'img');
    previewArea.setAttribute(
      'aria-label',
      'Schiffsvorschau. Ziehen oder Pfeiltasten zum Drehen, schnelles Wischen zum Blättern.',
    );
    this.host.className = 'hangar-3d';
    this.stage.className = 'hangar-stage';
    this.fallback.className = 'hangar-stage';
    const platform = document.createElement('div');
    platform.className = 'hangar-platform';
    const engine = document.createElement('div');
    engine.className = 'hangar-engine';
    this.hull.className = 'hangar-hull';
    this.aura.className = 'hangar-aura';
    this.fallback.append(platform, engine, this.hull);
    this.stage.append(this.fallback, this.aura);
    previewArea.append(this.stage, this.host);
    this.name.className = 'hangar-name';
    this.equippedSummary.className = 'hangar-equipped-summary';
    this.status.className = 'hangar-status';
    this.status.setAttribute('aria-live', 'polite');
    this.hint.className = 'hangar-status';
    const tools = document.createElement('div');
    tools.className = 'hangar-tools';
    tools.append(
      this.button('Ansicht zentrieren', () => {
        this.preview.resetRotation();
        this.fallbackAngle = 0;
      }),
      this.button('2D / 3D', () => {
        this.force2d = !this.force2d;
        this.refreshModel();
      }),
    );
    const photoControls = document.createElement('div');
    photoControls.className = 'hangar-photo-controls';
    this.photoWorld.setAttribute('aria-label', 'Hintergrundwelt für Foto wählen');
    for (const world of WORLDS.filter((entry) => entry.unlockLevel <= this.save.level)) {
      const option = document.createElement('option');
      option.value = world.id;
      option.textContent = world.name;
      this.photoWorld.append(option);
    }
    this.photoWorld.value = getWorld(this.save.lastWorldId).id;
    const photoButton = this.button('Foto speichern', () => {
      void this.savePhoto().catch(() => {
        this.hint.textContent = 'Foto konnte nicht gespeichert werden.';
      });
    });
    photoButton.classList.add('hangar-icon-button');
    photoButton.prepend(createDomIcon('world'));
    photoControls.append(this.photoWorld, photoButton);
    const tabs = document.createElement('div');
    tabs.className = 'hangar-tabs';
    for (const [id, label] of [
      ['shapes', 'Schiffe'],
      ['colors', 'Farben'],
      ['auras', 'Auren'],
    ] as const) {
      const button = this.button(label, () => {
        this.save = this.callbacks.seen(this.tab);
        this.tab = id;
        this.refresh();
      });
      this.tabs.set(id, button);
      tabs.append(button);
    }
    // Blaetterbare Bildleiste statt eines `<select>`.
    //
    // Das Dropdown zwang zu einem Ablauf, der das Anprobieren verhinderte:
    // aufklappen, in einer Textliste lesen, zuklappen - und erst dann sah man,
    // wie das Schiff aussieht. Wer stoebern wollte, musste das je Eintrag
    // wiederholen. Bei 35 Formen ist das kein Auswaehlen mehr, sondern Suchen.
    //
    // Die Leiste zeigt alle Eintraege gleichzeitig als Bild; ein Tipp
    // wechselt die grosse Vorschau sofort. Gekauft wird weiterhin nur ueber
    // den Knopf unten - Blaettern kostet nichts.
    this.gallery.className = 'hangar-gallery';
    this.gallery.setAttribute('role', 'listbox');
    this.gallery.setAttribute('aria-label', 'Auswahl zum Anprobieren');
    this.gallery.tabIndex = 0;
    this.counter.className = 'hangar-status';
    // Pfeiltasten blaettern, wenn die Leiste den Fokus hat. Die Vorschau
    // darueber nutzt dieselben Tasten zum Drehen - deshalb haengt das hier an
    // der Leiste und nicht am Fenster.
    this.gallery.addEventListener(
      'keydown',
      (event) => {
        const schritt = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        if (schritt === 0) return;
        event.preventDefault();
        this.step(schritt);
      },
      { signal: this.abort.signal },
    );
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Meine Sammlung';
    details.append(summary, this.collection);
    // Reihenfolge nach Blickverlauf: Was man auswaehlt, steht direkt unter
    // dem, was man dabei ansieht. Die Leiste lag zuerst hinter Hinweis,
    // Werkzeugen und Namenszeile - und damit auf einem Hochformat-Handy
    // ausserhalb des Bildes, obwohl sie das Hauptbedienelement ist.
    content.append(
      header,
      previewArea,
      tabs,
      this.gallery,
      this.name,
      this.equippedSummary,
      this.status,
      this.counter,
      this.description,
      this.hint,
      tools,
      photoControls,
      details,
    );
    const footer = document.createElement('footer');
    this.buy.className = 'hangar-buy';
    this.buy.addEventListener(
      'click',
      () => {
        const equippedBefore = {
          shapes: this.save.shipShape,
          colors: this.save.shipColor,
          auras: this.save.shipAura,
        }[this.tab];
        const updated = this.callbacks.act(this.tab, this.selection[this.tab]);
        if (updated) this.save = updated;
        this.refresh();
        const equippedAfter = {
          shapes: this.save.shipShape,
          colors: this.save.shipColor,
          auras: this.save.shipAura,
        }[this.tab];
        if (equippedBefore !== equippedAfter && !prefersReducedMotion()) {
          previewArea.classList.remove('is-equip-pulse');
          void previewArea.offsetWidth;
          previewArea.classList.add('is-equip-pulse');
        }
      },
      { signal: this.abort.signal },
    );
    const backButton = this.button('Zum Menue', () => this.callbacks.back());
    backButton.classList.add('hangar-icon-button');
    backButton.prepend(createDomIcon('back'));
    footer.append(this.buy, backButton);
    this.root.append(content, footer);
    document.body.append(this.root);
    this.observer = new IntersectionObserver(
      (entries) => {
        this.previewVisible = entries.some((entry) => entry.isIntersecting);
      },
      { root: content },
    );
    this.observer.observe(previewArea);
    this.preview = new ThreeDShipPreview(
      this.host,
      280,
      170,
      (available) => {
        this.available = available;
        this.fallback.style.display = available ? 'none' : 'grid';
        this.hint.textContent = available
          ? '3D · Ziehen zum Drehen, Wischen zum Blättern'
          : '2D-Vorschau · Ziehen zum Drehen, Wischen zum Blättern';
      },
      true,
    );
    previewArea.addEventListener(
      'pointerdown',
      (event) => {
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.swipeStart = { x: event.clientX, y: event.clientY, t: event.timeStamp };
        this.swipeDistance = 0;
        this.swipeVertical = 0;
        previewArea.setPointerCapture(event.pointerId);
      },
      { signal: this.abort.signal },
    );
    previewArea.addEventListener(
      'pointermove',
      (event) => {
        if (this.pointer?.id !== event.pointerId) return;
        const dx = event.clientX - this.pointer.x,
          dy = event.clientY - this.pointer.y;
        this.swipeDistance += Math.hypot(dx, dy);
        this.swipeVertical += Math.abs(dy);
        this.preview.rotateBy(dx, dy);
        this.fallbackAngle += dx * 0.012;
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      },
      { signal: this.abort.signal },
    );
    // Ein schneller Schnipser quer ueber die Vorschau blaettert weiter.
    //
    // ## Warum Geschwindigkeit entscheidet und nicht die Strecke
    //
    // Der erste Entwurf (v0.1.327) trennte nur nach Richtung, Mindeststrecke
    // und Geradlinigkeit - und war damit falsch konstruiert: Wer das Schiff
    // einmal kraeftig herumdreht, erfuellt alle drei. Die Bedingungen
    // beschrieben nicht "Blaettern statt Drehen", sondern "eine kraeftige
    // waagerechte Drehung". Gemeldet als "springt beim Drehen weiter", und
    // zwar zu Recht.
    //
    // Was die Gesten wirklich unterscheidet, ist das Tempo: Ein Dreh ist
    // langsam und fuehrend - man sieht ja hin, waehrend sich das Schiff
    // bewegt. Ein Wisch ist ein kurzer Schnipser, bei dem der Finger schon
    // weg ist, bevor das Auge folgt. Ein langsames Ziehen dreht deshalb
    // beliebig weit, ohne je zu blaettern.
    //
    // Zusaetzlich muss der Weg weitgehend waagerecht bleiben: Nicht nur der
    // Abstand zwischen Anfang und Ende (den erfuellt auch ein Bogen), sondern
    // die aufsummierte senkrechte Bewegung. Wer im Bogen dreht, sammelt dabei
    // Hoehe - und blaettert nicht.
    previewArea.addEventListener(
      'pointerup',
      (event) => {
        const start = this.swipeStart;
        this.swipeStart = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const strecke = Math.abs(dx);
        const dauer = Math.max(1, event.timeStamp - start.t);

        const schnell = strecke / dauer >= SWIPE_MIN_SPEED_PX_PER_MS;
        const kurzGenug = dauer <= SWIPE_MAX_MS;
        const weitGenug = strecke >= SWIPE_MIN_PX;
        const waagerecht = strecke > Math.abs(dy) * SWIPE_AXIS_RATIO;
        // Der Weg selbst, nicht nur sein Ergebnis: Ein Bogen endet waagerecht,
        // war es aber nie.
        const flach = this.swipeVertical <= strecke * SWIPE_PATH_RATIO;
        // Ein gerader Weg legt kaum mehr Strecke zurueck als den Abstand.
        const gerade = this.swipeDistance <= strecke * SWIPE_STRAIGHTNESS;

        if (schnell && kurzGenug && weitGenug && waagerecht && flach && gerade)
          this.step(dx < 0 ? 1 : -1);
      },
      { signal: this.abort.signal },
    );
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      previewArea.addEventListener(
        name,
        () => {
          this.pointer = null;
          if (name !== 'pointerup') this.swipeStart = null;
        },
        { signal: this.abort.signal },
      );
    previewArea.addEventListener(
      'keydown',
      (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const dx = event.key === 'ArrowLeft' ? -16 : event.key === 'ArrowRight' ? 16 : 0;
        this.preview.rotateBy(
          dx,
          event.key === 'ArrowUp' ? -16 : event.key === 'ArrowDown' ? 16 : 0,
        );
        this.fallbackAngle += dx * 0.012;
      },
      { signal: this.abort.signal },
    );
    scene.scale.on('resize', this.resize);
    window.addEventListener('resize', this.resize, { signal: this.abort.signal });
    this.position();
    this.refresh();
  }

  private button(label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', run, { signal: this.abort.signal });
    return button;
  }

  private async savePhoto(): Promise<void> {
    const world = getWorld(this.photoWorld.value);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const background = ctx.createLinearGradient(0, 0, 0, 1080);
    background.addColorStop(0, `#${world.bgTop.toString(16).padStart(6, '0')}`);
    background.addColorStop(1, `#${world.bgBottom.toString(16).padStart(6, '0')}`);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.globalAlpha = 0.4;
    const planet = await this.loadPhotoImage(
      this.texture(planetTextureForVariant(world.spaceVariant)),
    );
    ctx.drawImage(planet, 140, 70, 800, 800);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(540, 690, 290, 80, 0, 0, Math.PI * 2);
    ctx.stroke();
    const aura = getShipAura(this.selection.auras);
    if (aura.animIndex !== null) {
      const auraColor = getShipColor(this.selection.colors).color ?? this.accent;
      ctx.save();
      ctx.strokeStyle = `#${auraColor.toString(16).padStart(6, '0')}`;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = 8;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.ellipse(540, 515, 285, 285, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const ship = await this.loadPhotoImage(
      this.texture(playerTextureForShape(this.selection.shapes)),
    );
    const shipLayer = document.createElement('canvas');
    shipLayer.width = shipLayer.height = 500;
    const shipCtx = shipLayer.getContext('2d');
    if (!shipCtx) return;
    shipCtx.drawImage(ship, 0, 0, 500, 500);
    const tint = getShipColor(this.selection.colors).color;
    if (tint !== null) {
      shipCtx.globalCompositeOperation = 'multiply';
      shipCtx.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
      shipCtx.fillRect(0, 0, 500, 500);
      shipCtx.globalCompositeOperation = 'destination-in';
      shipCtx.drawImage(ship, 0, 0, 500, 500);
    }
    ctx.drawImage(shipLayer, 290, 270, 500, 500);
    ctx.fillStyle = '#f4f1e8';
    ctx.textAlign = 'center';
    ctx.font = 'bold 50px Trebuchet MS, sans-serif';
    ctx.fillText(getShipShape(this.selection.shapes).name, 540, 920);
    ctx.font = '28px Trebuchet MS, sans-serif';
    ctx.fillText(`${getShipColor(this.selection.colors).name} · ${aura.name}`, 540, 970);
    ctx.fillText(world.name, 540, 1010);
    const link = document.createElement('a');
    link.download = `isihunt-${this.selection.shapes}-${world.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.hint.textContent = 'Foto gespeichert · 1080 × 1080';
  }

  private loadPhotoImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Foto-Bild konnte nicht geladen werden.'));
      image.src = src;
    });
  }

  private position(): void {
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const bottom =
      document.getElementById('safe-bottom')?.getBoundingClientRect().bottom ?? innerHeight;
    Object.assign(this.root.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${Math.min(rect.height, bottom - rect.top)}px`,
    });
    const area = this.host.parentElement;
    if (area) this.preview.resize(area.clientWidth, area.clientHeight);
  }

  private texture(key: string): string {
    let value = this.textures.get(key);
    if (!value) {
      value = this.scene.textures.getBase64(key);
      this.textures.set(key, value);
    }
    return value;
  }

  /** Der Katalog des gerade gezeigten Reiters. */
  private catalog(): readonly { id: string; name: string }[] {
    return this.tab === 'shapes' ? SHIP_SHAPES : this.tab === 'colors' ? SHIP_COLORS : SHIP_AURAS;
  }

  /**
   * Blaettert um `schritt` Eintraege weiter und laeuft dabei ueber die Enden.
   *
   * Umlaufend, weil die Leiste zum Stoebern da ist: Am letzten Schiff
   * anzustossen und nicht weiterzukommen waere genau die Sackgasse, die das
   * Dropdown schon hatte.
   */
  private step(schritt: number): void {
    const catalog = this.catalog();
    const jetzt = catalog.findIndex((entry) => entry.id === this.selection[this.tab]);
    const naechste = (jetzt + schritt + catalog.length) % catalog.length;
    this.choose(catalog[naechste]!.id);
  }

  /** Uebernimmt eine Auswahl und holt ihre Kachel in den sichtbaren Bereich. */
  private choose(id: string): void {
    this.selection[this.tab] = id;
    this.elapsed = 0;
    this.refresh();
    this.tiles.get(id)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /**
   * Das Vorschaubild einer Kachel.
   *
   * Schiffe tragen ihre Silhouette als Maske - dieselbe Textur, die auch das
   * Spiel zeichnet, also ohne zusaetzliche Bilddateien. Farben brauchen kein
   * Bild, sie sind eines. Auren zeigen die Silhouette des getragenen Schiffs,
   * weil eine Aura ohne Traeger nichts darstellt.
   */
  private paintTile(tile: HTMLButtonElement, id: string): void {
    const mark = tile.querySelector('i');
    if (!mark) return;
    if (this.tab === 'colors') {
      const farbe = getShipColor(id).color;
      mark.style.maskImage = '';
      // Die Weltfarbe hat keinen festen Wert - sie wird als Verlauf gezeigt,
      // damit sie nicht wie ein weiterer grauer Ton aussieht.
      mark.style.background =
        farbe === null
          ? 'conic-gradient(#ffd479, #35d6c3, #c084fc, #ff4d5e, #ffd479)'
          : `#${farbe.toString(16).padStart(6, '0')}`;
      return;
    }
    const shapeId = this.tab === 'shapes' ? id : this.selection.shapes;
    const asset = threeDAssetForId(getShipShape(shapeId).threeDAssetId);
    mark.style.background = '';
    mark.style.backgroundColor = 'currentColor';
    this.paintShip(mark, shapeId, asset?.previewUrl);
  }

  /**
   * Zeigt ein Schiff mit seiner Binnenzeichnung statt als blosse Silhouette.
   *
   * Bis 2026-09-24 trug das Element die Textur nur als Maske und war sonst
   * einfarbig - Kanzel, Paneele und Triebwerke gingen verloren, der Hangar
   * zeigte einen weissen Scherenschnitt. Jetzt liegt dieselbe Textur zusaetzlich
   * als Hintergrund darunter und wird mit der Farbe multipliziert: genau die
   * Rechnung, mit der Phaser im Spiel einfaerbt. Die Maske bleibt fuer den Umriss.
   *
   * 3D-Modelle bringen eigene, aus dem OBJ abgeleitete Vorschaubilder mit.
   * Diese enthalten inzwischen ebenfalls Kanzel, Panzerplatten und Triebwerke.
   */
  private paintShip(element: HTMLElement, shapeId: string, previewUrl?: string): void {
    const url = previewUrl ?? this.texture(playerTextureForShape(shapeId));
    element.style.maskImage = `url("${url}")`;
    element.style.backgroundImage = `url("${url}")`;
    element.style.backgroundSize = 'contain';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';
    element.style.backgroundBlendMode = 'multiply';
  }

  /** Baut die Leiste neu - nur beim Reiterwechsel, nicht bei jeder Auswahl. */
  private buildGallery(): void {
    const catalog = this.catalog();
    this.tiles = new Map();
    this.gallery.replaceChildren(
      ...catalog.map((item) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'hangar-tile';
        tile.setAttribute('role', 'option');
        tile.title = item.name;
        const mark = document.createElement('i');
        const caption = document.createElement('span');
        const state = document.createElement('small');
        state.className = 'hangar-tile-state';
        caption.textContent = item.name;
        tile.append(mark, caption, state);
        tile.addEventListener('click', () => this.choose(item.id), {
          signal: this.abort.signal,
        });
        this.tiles.set(item.id, tile);
        return tile;
      }),
    );
    for (const [id, tile] of this.tiles) this.paintTile(tile, id);
    this.tilesTab = this.tab;
    // Nach dem Neuaufbau steht die Leiste am Anfang. Wer bereits etwas traegt,
    // soll es sehen, ohne erst dorthin blaettern zu muessen. `instant`, weil
    // ein Reiterwechsel kein Ort fuer eine Laufanimation ist.
    this.tiles
      .get(this.selection[this.tab])
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
  }

  private refreshModel(): void {
    const shape = getShipShape(this.selection.shapes);
    const asset = threeDAssetForId(shape.threeDAssetId);
    this.paintShip(this.hull, shape.id, asset?.previewUrl);
    this.preview.setModel(
      this.force2d ? undefined : threeDAssetForId(shape.threeDAssetId),
      getShipColor(this.selection.colors).color ?? 0xffffff,
    );
  }

  private refresh(): void {
    const catalog =
      this.tab === 'shapes' ? SHIP_SHAPES : this.tab === 'colors' ? SHIP_COLORS : SHIP_AURAS;
    const owned =
      this.tab === 'shapes'
        ? this.save.ownedShipShapes
        : this.tab === 'colors'
          ? this.save.ownedShipColors
          : this.save.ownedShipAuras;
    const equipped =
      this.tab === 'shapes'
        ? this.save.shipShape
        : this.tab === 'colors'
          ? this.save.shipColor
          : this.save.shipAura;
    if (this.tilesTab !== this.tab) this.buildGallery();
    const aktiv = this.selection[this.tab];
    for (const [id, tile] of this.tiles) {
      const gehoert = owned.includes(id);
      tile.setAttribute('aria-selected', String(id === aktiv));
      tile.classList.toggle('is-active', id === aktiv);
      tile.classList.toggle('is-owned', gehoert && id !== equipped);
      tile.classList.toggle('is-equipped', id === equipped);
      // Was man noch nicht hat, bleibt sichtbar, aber zurueckgenommen: Der
      // Laden soll zeigen, was es gibt - ein verstecktes Ziel weckt kein
      // Sparen. Die Farben brauchen die Daempfung nicht, sie SIND das Bild.
      tile.classList.toggle('is-locked', !gehoert && this.tab !== 'colors');
      const state = tile.querySelector('.hangar-tile-state');
      if (state)
        state.textContent =
          id === equipped ? 'Getragen' : id === aktiv ? 'Anprobe' : gehoert ? 'Besitz' : 'Gesperrt';
    }
    // Die Auren-Kacheln tragen die Silhouette des gewaehlten Schiffs - wechselt
    // die Form, muessen sie neu gezeichnet werden.
    if (this.tab === 'auras') for (const [id, tile] of this.tiles) this.paintTile(tile, id);
    const item = catalog.find((entry) => entry.id === aktiv) ?? catalog[0]!;
    const position = catalog.findIndex((entry) => entry.id === item.id) + 1;
    this.counter.textContent = `${position} von ${catalog.length} · ${owned.length} im Besitz`;
    const level = 'minLevel' in item ? item.minLevel : 0;
    const isOwned = owned.includes(item.id),
      isEquipped = equipped === item.id;
    this.balance.replaceChildren(
      createDomIcon('coins'),
      document.createTextNode(`${this.save.coins.toLocaleString('de-DE')} Coins`),
    );
    const trying =
      this.selection.shapes !== this.save.shipShape ||
      this.selection.colors !== this.save.shipColor ||
      this.selection.auras !== this.save.shipAura;
    this.name.textContent = `${trying ? 'Anprobe' : 'Ausgerüstet'} · ${getShipShape(this.selection.shapes).name} · ${getShipColor(this.selection.colors).name} · ${getShipAura(this.selection.auras).name}`;
    this.equippedSummary.textContent = `Getragen: ${getShipShape(this.save.shipShape).name} · ${getShipColor(this.save.shipColor).name} · ${getShipAura(this.save.shipAura).name}`;
    this.status.textContent = `${item.name}: ${cosmeticStatusText(this.save, this.tab, item.id, isEquipped)}${level > this.save.level ? ` · ab Level ${level}` : ''}`;
    this.description.textContent =
      'description' in item
        ? item.description
        : 'Weltfarbe: heller Rumpf, Effekte in der Farbe der Raumzone. Andere Farben faerben auch den Rumpf.';
    this.buy.textContent = isEquipped
      ? 'Bereits ausgeruestet'
      : level > this.save.level
        ? `Ab Level ${level}`
        : isOwned
          ? `${item.name} ausruesten`
          : `Kaufen · ${item.cost.toLocaleString('de-DE')} Coins`;
    this.buy.disabled =
      isEquipped || level > this.save.level || (!isOwned && this.save.coins < item.cost);
    if (!isOwned && this.save.coins < item.cost)
      this.status.textContent += ` · ${item.cost - this.save.coins} Coins fehlen`;
    const summary = getShopCollectionSummaryText(this.save);
    this.collection.textContent = `${summary.counts}. ${summary.activity}`;
    for (const [tab, button] of this.tabs)
      button.setAttribute('aria-pressed', String(tab === this.tab));
    this.refreshModel();
    this.update(0);
  }

  update(delta: number): void {
    if (document.hidden || !this.previewVisible) return;
    this.elapsed += Math.max(0, delta);
    const aura = getShipAura(this.selection.auras);
    const animation = aura.animIndex === null ? undefined : SHIP_ANIMATIONS[aura.animIndex];
    const frame = !animation
      ? AURA_FRAME_RUHE
      : prefersReducedMotion()
        ? stehendesBild(animation)
        : animation(this.elapsed);
    const tint = applyTintShift(getShipColor(this.selection.colors).color ?? 0xffffff, frame.tint);
    const css = `#${tint.toString(16).padStart(6, '0')}`;
    this.hull.style.backgroundColor = css;
    this.hull.style.opacity = String(frame.alpha);
    this.hull.style.transform = `rotate(${this.fallbackAngle + frame.rotation}rad) scale(${frame.scaleX},${frame.scaleY})`;
    const asset = auraAssetForId(aura.assetId);
    this.aura.style.display = asset ? 'block' : 'none';
    if (asset) {
      const index = prefersReducedMotion()
        ? 0
        : Math.floor(this.elapsed / asset.frameDurationMs) % asset.frameTextureKeys.length;
      const key = asset.frameTextureKeys[index];
      if (key) this.aura.style.maskImage = `url("${this.texture(key)}")`;
      this.aura.style.backgroundColor = `#${applyTintShift(
        getShipColor(this.selection.colors).color ?? this.accent,
        frame.tint,
      )
        .toString(16)
        .padStart(6, '0')}`;
    }
    this.preview.setAuraVisible(aura.animIndex !== null);
    this.preview.setAppearance(tint, frame);
    if (this.available) this.preview.update(delta);
  }

  destroy(): void {
    this.callbacks.seen(this.tab);
    this.abort.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frameRequest);
    this.scene.scale.off('resize', this.resize);
    this.preview.destroy();
    this.root.remove();
    this.textures.clear();
  }
}
