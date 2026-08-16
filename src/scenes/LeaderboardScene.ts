/**
 * Online-Bestenliste: gemeinsame Gesamtansicht mit Weltfiltern.
 *
 * Die Liste laedt beim Betreten und bei jedem Weltwechsel. Waehrenddessen
 * bleibt der Bildschirm bedienbar - ein haengender Netzaufruf darf nie dazu
 * fuehren, dass man nicht zurueck ins Menue kommt.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld, WORLDS } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import type { LeaderboardEntry } from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { planetTextureForVariant, TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle, toCss } from '@/ui/theme';
import {
  createBackButton,
  createBackStatusText,
  createDriftLayers,
  createMenuLayout,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

const ROW_HEIGHT = 72;

export class LeaderboardScene extends Phaser.Scene {
  /**
   * Welt, nach der gefiltert wird - `null` heisst: alle Welten zusammen.
   *
   * Die Gesamtansicht ist der Normalfall. Eine Liste je Welt zersplittert den
   * Wettbewerb: Bei fuenf Welten und drei Spielern steht ueberall jeder auf
   * Platz eins, und niemand vergleicht sich mit irgendwem.
   */
  private filter: WorldDef | null = null;
  /** Welt, deren Farben den Hintergrund stellen - auch in der Gesamtansicht. */
  private backdropWorld!: WorldDef;
  private listItems: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private listTop = 0;
  /** Zaehlt Ladevorgaenge, damit eine veraltete Antwort nichts ueberschreibt. */
  private requestId = 0;

  constructor() {
    super(SceneKey.Leaderboard);
  }

  create(data: { worldId?: string } = {}): void {
    SafeAreaSystem.showStatic('RANGLISTE');
    const save = SaveSystem.load();

    this.filter = data.worldId ? (WORLDS.find((w) => w.id === data.worldId) ?? null) : null;
    this.backdropWorld = this.filter ?? WORLDS.find((w) => w.id === save.lastWorldId) ?? WORLDS[0]!;
    this.listItems = [];
    this.requestId = 0;

    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.backdropWorld.bgTop,
      this.backdropWorld.bgBottom,
      this.backdropWorld.accent,
      this.backdropWorld.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, this.backdropWorld.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    const sections = createMenuLayout().sections;
    this.buildWorldTabs(sections.next(138));
    this.listTop = sections.currentTop();

    this.statusText = createBackStatusText(this);

    void this.loadList();
  }

  /**
   * Waagerechte Auswahl: erst "alle Welten", dann die einzelnen.
   *
   * Der erste Punkt ist die Gesamtansicht und damit die Voreinstellung. Die
   * uebrigen filtern - nur freigeschaltete sind anwaehlbar.
   */
  private buildWorldTabs(sectionY: number): void {
    const level = SaveSystem.load().level;
    const y = sectionY - 35;
    // Ein Platz mehr als Welten: der erste gehoert der Gesamtansicht.
    const spacing = (GAME_WIDTH - 120) / (WORLDS.length + 1);

    this.buildAllTab(60 + spacing * 0.5, y, spacing);

    WORLDS.forEach((world, index) => {
      const x = 60 + spacing * (index + 1.5);
      const isUnlocked = world.unlockLevel <= level;
      const isActive = world.id === this.filter?.id;

      const marker = this.add
        .image(x, y, planetTextureForVariant(world.spaceVariant))
        .setScale(isActive ? 0.06 : 0.04)
        .setAlpha(isUnlocked ? (isActive ? 1 : 0.5) : 0.18);

      if (!isUnlocked) return;

      // Trefferflaeche deutlich groesser als der Punkt.
      //
      // Die Marker sind auf 34 % skaliert - das sind rund 12 CSS-Pixel auf dem
      // Handy, ein Viertel des Mindestmasses aus ART_STYLE.md 8. Ein Objekt
      // selbst interaktiv zu machen bedeutet, dass seine Skalierung auch die
      // Trefferflaeche schrumpft; hier war der Punkt praktisch nicht zu treffen.
      //
      // Die Flaeche wird deshalb ueber die Textur hinaus aufgezogen. `spacing`
      // ist der Abstand zum naechsten Marker - die Haelfte davon fuellt die
      // Luecke, ohne den Nachbarn zu erreichen.
      // Die Flaeche wird in Texturkoordinaten angegeben (Orb ist 64x64, der
      // Mittelpunkt liegt bei 32/32) und von Phaser mit `scale` verrechnet -
      // deshalb muss hier durch die Skalierung geteilt werden, damit am Ende
      // `hitSize` Bildschirmpixel herauskommen.
      const hitSize = Math.min(spacing - 8, 92);
      const halfX = hitSize / 2 / marker.scaleX;
      const halfY = hitSize / 2 / marker.scaleY;

      marker.setInteractive(
        new Phaser.Geom.Rectangle(32 - halfX, 32 - halfY, halfX * 2, halfY * 2),
        Phaser.Geom.Rectangle.Contains,
      );
      // Der Handcursor gehoert in die Konfigurationsform von setInteractive und
      // laesst sich nicht neben eine eigene Trefferflaeche stellen - hier
      // direkt gesetzt.
      if (marker.input) marker.input.cursor = 'pointer';

      marker.on('pointerup', () => {
        if (world.id === this.filter?.id) return;
        // Neu aufbauen statt selektiv aendern - der Hintergrund wechselt mit.
        this.scene.restart({ worldId: world.id });
      });
    });

    const title = this.filter?.name ?? 'ALLE WELTEN';
    const color = this.filter ? toCss(this.filter.accent) : Palette.gold;

    this.add
      .text(GAME_WIDTH / 2, y + 52, title, textStyle(FontSize.body, color, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 90,
        this.filter ? 'Stern links antippen für alle Welten' : 'Welt antippen zum Filtern',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);
  }

  /**
   * Der Punkt ganz links: alle Welten zusammen.
   *
   * Bewusst als Stern und nicht als weiterer Kreis - er ist keine Welt,
   * sondern deren Summe, und das soll man ohne Lesen sehen.
   */
  private buildAllTab(x: number, y: number, spacing: number): void {
    const isActive = this.filter === null;

    const marker = this.add
      .image(x, y, TextureKey.Shard)
      .setTint(Palette.goldHex)
      .setScale(isActive ? 1.5 : 1.05)
      .setAlpha(isActive ? 1 : 0.5);

    // Dieselbe grosszuegige Trefferflaeche wie bei den Welt-Punkten: Die
    // Textur ist winzig, getroffen wird sie mit dem Daumen (ART_STYLE.md 8).
    const hitSize = Math.min(spacing - 8, 92);
    const halfX = hitSize / 2 / marker.scaleX;
    const halfY = hitSize / 2 / marker.scaleY;

    marker.setInteractive(
      new Phaser.Geom.Rectangle(12 - halfX, 12 - halfY, halfX * 2, halfY * 2),
      Phaser.Geom.Rectangle.Contains,
    );
    if (marker.input) marker.input.cursor = 'pointer';

    marker.on('pointerup', () => {
      if (this.filter === null) return;
      this.scene.restart({});
    });
  }

  private async loadList(): Promise<void> {
    const requestId = ++this.requestId;
    this.clearList();
    this.statusText.setText('Wird geladen ...').setColor(Palette.inkDim);

    const result = await CloudSystem.fetchLeaderboard(this.filter?.id);

    // Zwischenzeitlich wurde die Welt gewechselt oder die Scene verlassen -
    // diese Antwort ist nicht mehr die aktuelle.
    if (requestId !== this.requestId || !this.scene.isActive()) return;

    if (!result.ok) {
      this.statusText
        .setText(`Bestenliste nicht erreichbar.\n${result.error}`)
        .setColor(Palette.danger);
      return;
    }

    if (result.value.length === 0) {
      const scope = this.filter ? 'dieser Welt' : 'den Welten';
      this.statusText
        .setText(`Noch kein Eintrag in ${scope}.\nSpiel einen Run mit Namen und sei dabei.`)
        .setColor(Palette.inkDim);
      return;
    }

    this.statusText.setText('');
    this.renderList(result.value);
  }

  private renderList(entries: readonly LeaderboardEntry[]): void {
    const ownId = AuthSystem.currentUserId() ?? SaveSystem.load().cloudId;

    entries.forEach((entry, index) => {
      const y = this.listTop + index * ROW_HEIGHT;
      const isOwn = ownId !== null && entry.playerId === ownId;
      const isPodium = index < 3;

      if (isOwn) {
        this.listItems.push(
          createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 110, ROW_HEIGHT - 6, Palette.goldHex, {
            alpha: 0.4,
            radius: 10,
          }),
        );
      }

      const rankColor = isPodium ? Palette.gold : Palette.inkDim;
      const world = getWorld(entry.worldId);

      this.listItems.push(
        this.add
          .image(112, y, planetTextureForVariant(world.spaceVariant))
          .setScale(0.035)
          .setAlpha(0.95),
        this.add
          .text(76, y, `${index + 1}`, textStyle(FontSize.small, rankColor, { fontStyle: 'bold' }))
          .setOrigin(0, 0.5),
        this.add
          .text(
            134,
            y - 10,
            entry.playerName,
            textStyle(FontSize.small, isOwn ? Palette.gold : Palette.ink),
          )
          .setOrigin(0, 0.5),
        this.add
          .text(134, y + 15, 'LEVEL ' + entry.level, textStyle(FontSize.tiny, Palette.inkDim))
          .setOrigin(0, 0.5),
        this.add
          .text(
            GAME_WIDTH - 76,
            y,
            entry.score.toLocaleString('de-DE'),
            textStyle(FontSize.small, Palette.ink, { fontStyle: 'bold' }),
          )
          .setOrigin(1, 0.5),
      );
    });
  }

  private clearList(): void {
    for (const item of this.listItems) item.destroy();
    this.listItems = [];
  }
}
