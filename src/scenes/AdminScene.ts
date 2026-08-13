/**
 * Wartungsbildschirm.
 *
 * ## Warum es ihn gibt
 *
 * Als App vom Home-Bildschirm gibt es keine Adressleiste und keinen
 * Reload-Knopf. Haengt dort ein alter Stand im Cache, kommt man ohne Hilfe
 * nicht heraus - und genau das hat vier Runden Fehlersuche gekostet, weil
 * Rueckmeldungen vom Geraet einen Stand beschrieben, der laengst korrigiert
 * war (docs/CODE_STYLE.md 1.9).
 *
 * Dieser Bildschirm beantwortet deshalb zwei Fragen und bietet einen Ausweg:
 *
 * 1. Welcher Stand laeuft gerade?
 * 2. Liegt ein neuerer bereit?
 * 3. Wie komme ich an ihn heran?
 *
 * ## Warum versteckt
 *
 * Er ist Werkzeug, nicht Spielinhalt. Ein sichtbarer Knopf "Spielstand
 * zuruecksetzen" im Menue waere fuer ein neunjaehriges Kind eine Falle. Der
 * Zugang fuehrt deshalb ueber einen langen Druck auf die Versionsnummer -
 * auffindbar fuer den, der davon weiss, unauffaellig fuer alle anderen.
 */

import Phaser from 'phaser';

import { APP_VERSION, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import type { UpdateInfo } from '@/core/updateCheck';
import { isIos, isStandalone } from '@/core/display';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import { createBackButton, createButton, createPanel, createVignette } from '@/ui/widgets';

export class AdminScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  /** Zweiter Tipp bestaetigt das Zuruecksetzen - Absicht statt Versehen. */
  private resetArmed = false;

  constructor() {
    super(SceneKey.Admin);
  }

  create(): void {
    this.resetArmed = false;

    // Schlichter Hintergrund statt Weltkulisse: Das hier ist Werkzeug, kein
    // Spielinhalt - die Trennung soll man sofort sehen.
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop);

    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    this.add
      .text(GAME_WIDTH / 2, 140, 'WARTUNG', textStyle(FontSize.heading, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(6);

    this.buildVersionPanel();
    this.buildActions();

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 180, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 120)
      .setAlign('center');

    void this.lookForUpdate();
  }

  /** Was laeuft, wie es gestartet wurde - die Angaben fuer einen Fehlerbericht. */
  private buildVersionPanel(): void {
    const y = 300;
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 190, Palette.goldHex, { alpha: 0.5 });

    this.add
      .text(GAME_WIDTH / 2, y - 58, `v${APP_VERSION}`, textStyle(FontSize.large, Palette.ink))
      .setOrigin(0.5);

    // Der Startweg entscheidet ueber das Cache-Verhalten: Als installierte App
    // haelt iOS die Dateien deutlich hartnaeckiger als in einem Browser-Tab.
    const modus = isStandalone() ? 'Vom Home-Bildschirm' : 'Im Browser';
    const plattform = isIos() ? 'iOS' : 'anderes System';

    this.add
      .text(
        GAME_WIDTH / 2,
        y - 6,
        `${modus}  ·  ${plattform}`,
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        y + 46,
        'Version wird gesucht ...',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setName('updateLine');
  }

  private buildActions(): void {
    createButton(this, GAME_WIDTH / 2, 520, 'NEU LADEN ERZWINGEN', () => forceReload(), {
      width: 460,
      height: 84,
      accent: Palette.goldHex,
      fontSize: FontSize.body,
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        580,
        'Holt das Spiel frisch vom Server, am Cache vorbei.',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    const reset = createButton(
      this,
      GAME_WIDTH / 2,
      700,
      'SPIELSTAND ZURUECKSETZEN',
      () => {
        // Zwei Tipps: Der erste bewaffnet, der zweite fuehrt aus. Ein
        // versehentlicher Tipp loescht damit nichts.
        if (!this.resetArmed) {
          this.resetArmed = true;
          reset.setLabel('WIRKLICH? NOCHMAL TIPPEN');
          this.setStatus('Level, Talente und Erfolge gehen verloren.', Palette.danger);
          return;
        }

        SaveSystem.reset();
        this.resetArmed = false;
        reset.setLabel('SPIELSTAND ZURUECKSETZEN');
        this.setStatus('Spielstand zurueckgesetzt.', Palette.success);
      },
      {
        width: 460,
        height: 76,
        accent: 0xff6b6b,
        fontSize: FontSize.small,
      },
    );
  }

  /**
   * Fragt den Server nach der verfuegbaren Version.
   *
   * Ergebnis wird angezeigt, nicht erzwungen: Der Nutzer entscheidet, wann er
   * neu laedt - mitten in einem Run waere ein selbsttaetiger Neustart das
   * Gegenteil von hilfreich.
   */
  private async lookForUpdate(): Promise<void> {
    const info: UpdateInfo | null = await checkForUpdate();
    if (!this.scene.isActive()) return;

    const line = this.children.getByName('updateLine');
    if (!(line instanceof Phaser.GameObjects.Text)) return;

    if (!info) {
      line.setText('Aktuellster Stand.').setColor(Palette.success);
      return;
    }

    line.setText(`Neu verfuegbar: v${info.available}`).setColor(Palette.gold);
    this.setStatus('Tippe "Neu laden erzwingen", um sie zu holen.', Palette.gold);
  }

  private setStatus(message: string, color: string): void {
    this.statusText.setText(message).setColor(color);
  }
}
