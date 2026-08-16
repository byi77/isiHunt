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
 * zurücksetzen" im Menue waere fuer ein neunjaehriges Kind eine Falle. Der
 * Zugang fuehrt deshalb ueber einen langen Druck auf die Versionsnummer -
 * auffindbar fuer den, der davon weiss, unauffaellig fuer alle anderen.
 */

import Phaser from 'phaser';

import { APP_VERSION, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { checkForUpdate, forceReload } from '@/core/updateCheck';
import type { UpdateInfo } from '@/core/updateCheck';
import { measureDevice, readWebStorageLine } from '@/core/deviceReport';
import { formatLayout, measureLayout } from '@/core/layoutReport';
import { isIos, isStandalone } from '@/core/display';
import { SceneKey } from '@/scenes/SceneKey';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import {
  createBackButton,
  createBackStatusText,
  createButton,
  createPanel,
  createMenuLayout,
  createVignette,
  paintSafeAreaBackdrop,
} from '@/ui/widgets';

export class AdminScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  /** Zweiter Tipp bestaetigt das Zuruecksetzen - Absicht statt Versehen. */
  private resetArmed = false;

  /**
   * Voruebergehend aus: Die Reset-Logik bleibt fuer spaetere Wartung erhalten,
   * darf aber im laufenden Testbetrieb nicht versehentlich benutzt werden.
   */
  private static readonly RESET_ENABLED = false;

  constructor() {
    super(SceneKey.Admin);
  }

  create(): void {
    SafeAreaSystem.showStatic('WARTUNG');
    this.resetArmed = false;

    // Schlichter Hintergrund statt Weltkulisse: Das hier ist Werkzeug, kein
    // Spielinhalt - die Trennung soll man sofort sehen.
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(Palette.backdrop);

    // Auch die Streifen ausserhalb des Spielfelds auf den Grundton setzen -
    // sonst bliebe hier die Farbe der zuletzt gezeigten Welt stehen.
    paintSafeAreaBackdrop(Palette.backdrop, Palette.backdrop);

    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    const sections = createMenuLayout().sections;
    const versionY = sections.next(170);
    const layoutY = sections.next(360);
    this.buildVersionPanel(versionY);
    void this.buildLayoutPanel(layoutY);
    this.buildActions(layoutY);

    this.statusText = createBackStatusText(this);

    void this.lookForUpdate();
  }

  /**
   * Die tatsaechlichen Layout-Werte des Geraets.
   *
   * Ein Browser-Simulator kennt keine sicheren Raender - nur hier stehen die
   * echten Zahlen. Ohne sie bliebe die Frage "warum verschwindet der
   * Zurück-Knopf unter der Notch" eine Vermutung.
   */
  private async buildLayoutPanel(y: number): Promise<void> {
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 360, 0x9aa3bd, { alpha: 0.5 });

    this.add
      .text(
        GAME_WIDTH / 2,
        y - 160,
        'LAYOUT AUF DIESEM GERÄT',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);

    const report = measureLayout(this.game.canvas);

    this.add
      .text(84, y - 145, formatLayout(report), textStyle(15, Palette.ink))
      .setOrigin(0, 0)
      .setLineSpacing(4);

    this.add
      .text(84, y - 8, 'GERÄT / BROWSER', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0, 0)
      .setLetterSpacing(3);

    const device = measureDevice();
    const deviceText = this.add
      .text(
        84,
        y + 18,
        [...device.lines, device.storageLine].join('\n'),
        textStyle(14, Palette.ink),
      )
      .setOrigin(0, 0)
      .setLineSpacing(3)
      .setName('deviceReport');

    const storageLine = await readWebStorageLine();
    if (this.scene.isActive()) deviceText.setText([...device.lines, storageLine].join('\n'));
  }

  /** Was laeuft, wie es gestartet wurde - die Angaben fuer einen Fehlerbericht. */
  private buildVersionPanel(y: number): void {
    createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 170, Palette.goldHex, { alpha: 0.5 });

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
  }

  private buildActions(layoutY: number): void {
    const actions = createMenuLayout(8).sections;
    actions.advance(layoutY + 215 - actions.currentTop());
    const updateY = actions.next(54);
    const reloadY = actions.next(54);
    const repairY = actions.next(54);
    const statsY = actions.next(54);
    const usersY = actions.next(54);
    const rulerY = actions.next(54);

    createButton(this, GAME_WIDTH / 2, updateY, 'UPDATE PRÜFEN', () => void this.checkUpdateNow(), {
      width: 460,
      height: 54,
      accent: 0x9aa3bd,
      fontSize: FontSize.small,
    });

    createButton(this, GAME_WIDTH / 2, reloadY, 'NEU LADEN ERZWINGEN', () => forceReload(), {
      width: 460,
      height: 54,
      accent: Palette.goldHex,
      fontSize: FontSize.small,
    });

    createButton(
      this,
      GAME_WIDTH / 2,
      repairY,
      'SPIELSTAND PRÜFEN & SPEICHERN',
      () => this.repairSave(),
      {
        width: 460,
        height: 54,
        accent: 0x9aa3bd,
        fontSize: FontSize.small,
      },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      statsY,
      'ONLINE-STATISTIK',
      () => {
        this.scene.start(SceneKey.AdminStats);
      },
      { width: 460, height: 54, accent: Palette.goldHex, fontSize: FontSize.small },
    );

    createButton(
      this,
      GAME_WIDTH / 2,
      usersY,
      'BENUTZER-WERKZEUGE',
      () => this.scene.start(SceneKey.AdminUsers),
      { width: 460, height: 54, accent: Palette.goldHex, fontSize: FontSize.small },
    );

    /* Lokales Testprofil bleibt bewusst aus dem Wartungsmenue entfernt.
    createPanel(this, GAME_WIDTH / 2, 1090, GAME_WIDTH - 120, 150, Palette.goldHex, {
      alpha: 0.35,
      radius: 16,
    });
    this.add
      .text(GAME_WIDTH / 2, 1038, 'LOKALES TESTPROFIL', textStyle(FontSize.tiny, Palette.gold))
      .setOrigin(0.5)
      .setLetterSpacing(3);
    this.add
      .text(
        GAME_WIDTH / 2,
        1066,
        'Level 100 · 99.999 Coins · bleibt offline',
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5);

    const pinInput = createTextInput(this, 210, 1110, {
      inputType: 'password',
      placeholder: 'Test-PIN',
      maxLength: 6,
      numeric: true,
      numericKeyboard: true,
      width: 220,
      accent: Palette.goldHex,
    });
    const testButton = createButton(
      this,
      535,
      1110,
      SaveSystem.isTestProfileActive() ? 'TESTPROFIL AUS' : 'TESTPROFIL AN',
      () => {
        if (pinInput.getValue() !== SaveSystem.ADMIN_TEST_PIN) {
          this.setStatus('Falsche Test-PIN.', Palette.danger);
          return;
        }

        if (SaveSystem.isTestProfileActive()) {
          SaveSystem.disableTestProfile();
          testButton.setLabel('TESTPROFIL AN');
          this.setStatus('Normaler Spielstand wiederhergestellt.', Palette.success);
        } else {
          SaveSystem.enableTestProfile();
          testButton.setLabel('TESTPROFIL AUS');
          this.setStatus('Testprofil aktiv: Level 100 und 99.999 Coins.', Palette.success);
        }
        pinInput.setValue('');
      },
      { width: 210, height: 62, accent: Palette.goldHex, fontSize: FontSize.tiny },
    );

    */
    // Lineal ueber dem Menue: Damit lassen sich Layout-Fehler in Zahlen
    // beschreiben statt in Worten ("von 0 bis 160 ist schwarz").
    createButton(
      this,
      GAME_WIDTH / 2,
      rulerY,
      'PIXEL-LINEAL ANZEIGEN',
      () => {
        this.scene.start(SceneKey.Menu);
        this.scene.launch(SceneKey.Ruler);
      },
      { width: 460, height: 54, accent: 0x9aa3bd, fontSize: FontSize.small },
    );

    const reset = createButton(
      this,
      GAME_WIDTH / 2,
      1120,
      'SPIELSTAND ZURÜCKSETZEN',
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
        reset.setLabel('SPIELSTAND ZURÜCKSETZEN');
        this.setStatus('Spielstand zurückgesetzt.', Palette.success);
      },
      {
        width: 460,
        height: 76,
        accent: 0xff6b6b,
        fontSize: FontSize.small,
      },
    );

    if (!AdminScene.RESET_ENABLED) {
      reset.container.setVisible(false);
      reset.setEnabled(false);
      reset.setLabel('RESET VORÜBERGEHEND DEAKTIVIERT');
    }
  }

  private async checkUpdateNow(): Promise<void> {
    this.setStatus('Version wird erneut geprüft ...', Palette.inkDim);
    await this.lookForUpdate();
  }

  private repairSave(): void {
    const save = SaveSystem.load();
    SaveSystem.save(save);
    this.setStatus('Spielstand geprüft, migriert und gespeichert.', Palette.success);
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

    if (!info) {
      this.setStatus('Kein neuer Stand verfügbar.', Palette.success);
      return;
    }

    this.setStatus(`Update v${info.available}: Neu laden erzwingen.`, Palette.gold);
  }

  private setStatus(message: string, color: string): void {
    this.statusText.setText(message).setColor(color);
  }
}
