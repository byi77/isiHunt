/**
 * Spielstand zwischen Geraeten abgleichen.
 *
 * ## Der Ablauf
 *
 * Geraet A erzeugt einen Code, Geraet B tippt ihn ein. Danach zeigen beide auf
 * denselben Eintrag im Online-Speicher, und weitere Abgleiche gehen in beide
 * Richtungen.
 *
 * ## Warum der Konflikt sichtbar gemacht wird
 *
 * Wenn auf beiden Geraeten gespielt wurde, gibt es zwei Spielstaende und keine
 * Regel, die verlaesslich den richtigen waehlt. "Der neuere gewinnt" verliert
 * genau dann Wochen an Fortschritt, wenn man auf dem Zweitgeraet kurz eine
 * Runde gespielt hat.
 *
 * Deshalb wird nichts automatisch entschieden: Beide Staende stehen mit Level,
 * Bestwert und Anzahl Runs nebeneinander, und uebernommen wird erst auf
 * ausdrueckliche Ansage. Das ist ein Tipp mehr - und keine verlorenen Wochen.
 */

import Phaser from 'phaser';

import { SYNC_CODE_LENGTH } from '@/config/backend';
import { DEBUG_ENABLED, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { measureDomElement } from '@/core/layoutReport';
import { getWorld } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as CloudSystem from '@/systems/CloudSystem';
import type { RemoteSave } from '@/systems/CloudSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import type { TextInputHandle } from '@/ui/textInput';
import { createTextInput } from '@/ui/textInput';
import {
  createBackButton,
  createButton,
  createDriftLayers,
  createPanel,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';

/** "1 Run" statt "1 Runs" - direkt nach dem ersten Spiel sichtbar. */
function runs(count: number): string {
  return `${count} ${count === 1 ? 'Run' : 'Runs'}`;
}

export class SyncScene extends Phaser.Scene {
  /** Verhindert doppelte Netzaufrufe durch mehrfaches Tippen. */
  private busy = false;
  private statusText!: Phaser.GameObjects.Text;
  private codeInput: TextInputHandle | null = null;
  private transient: Phaser.GameObjects.GameObject[] = [];

  /** Nur in der Vergleichsphase gesetzt. */
  private pending: { cloudId: string; save: RemoteSave } | null = null;

  constructor() {
    super(SceneKey.Sync);
  }

  create(): void {
    this.busy = false;
    this.pending = null;
    this.transient = [];

    const world = getWorld(SaveSystem.load().lastWorldId);
    createWorldBackdrop(this, GAME_WIDTH, GAME_HEIGHT, world.bgTop, world.bgBottom, world.accent);
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);

    // Tiefer als der Zurueck-Knopf oben links, damit sich Ueberschrift und
    // Trefferflaeche nicht in die Quere kommen.
    this.add
      .text(
        GAME_WIDTH / 2,
        140,
        'SPIELSTAND',
        textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setLetterSpacing(3);

    this.add
      .text(
        GAME_WIDTH / 2,
        176,
        'Zwischen deinen Geraeten abgleichen',
        textStyle(FontSize.small, Palette.inkDim),
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 140, '', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 120)
      .setAlign('center');

    createBackButton(this, () => this.scene.start(SceneKey.Menu));

    this.buildStart();
  }

  // --- Phase: Auswahl ---------------------------------------------------------

  private buildStart(): void {
    this.clearTransient();

    const save = SaveSystem.load();

    this.keep(createPanel(this, GAME_WIDTH / 2, 300, GAME_WIDTH - 120, 150, Palette.goldHex));
    this.keep(
      this.add
        .text(GAME_WIDTH / 2, 258, 'Dieses Geraet', textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0.5)
        .setLetterSpacing(4),
    );
    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          312,
          `Level ${save.level}  ·  Bestwert ${save.bestScore.toLocaleString('de-DE')}  ·  ${runs(save.totalRuns)}`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5),
    );

    this.keep(
      createButton(this, GAME_WIDTH / 2, 470, 'CODE ERZEUGEN', () => void this.generateCode(), {
        width: 440,
        accent: Palette.goldHex,
        fontSize: FontSize.body,
      }).container,
    );
    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          534,
          'Auf DIESEM Geraet, wenn du den Stand woanders hin holen willst',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 140)
        .setAlign('center'),
    );

    this.keep(
      this.add
        .text(GAME_WIDTH / 2, 640, 'ODER', textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0.5)
        .setLetterSpacing(6),
    );

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          712,
          'Code vom anderen Geraet eingeben',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5),
    );

    this.codeInput = createTextInput(this, GAME_WIDTH / 2, 782, {
      placeholder: '· · · · · ·',
      maxLength: SYNC_CODE_LENGTH,
      width: 340,
      uppercase: true,
      onSubmit: () => void this.redeem(),
    });
    this.keep(this.codeInput.element);

    // Wo das Feld WIRKLICH liegt, statt wo es liegen sollte.
    //
    // Phaser haengt DOM-Elemente in einen eigenen Container, der unabhaengig
    // vom Canvas skaliert wird. Nachgerechnet lag hier zwischen Feld und Knopf
    // reichlich Luft - auf dem Geraet ueberlappten sie trotzdem. Diese Messung
    // beendet das Raten (docs/CODE_STYLE.md 1.8).
    if (DEBUG_ENABLED) {
      this.time.delayedCall(100, () => {
        const node = this.codeInput?.element.node;
        if (!(node instanceof HTMLElement)) return;

        const box = measureDomElement(node, this.game.canvas);
        if (box) {
          console.warn(
            `[SyncScene] Code-Feld liegt bei Spiel-y ${box.top.toFixed(0)}..${box.bottom.toFixed(0)}` +
              ` (gezeichnet fuer 746..818), Knopf ab 892`,
          );
        }
      });
    }

    // Grosszuegiger Abstand zum Eingabefeld: 172 px zwischen gezeichneter
    // Feldunterkante (818) und Knopfoberkante (990).
    //
    // Die Zahl ist bewusst hoch. Zwei Anlaeufe mit "rechnerisch reicht das"
    // sind gescheitert: erst 24 px, dann 74 px - beide Male lag das Feld auf
    // dem Geraet trotzdem auf dem Knopf. Phaser haengt DOM-Elemente in einen
    // eigenen Container, dessen Position nicht zwingend zum Canvas passt, und
    // bei offener Systemtastatur schiebt iOS zusaetzlich.
    //
    // Solange die genaue Ursache nicht gemessen ist (die Ausgabe oben liefert
    // sie), ist Abstand die einzige belastbare Massnahme.
    this.keep(
      createButton(this, GAME_WIDTH / 2, 1028, 'CODE EINLOESEN', () => void this.redeem(), {
        width: 440,
        height: 76,
        accent: 0x9aa3bd,
        fontSize: FontSize.body,
      }).container,
    );
  }

  // --- Phase: Code anzeigen ---------------------------------------------------

  private async generateCode(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.setStatus('Spielstand wird hochgeladen ...', Palette.inkDim);

    const result = await CloudSystem.createSyncCode();
    this.busy = false;
    if (!this.scene.isActive()) return;

    if (!result.ok) {
      this.setStatus(result.error, Palette.danger);
      return;
    }

    this.showCode(result.value);
  }

  private showCode(code: string): void {
    this.clearTransient();
    this.setStatus('', Palette.inkDim);

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          360,
          'Diesen Code am anderen Geraet eingeben',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 140)
        .setAlign('center'),
    );

    this.keep(createPanel(this, GAME_WIDTH / 2, 480, GAME_WIDTH - 160, 140, Palette.goldHex));

    const label = this.add
      .text(
        GAME_WIDTH / 2,
        480,
        code,
        textStyle(FontSize.title, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5)
      .setScale(0.5);
    label.setLetterSpacing(10);
    this.tweens.add({ targets: label, scale: 1, duration: 380, ease: 'Back.Out' });
    this.keep(label);

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          586,
          'Gueltig fuer 15 Minuten',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    this.keep(
      createButton(this, GAME_WIDTH / 2, 720, 'FERTIG', () => this.buildStart(), {
        width: 360,
        height: 76,
        accent: 0x9aa3bd,
        fontSize: FontSize.body,
      }).container,
    );
  }

  // --- Phase: Vergleich -------------------------------------------------------

  private async redeem(): Promise<void> {
    if (this.busy) return;

    const raw = this.codeInput?.getValue() ?? '';
    const code = CloudSystem.normalizeSyncCode(raw);

    if (code.length !== SYNC_CODE_LENGTH) {
      this.setStatus(`Ein Code hat ${SYNC_CODE_LENGTH} Zeichen.`, Palette.danger);
      return;
    }

    this.busy = true;
    this.setStatus('Code wird geprueft ...', Palette.inkDim);

    const result = await CloudSystem.redeemSyncCode(code);
    this.busy = false;
    if (!this.scene.isActive()) return;

    if (!result.ok) {
      this.setStatus(result.error, Palette.danger);
      return;
    }

    if (!result.value) {
      this.setStatus('Code unbekannt oder abgelaufen.', Palette.danger);
      return;
    }

    this.pending = result.value;
    this.showComparison(result.value.save);
  }

  private showComparison(remote: RemoteSave): void {
    this.clearTransient();
    this.setStatus('', Palette.inkDim);

    const local = SaveSystem.load();

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          268,
          'Welchen Stand willst du behalten?',
          textStyle(FontSize.body, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5),
    );

    this.buildSaveCard(
      400,
      'DIESES GERAET',
      local.level,
      local.bestScore,
      local.totalRuns,
      0x9aa3bd,
    );
    this.buildSaveCard(
      600,
      'HERUNTERGELADEN',
      remote.level,
      remote.bestScore,
      remote.totalRuns,
      Palette.goldHex,
    );

    this.keep(
      createButton(this, GAME_WIDTH / 2, 768, 'HERUNTERGELADENEN NEHMEN', () => this.adopt(), {
        width: 500,
        height: 82,
        accent: Palette.goldHex,
        fontSize: FontSize.small,
      }).container,
    );

    this.keep(
      createButton(this, GAME_WIDTH / 2, 866, 'ABBRECHEN', () => this.buildStart(), {
        width: 320,
        height: 70,
        accent: 0x9aa3bd,
        fontSize: FontSize.small,
      }).container,
    );

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          930,
          'Der Stand dieses Geraets wird dabei ueberschrieben.',
          textStyle(FontSize.tiny, Palette.danger),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 140)
        .setAlign('center'),
    );
  }

  private buildSaveCard(
    y: number,
    title: string,
    level: number,
    bestScore: number,
    totalRuns: number,
    accent: number,
  ): void {
    this.keep(createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 150, accent));

    this.keep(
      this.add
        .text(104, y - 44, title, textStyle(FontSize.tiny, Palette.inkDim))
        .setOrigin(0, 0.5)
        .setLetterSpacing(4),
    );

    this.keep(
      this.add
        .text(
          104,
          y + 14,
          `Level ${level}`,
          textStyle(FontSize.large, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );

    this.keep(
      this.add
        .text(
          GAME_WIDTH - 104,
          y + 20,
          `Bestwert ${bestScore.toLocaleString('de-DE')}\n${runs(totalRuns)}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(1, 0.5)
        .setAlign('right'),
    );
  }

  private adopt(): void {
    if (!this.pending) return;

    SaveSystem.adoptRemote(this.pending.save.data, this.pending.cloudId);
    this.pending = null;

    // Ins Menue statt hier zu bleiben: Level, Welten und Bestwert haben sich
    // gerade geaendert, und das Menue ist der Bildschirm, der das zeigt.
    this.scene.start(SceneKey.Menu);
  }

  // --- Hilfen -----------------------------------------------------------------

  private setStatus(message: string, color: string): void {
    this.statusText.setText(message).setColor(color);
  }

  private keep(object: Phaser.GameObjects.GameObject): void {
    this.transient.push(object);
  }

  /** Raeumt alles weg, was zur aktuellen Phase gehoert. */
  private clearTransient(): void {
    for (const object of this.transient) object.destroy();
    this.transient = [];
    // Das Eingabefeld ist ein DOM-Element und haengt in `transient`; die
    // Referenz muss trotzdem gelassen werden, sonst zeigt sie ins Leere.
    this.codeInput = null;
  }
}
