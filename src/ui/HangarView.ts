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
  private readonly select = document.createElement('select');
  private readonly buy = document.createElement('button');
  private readonly tabs = new Map<HangarTab, HTMLButtonElement>();
  private readonly textures = new Map<string, string>();
  private tab: HangarTab = 'shapes';
  private elapsed = 0;
  private fallbackAngle = 0;
  private pointer: { id: number; x: number; y: number } | null = null;
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
    const label = document.createElement('label');
    label.textContent = 'Auswahl zum Anprobieren';
    this.select.id = 'hangar-selection';
    label.htmlFor = this.select.id;
    this.select.addEventListener(
      'change',
      () => {
        this.selection[this.tab] = this.select.value;
        this.elapsed = 0;
        this.refresh();
      },
      { signal: this.abort.signal },
    );
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Meine Sammlung';
    details.append(summary, this.collection);
    content.append(
      header,
      previewArea,
      this.hint,
      tools,
      this.name,
      this.status,
      tabs,
      label,
      this.select,
      this.description,
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
        this.preview.rotateBy(dx, dy);
        this.fallbackAngle += dx * 0.012;
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      },
      { signal: this.abort.signal },
    );
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      previewArea.addEventListener(
        name,
        () => {
          this.pointer = null;
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
    this.select.replaceChildren(
      ...catalog.map((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name}${item.id === equipped ? ' · getragen' : owned.includes(item.id) ? ' · im Besitz' : ''}`;
        return option;
      }),
    );
    this.select.value = this.selection[this.tab];
    const item = catalog.find((entry) => entry.id === this.selection[this.tab]) ?? catalog[0]!;
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
