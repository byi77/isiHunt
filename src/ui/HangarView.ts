import type Phaser from 'phaser';
import {
  getShipAura,
  getShipColor,
  getShipShape,
  SHIP_AURAS,
  SHIP_COLORS,
  SHIP_SHAPES,
} from '@/config/shop';
import type { SaveData } from '@/types';
import {
  cosmeticStatusText,
  getShopCollectionSummaryText,
} from '@/systems/CosmeticCollectionSystem';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import { auraAssetForId, threeDAssetForId } from './egoAssets';
import { ThreeDShipPreview } from './threeDShipPreview';
import { playerTextureForShape } from './textures';
import { AURA_FRAME_RUHE, applyTintShift, SHIP_ANIMATIONS, stehendesBild } from './shipAnimations';
import './hangar.css';

/**
 * Mindeststrecke, ab der ein Ziehen auf der Vorschau als Blaettern zaehlt.
 *
 * Kein Balancing-Wert, sondern eine Eigenschaft der Geste: Darunter liegt das
 * uebliche Zittern beim Drehen, und ein zu kleiner Wert liesse jeden Dreh in
 * einem Schiffswechsel enden. 48 CSS-Pixel sind rund ein Daumenbreit.
 */
const SWIPE_MIN_PX = 48;

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
  private readonly status = document.createElement('p');
  private readonly description = document.createElement('p');
  private readonly balance = document.createElement('span');
  private readonly collection = document.createElement('p');
  private readonly gallery = document.createElement('div');
  private readonly counter = document.createElement('p');
  private readonly buy = document.createElement('button');
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
  /** Startpunkt der laufenden Geste auf der Vorschau - fuer Wischen vs. Drehen. */
  private swipeStart: { x: number; y: number } | null = null;
  /** Zurueckgelegte Gesamtstrecke; trennt einen geraden Wisch vom Bogen. */
  private swipeDistance = 0;
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
    previewArea.setAttribute('aria-label', 'Schiffsvorschau. Ziehen oder Pfeiltasten zum Drehen.');
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
      this.status,
      this.counter,
      this.description,
      this.hint,
      tools,
      details,
    );
    const footer = document.createElement('footer');
    this.buy.className = 'hangar-buy';
    this.buy.addEventListener(
      'click',
      () => {
        const updated = this.callbacks.act(this.tab, this.selection[this.tab]);
        if (updated) this.save = updated;
        this.refresh();
      },
      { signal: this.abort.signal },
    );
    footer.append(
      this.buy,
      this.button('Zum Menue', () => this.callbacks.back()),
    );
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
          ? '3D · Ziehen zum Drehen'
          : '2D-Vorschau · Ziehen zum Drehen';
      },
      true,
    );
    previewArea.addEventListener(
      'pointerdown',
      (event) => {
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.swipeStart = { x: event.clientX, y: event.clientY };
        this.swipeDistance = 0;
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
        this.preview.rotateBy(dx, dy);
        this.fallbackAngle += dx * 0.012;
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      },
      { signal: this.abort.signal },
    );
    // Wischen quer ueber die Vorschau blaettert - dieselbe Flaeche, auf der
    // auch gedreht wird.
    //
    // Die beiden Gesten trennt die Richtung, nicht ein Modus: Ein Dreh ist
    // kurz und oft senkrecht, ein Blaettern ist lang und waagerecht.
    // Ausgewertet wird deshalb erst beim Loslassen, gegen die Gesamtstrecke -
    // wer waehrend des Drehens einmal weit nach rechts faehrt, soll nicht
    // versehentlich das Schiff wechseln.
    previewArea.addEventListener(
      'pointerup',
      (event) => {
        const start = this.swipeStart;
        this.swipeStart = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        const waagerecht = Math.abs(dx) > Math.abs(dy) * 1.6;
        const weitGenug = Math.abs(dx) >= SWIPE_MIN_PX;
        // Ein Bogen legt viel Strecke zurueck, endet aber nahe am Start. Wer
        // gedreht hat, wischt nicht.
        const gerade = this.swipeDistance <= Math.abs(dx) * 1.5;
        if (waagerecht && weitGenug && gerade) this.step(dx < 0 ? 1 : -1);
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
    mark.style.background = 'currentColor';
    mark.style.maskImage = `url("${asset?.previewUrl ?? this.texture(playerTextureForShape(shapeId))}")`;
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
        caption.textContent = item.name;
        tile.append(mark, caption);
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
    this.hull.style.maskImage = `url("${asset?.previewUrl ?? this.texture(playerTextureForShape(shape.id))}")`;
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
    this.balance.textContent = `${this.save.coins.toLocaleString('de-DE')} Coins`;
    const trying =
      this.selection.shapes !== this.save.shipShape ||
      this.selection.colors !== this.save.shipColor ||
      this.selection.auras !== this.save.shipAura;
    this.name.textContent = `${trying ? 'Anprobe' : 'Ausgeruestet'} · ${getShipShape(this.selection.shapes).name} · ${getShipColor(this.selection.colors).name} · ${getShipAura(this.selection.auras).name}`;
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
