/**
 * Das HUD laeuft als eigene Scene ueber der GameScene.
 *
 * Warum getrennt: Die Anzeige braucht kein Spiellogik-Wissen und die Logik
 * kein Anzeige-Wissen. Kommunikation ausschliesslich ueber den EventBus. So
 * laesst sich das HUD komplett umbauen, ohne GameScene anzufassen - und die
 * GameScene liesse sich sogar headless testen.
 */

import Phaser from 'phaser';

import { COMBO_TIERS, GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import { getWorld } from '@/config/worlds';
import { eventBus, GameEvent } from '@/core/EventBus';
import { SceneKey } from '@/scenes/SceneKey';
import { Depth } from '@/ui/depth';
import { TextureKey } from '@/ui/textures';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import { calculateHudLayout } from '@/ui/hudLayout';
import { prefersReducedMotion } from '@/systems/AccessibilitySystem';
import type { BarHandle, ButtonHandle } from '@/ui/widgets';
import { createBar, createButton, createPanel } from '@/ui/widgets';
import type { ActiveTalentLine } from '@/types';
import type { RunMode } from '@/types';

/**
 * Deckkraft des Kopfschleiers an seiner staerksten Stelle, ganz oben.
 *
 * Keine Balancing-Zahl, sondern eine Ablesbarkeitsgrenze: Darunter flimmern
 * die Zahlen auf hellen Welten wie Glutnebel, darueber wird aus dem Schleier
 * wieder die Flaeche, die das Spielfeld verdeckt hat.
 */
const PLATE_MAX_ALPHA = 0.55;

/**
 * Kontur hinter den Kopfzahlen.
 *
 * Traegt die Lesbarkeit, seit der Untergrund nach unten auslaeuft: Eine
 * Kontur wirkt auf jedem Untergrund, eine Flaeche nur auf dem, den sie
 * verdeckt. Vier Pixel sind genug, um auf der hellsten Welt zu tragen, ohne
 * dass die Ziffern fett wirken.
 */
const HUD_TEXT_STROKE = { stroke: '#0b1020', strokeThickness: 4 } as const;

/**
 * Der Gluecktreffer-Schriftzug: Form einer Bewegung, kein Balancing-Wert.
 *
 * Die Zahlen beschreiben ausschliesslich, wie sich der Einschlag anfuehlt -
 * an den Punkten aendert keine von ihnen etwas. Deshalb stehen sie hier und
 * nicht in `config/` (dieselbe Trennung wie in `CollectionEffects`).
 *
 * `MIN_GAP_MS` ist die einzige, die etwas verhindert: Mit Gluecktreffer auf
 * Rang 5 faellt rechnerisch alle vier Sekunden ein Krit, und ein
 * bildschirmfuellender Schriftzug in dieser Dichte verdeckt mehr Spielfeld,
 * als er Freude macht. Faellt ein Krit in die Sperre, bleiben Punkte und
 * Feldanzeige unberuehrt - nur der grosse Schriftzug entfaellt.
 */
/**
 * Ab welchem Rest des Serienfensters gewarnt wird, und ab welcher Serie.
 *
 * Ein Viertel ist bei 900 ms Grundfenster gut eine Fuenftelsekunde - kurz
 * genug, dass die Warnung dringend wirkt, lang genug, um noch zu handeln.
 * Unter Serie 4 bleibt sie aus: Dort ist nichts verloren, was ein Fang nicht
 * in Sekunden zurueckholt, und eine dauernd rot blinkende Zeile waere
 * Rauschen statt Warnung.
 */
const COMBO_WARN_RATIO = 0.25;
const COMBO_WARN_MIN_SERIES = 4;

/**
 * Die Serie, ab der das HUD den Jackpot feiert.
 *
 * Genau die Stufe, an der `COMBO_TIERS` endet - ab hier traegt jeder weitere
 * Fang nur noch `COMBO_MULTIPLIER_PER_EXTRA_SERIES`. Aus der Konfiguration
 * gelesen statt als Zahl geschrieben, damit eine Balance-Aenderung den
 * Moment mitnimmt, statt ihn auf einer alten Stufe stehen zu lassen.
 */
const SERIES_JACKPOT = COMBO_TIERS[COMBO_TIERS.length - 1]?.minCombo ?? 16;

const CRIT_BURST = {
  /** Anlaufgroesse - der Schriftzug kommt aus dem Nichts. */
  startScale: 0.3,
  /** Wie schnell er auf volle Groesse einschlaegt. */
  hitMs: 90,
  /** Volle Groesse, bewusst ueber 1: der Schlag ueberzeichnet. */
  hitScale: 1.25,
  /** Wie lange er dann steht, bevor er verweht. */
  holdMs: 110,
  /** Dauer des Verwehens. */
  fadeMs: 220,
  /** Wie weit er dabei noch aufreisst. */
  endScale: 1.8,
  /** Hoehe im Bild, als Anteil der Bildschirmhoehe. */
  screenY: 0.3,
  /** Mindestabstand zwischen zwei Schriftzuegen. */
  minGapMs: 1500,
} as const;

export interface HudSceneData {
  worldId: string;
  durationMs: number;
  mode?: RunMode;
  /** Im Duell: wer gerade spielt. Sonst null. */
  playerLabel?: string | null;
  /** Im Duell ab Durchgang zwei: die Vorlage des Gegners. Sonst null. */
  scoreToBeat?: number | null;
  /** Die aktiven Talentverstaerkungen, je eine Zeile. Leer = keine aktiv. */
  talentLines?: readonly ActiveTalentLine[];
  /** Anzeigenamen aller Spieler, indiziert nach dem Server-Slot. */
  opponentLabels?: (string | null)[];
  /** Eigener Server-Slot im Netzwerk-Duell. */
  localPlayerIndex?: number;
  /** Anzahl der Spieler im aktuellen Netzwerk-Duell. */
  playerCount?: number;
  /**
   * Nur im Netzwerk-Duell: dann zeigt das HUD den laufenden Stand des
   * Gegners. Als Flag vom Aufrufer statt per `ChallengeSystem`-Abfrage -
   * dieselbe Linie wie `playerLabel`/`scoreToBeat`: das HUD stellt dar, es
   * entscheidet nicht, welche Duell-Art laeuft (ADR-0003).
   */
  showOpponentLive?: boolean;
}

export class HudScene extends Phaser.Scene {
  private layout!: ReturnType<typeof calculateHudLayout>;
  private plate!: Phaser.GameObjects.Graphics;
  private scoreCaption!: Phaser.GameObjects.Text;
  private timeCaption!: Phaser.GameObjects.Text;
  private talentLines: readonly ActiveTalentLine[] = [];
  private talentText!: Phaser.GameObjects.Text;
  private pauseButton!: ButtonHandle;
  private pauseReason: 'manual' | 'interrupted' = 'manual';
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private multiplierBurstText!: Phaser.GameObjects.Text;
  /** Der Gluecktreffer-Schriftzug. Zwei Zeilen: Wort und Punktzahl. */
  private critBurstText!: Phaser.GameObjects.Text;
  private critBurstPointsText!: Phaser.GameObjects.Text;
  /** Zeitpunkt des letzten Schriftzugs - traegt die Wiederholungssperre. */
  private lastCritBurstAt = Number.NEGATIVE_INFINITY;
  /** Der leerlaufende Balken unter der Serienzeile. */
  private comboWindowBar!: BarHandle;
  /** Warnt die Serienzeile gerade? Verhindert ein Tween je Frame. */
  private comboWarning = false;
  /** Schon gefeiert? Der Jackpot-Moment gehoert einmal je Serie. */
  private jackpotCelebrated = false;
  private timerText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private targetText: Phaser.GameObjects.Text | null = null;
  /** Nur im Netzwerk-Duell: laufende Staende der anderen Slots. */
  private opponentLiveTexts = new Map<number, Phaser.GameObjects.Text>();
  private opponentLabels: (string | null)[] = [];
  private opponentScores = new Map<number, number>();
  private opponentActivities = new Map<number, 'playing' | 'away' | 'left' | 'finished' | 'gone'>();
  private localPlayerIndex = 0;
  private playerCount = 2;
  private multiplierText!: Phaser.GameObjects.Text;
  /**
   * Beweglichkeitsbonus der Serie. Unsichtbar, solange die Serie keinen
   * traegt - eine dauerhafte "+0 %"-Zeile waere nur Rauschen.
   */
  private agilityText!: Phaser.GameObjects.Text;
  /** Im Run gesammelte XP. Unsichtbar ohne Einsicht-Talent. */
  private xpText!: Phaser.GameObjects.Text;
  private xpTotal = 0;
  /** Eigener Stand, gespiegelt fuer den Abstandsvergleich in der Gegnerzeile. */
  private lastOwnScore = 0;
  private timerBar!: BarHandle;
  private accent = 0xffffff;
  private scoreToBeat: number | null = null;
  private hasOvertaken = false;
  private mode: RunMode = 'solo';
  private lastComboMultiplier = 1;
  /** Zuletzt angezeigte Beweglichkeitsstufe in Prozent. */
  private lastAgilityPercent = 0;
  /** Alle Teile des Pause-Bildschirms - zusammen ein- und ausgeblendet. */
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: SceneKey.Hud, active: false });
  }

  /** Presentation-only exclusion zone; never changes spawn or collision bounds. */
  get collectionSafeTop(): number {
    return this.layout?.headerHeight ?? 0;
  }

  create(data: HudSceneData): void {
    const world = getWorld(data.worldId);
    this.accent = world.accent;
    this.scoreToBeat = data.scoreToBeat ?? null;
    this.hasOvertaken = false;
    this.mode = data.mode ?? 'solo';
    this.talentLines = data.talentLines ?? [];
    this.opponentLabels = data.opponentLabels ? [...data.opponentLabels] : [];
    this.localPlayerIndex = Number.isInteger(data.localPlayerIndex) ? data.localPlayerIndex! : 0;
    this.playerCount = Math.max(2, Math.min(4, Math.floor(data.playerCount ?? 2)));
    this.opponentLiveTexts.clear();
    this.opponentScores.clear();
    this.opponentActivities.clear();
    this.lastOwnScore = 0;
    this.lastComboMultiplier = 1;
    this.lastAgilityPercent = 0;
    this.lastCritBurstAt = Number.NEGATIVE_INFINITY;
    this.comboWarning = false;
    this.jackpotCelebrated = false;
    this.xpTotal = 0;
    this.pauseOverlay = [];
    this.targetText = null;

    this.plate = this.add.graphics().setDepth(Depth.Backdrop);
    this.scoreCaption = this.add
      .text(0, 0, 'PUNKTE', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5, 0);
    this.timeCaption = this.add
      .text(0, 0, 'ZEIT', textStyle(FontSize.tiny, Palette.inkDim))
      .setOrigin(0.5, 0);

    this.worldText = this.add
      .text(
        GAME_WIDTH / 2,
        34,
        (data.playerLabel ?? world.name).toUpperCase(),
        textStyle(FontSize.tiny, data.playerLabel ? Palette.gold : Palette.inkDim),
      )
      .setOrigin(0.5, 0);
    this.worldText.setLetterSpacing(1);

    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 62, '0', textStyle(FontSize.title, Palette.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5, 0);

    // Serie und Multiplikator stehen seit 2026-09-19 in EINER Zeile.
    //
    // Vorher lagen sie untereinander und nahmen zwei von drei Kopfzeilen
    // ein, obwohl sie eine einzige Aussage sind: "Serie 7, also x3,2." Die
    // Trennung zwang dazu, zwei Stellen zu lesen, um eine Zahl zu verstehen
    // - und kostete die Hoehe, aus der jetzt der Fensterbalken lebt.
    //
    // Die Aufteilung folgt den anderen Spalten: Beschriftung klein darueber
    // (`scoreCaption`, `timeCaption`), die Zahl gross darunter. "SERIE 7"
    // ist hier die Beschriftung, der Multiplikator die Zahl.
    this.comboText = this.add
      .text(
        GAME_WIDTH - 60,
        76,
        'SERIE 0',
        textStyle(FontSize.tiny, Palette.inkDim, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0);

    this.multiplierText = this.add
      .text(
        GAME_WIDTH - 60,
        76 + 32,
        '×1',
        textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
      )
      .setOrigin(0.5, 0);

    // Der Rest des Serienfensters, direkt unter dem Multiplikator.
    //
    // Bis hierher war das die einzige Groesse, die das Spiel jeden Frame
    // berechnete und nur dem zeigte, der Fokus gelernt hatte (der Ring um
    // die Figur, `Player.updateTalentVisuals`). Dabei ist es die Frage, an
    // der die Serien-Taktik haengt: Reicht die Zeit noch fuer ein farbiges
    // Relikt, oder rettet ein weisses die Kette?
    this.comboWindowBar = createBar(this, 0, 0, 1, 1, this.accent);
    this.comboWindowBar.setRatio(0);
    this.comboWindowBar.container.setAlpha(0);

    this.agilityText = this.add
      .text(
        GAME_WIDTH - 60,
        76 + 32 * 2,
        '',
        textStyle(FontSize.tiny, Palette.success, { fontStyle: 'bold' }),
      )
      .setOrigin(1, 0)
      .setAlpha(0);

    // Die im Run gesammelten XP, links unter der Punktzahl.
    //
    // Stand bis 2026-09-19 als dritte Zeile am Fang-Label im Spielfeld und
    // zwang dort zum Lesen, waehrend das Spiel weiterlief. Als Summe oben
    // taugt sie mehr: Der Einzelwert eines Fangs sagt wenig, der Stand nach
    // 40 Faengen schon. Unsichtbar ohne Einsicht-Talent - eine dauerhafte
    // "0 XP"-Zeile waere nur Rauschen (dieselbe Regel wie beim Tempobonus).
    this.xpText = this.add
      .text(60, 76 + 32 * 2, '', textStyle(FontSize.tiny, Palette.success, { fontStyle: 'bold' }))
      .setOrigin(0, 0)
      .setAlpha(0);

    this.talentText = this.add
      .text(
        GAME_WIDTH / 2,
        168,
        this.talentLines.length ? 'TALENTE AKTIV - DETAILS IN PAUSE' : '',
        textStyle(FontSize.tiny, Palette.gold, {
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        }),
      )
      .setOrigin(0.5, 0)
      .setAlign('center')
      .setWordWrapWidth(GAME_WIDTH - 90)
      .setLineSpacing(2)
      .setAlpha(this.talentLines.length ? 1 : 0);

    this.multiplierBurstText = this.add
      .text(GAME_WIDTH / 2, 250, '', textStyle(FontSize.title, Palette.gold, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(Depth.Overlay)
      .setAlpha(0);

    // Wort und Punktzahl als zwei Objekte, nicht als ein zweizeiliger Text:
    // Beide sollen gemeinsam skalieren, aber unterschiedlich gross und
    // verschieden gefaerbt sein. Ein Text mit Zeilenumbruch kann das nicht.
    this.critBurstText = this.add
      .text(
        GAME_WIDTH / 2,
        0,
        'KRITISCH',
        textStyle(FontSize.title, Palette.gold, {
          fontStyle: 'bold',
          stroke: '#0b1020',
          strokeThickness: 8,
          align: 'center',
        }),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay + 2)
      .setAlpha(0);
    this.critBurstText.setLetterSpacing(2);
    this.critBurstPointsText = this.add
      .text(
        GAME_WIDTH / 2,
        0,
        '',
        textStyle(FontSize.body, Palette.ink, {
          fontStyle: 'bold',
          stroke: '#0b1020',
          strokeThickness: 6,
          align: 'center',
        }),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay + 2)
      .setAlpha(0);

    this.timerBar = createBar(this, 60, 24, GAME_WIDTH - 120, 8, this.accent);
    this.timerBar.setRatio(1);

    // Zahlen bleiben hell; die Kontur haelt wechselnde Welten ruhig.
    this.timerText = this.add
      .text(
        GAME_WIDTH - 60,
        40,
        `${Math.ceil(data.durationMs / 1000)}s`,
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(1, 0);

    // Die Kopfzahlen stehen seit 2026-09-19 auf einem auslaufenden Schleier
    // statt auf einer deckenden Flaeche (siehe `drawPlate`). Die Kontur ist
    // das, was sie stattdessen lesbar haelt - auf Glutnebel ebenso wie auf
    // Nullsektor. `talentText` hat seine eigene, staerkere: Es steht am
    // weitesten unten, wo der Schleier praktisch nichts mehr traegt.
    for (const text of [
      this.worldText,
      this.scoreCaption,
      this.timeCaption,
      this.scoreText,
      this.timerText,
      this.comboText,
      this.multiplierText,
      this.agilityText,
      this.xpText,
    ])
      text.setStroke(HUD_TEXT_STROKE.stroke, HUD_TEXT_STROKE.strokeThickness);

    // Im zweiten Duell-Durchgang steht links, was zu schlagen ist. Ohne diese
    // Zahl waere der zweite Spieler bis zum Ergebnisbildschirm blind.
    if (this.scoreToBeat !== null) {
      this.targetText = this.add
        .text(
          60,
          40,
          `Ziel ${this.scoreToBeat.toLocaleString('de-DE')}`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0, 0);
    }

    // Netzwerk-Duell: links oben, damit die Gegnerinfo nicht mehr mit der
    // Serienanzeige oder dem eigenen Punktestand konkurriert. Die Anzeige
    // bleibt bis zum ersten Stand unsichtbar; eine vorgezogene "0" waere
    // nicht von einem tatsaechlich bei null stehenden Gegner zu unterscheiden.
    if (data.showOpponentLive) {
      for (let playerIndex = 0; playerIndex < this.playerCount; playerIndex += 1) {
        if (playerIndex === this.localPlayerIndex) continue;
        const text = this.add
          .text(
            60,
            48 + this.opponentLiveTexts.size * 30,
            '',
            textStyle(FontSize.small, Palette.inkDim),
          )
          .setOrigin(0, 0)
          .setAlpha(0);
        this.opponentLiveTexts.set(playerIndex, text);
      }
    }

    this.relayout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout);

    this.registerEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unregisterEvents());
  }

  // --- Pause ----------------------------------------------------------------

  /**
   * Pause-Knopf unten rechts.
   *
   * Nicht oben: Dort stehen Punktestand, Timer und im Duell die Vorlage - und
   * oben ist die Ecke, in die man beim Spielen schaut. Unten rechts liegt er in
   * Daumenreichweite und trotzdem ausserhalb des Spielfelds
   * (PLAYFIELD_PADDING_BOTTOM haelt die unteren 120 px frei).
   */
  private buildPauseButton(): void {
    this.pauseButton?.container.destroy();
    const l = this.layout;
    this.pauseButton = createButton(this, l.pauseX, l.pauseY, 'II', () => this.requestPause(), {
      width: l.pauseSize,
      height: l.pauseSize,
      fontSize: l.font(16),
    });
    this.pauseButton.container.setDepth(Depth.Overlay);
  }

  /** Reflow existing values; resizing must never reset a live run. */
  private readonly relayout = (): void => {
    const canvas = this.game.canvas.getBoundingClientRect();
    const safeBottom =
      document.getElementById('safe-bottom')?.getBoundingClientRect().bottom ?? window.innerHeight;
    const rows =
      this.opponentLiveTexts.size + (this.targetText ? 1 : 0) + (this.talentText.text ? 1 : 0);
    const l = (this.layout = calculateHudLayout(
      canvas.width,
      canvas.height,
      rows,
      Math.max(0, canvas.bottom - safeBottom),
    ));
    const place = (
      text: Phaser.GameObjects.Text,
      x: number,
      y: number,
      font: number,
      width: number,
    ) => {
      this.tweens.killTweensOf(text);
      text
        .setScale(1)
        .setOrigin(0.5, 0)
        .setPosition(x, y * l.unit)
        .setFontSize(l.font(font));
      this.fit(text, width);
    };
    // Alle Zeilen um die Balkenhoehe nach unten - er liegt jetzt darueber.
    place(this.worldText, GAME_WIDTH / 2, 9, 10, l.width);
    place(this.scoreCaption, l.scoreX, 26, 10, l.columnWidth);
    place(this.timeCaption, l.timeX, 26, 10, l.columnWidth);
    // Die Punktzahl ist die groesste Zahl im Kopf, die Zeit die kleinste.
    //
    // Vorher standen beide auf 24 - gleich gross, obwohl die Zeit ihren
    // eigenen Balken darueber hat und man sie ohnehin nur streift. Die
    // Punktzahl ist das, wofuer man spielt; sie darf den Platz bekommen,
    // den die Zeit nicht braucht.
    place(this.scoreText, l.scoreX, 38, 28, l.columnWidth);
    place(this.timerText, l.timeX, 41, 19, l.columnWidth);
    place(this.comboText, l.comboX, 26, 10, l.columnWidth);
    place(this.multiplierText, l.comboX, 39, 24, l.columnWidth);
    // Der Fensterbalken sitzt unter dem Multiplikator, in der Breite der
    // Serienspalte. `createBar` zeichnet von links, deshalb der Versatz um
    // eine halbe Spalte.
    const windowBarWidth = l.columnWidth * 0.8;
    this.comboWindowBar.container
      .setPosition(l.comboX - windowBarWidth / 2, 66 * l.unit)
      .setScale(windowBarWidth, l.unit * 0.25);
    place(this.agilityText, l.comboX, 72, 9, l.columnWidth);
    // Links unter der Punktzahl - die Spalte, die sonst leer bleibt.
    this.xpText.setPosition(l.scoreX - l.columnWidth / 2, 68 * l.unit).setFontSize(l.font(9));
    // Der Zeitbalken sitzt ueber den Zahlen, nicht darunter.
    //
    // Unten lag er auf der Kante zum Spielfeld und zwang die Kopfflaeche
    // dazu, bis dorthin undurchsichtig zu bleiben. Oben schliesst er den
    // Bildschirmrand ab: Die Zeit ist die eine Angabe, die man im Blick
    // behaelt, ohne hinzusehen - dort stoert sie am wenigsten und verdeckt
    // nichts vom Feld.
    this.timerBar.container
      .setPosition(l.margin, 2 * l.unit)
      .setScale(l.width / (GAME_WIDTH - 120), l.unit * 0.375);
    let row = 0;
    for (const text of [this.targetText, ...this.opponentLiveTexts.values(), this.talentText]) {
      if (!text || (text === this.talentText && !text.text)) continue;
      text
        .setWordWrapWidth(0)
        .setOrigin(0, 0)
        .setPosition(l.margin, l.rowY(row++))
        .setFontSize(l.font(11));
      this.fit(text, l.width);
    }
    this.drawPlate(l.headerHeight);
    this.multiplierBurstText.setFontSize(l.font(19));
    // Bewusst gross: Der Schriftzug soll die obere Spielfeldhaelfte fuellen,
    // nicht in ihr stehen. `fit` haelt ihn auf schmalen Geraeten im Bild.
    //
    // Ein Drehen des Geraets mitten im Einschlag bricht ihn ab, statt ihn
    // auf die neue Groesse umzurechnen: Der ganze Effekt dauert 420 ms, und
    // eine halb fertige Skalierung auf einem neu vermessenen Bildschirm
    // saehe aus wie ein Darstellungsfehler.
    this.tweens.killTweensOf([this.critBurstText, this.critBurstPointsText]);
    this.critBurstText.setScale(1).setAlpha(0).setFontSize(l.font(38));
    this.fit(this.critBurstText, l.width);
    this.critBurstPointsText.setScale(1).setAlpha(0).setFontSize(l.font(16));
    this.buildPauseButton();
    if (this.pauseOverlay.length) {
      this.hidePauseOverlay();
      this.showPauseOverlay(this.pauseReason);
    }
  };

  /**
   * Der Untergrund der Kopfzeile: ein nach unten auslaufender Schleier.
   *
   * Frueher war das eine abgerundete Flaeche mit 94 % Deckkraft. Sie verdeckte
   * die obersten rund 170 Pixel des Spielfelds vollstaendig - auf einem
   * Hochformat-Handy ein Achtel der Hoehe, in dem Relikte erscheinen und
   * wieder verblassen konnten, ohne je sichtbar zu werden. Gemeldet
   * 2026-09-19 ("bedeckt dort noch Spielfeld").
   *
   * Jetzt bleibt oben gerade so viel Deckung, dass die Zahlen lesbar sind, und
   * sie laeuft nach unten auf Null aus: Die Kante zum Spielfeld verschwindet,
   * statt es abzuschneiden. Den Rest der Lesbarkeit traegt die Kontur an den
   * Texten selbst - sie wirkt auf jedem Untergrund, eine Flaeche nur auf dem,
   * den sie verdeckt.
   *
   * Der Verlauf ist aus waagerechten Streifen gebaut, weil Phasers `Graphics`
   * keinen Farbverlauf kennt. 16 Stufen sind bei dieser Hoehe nicht als
   * Banding zu sehen und kosten einen Zeichenaufruf pro Stufe - nur beim
   * Layout, nicht je Frame.
   */
  private drawPlate(height: number): void {
    const stufen = 16;
    this.plate.clear();
    for (let i = 0; i < stufen; i++) {
      const oben = (height * i) / stufen;
      const hoehe = height / stufen + 1;
      // Quadratisch auslaufend: oben traegt die Deckung die Zahlen, unten
      // geht sie schneller gegen Null als ein linearer Verlauf - die Kante
      // faellt dadurch nicht auf.
      const anteil = 1 - i / stufen;
      this.plate.fillStyle(Palette.panel, PLATE_MAX_ALPHA * anteil * anteil);
      this.plate.fillRect(0, oben, GAME_WIDTH, hoehe);
    }
  }

  private fit(text: Phaser.GameObjects.Text, width: number): void {
    if (text.width > width)
      text.setFontSize(
        Math.floor((Number.parseFloat(String(text.style.fontSize)) * width) / text.width),
      );
  }

  /** Alpha feedback keeps all measured text bounds stable, even during bursts. */
  private emphasize(text: Phaser.GameObjects.Text): void {
    this.tweens.killTweensOf(text);
    text.setAlpha(1).setScale(1);
    if (!prefersReducedMotion()) {
      text.setAlpha(0.65);
      this.tweens.add({ targets: text, alpha: 1, duration: 160 });
    }
  }

  private requestPause(): void {
    // Nur bitten - ausgefuehrt wird es in der GameScene, die als einzige weiss,
    // ob der Run ueberhaupt laeuft (Countdown, Ende).
    eventBus.emitEvent(GameEvent.PauseRequested, undefined);
  }

  /**
   * Der Pause-Bildschirm.
   *
   * Wird beim Ereignis `RunPaused` aufgebaut und bei `RunResumed` wieder
   * abgeraeumt - nicht beim Tippen auf den Knopf. Dadurch erscheint er genau
   * dann, wenn die Simulation wirklich steht, und nicht schon, wenn sie darum
   * gebeten wurde.
   */
  private showPauseOverlay(reason: 'manual' | 'interrupted' = 'manual'): void {
    this.pauseReason = reason;
    const u = this.layout.unit;
    const cx = GAME_WIDTH / 2;
    const width = GAME_WIDTH - 64 * u;
    const shade = this.add
      .image(cx, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(0x000000)
      .setAlpha(0.72)
      .setDepth(Depth.Overlay)
      .setInteractive();
    const content = this.add.container(cx, 0).setDepth(Depth.Overlay + 1);
    let y = 0;
    const paragraph = (value: string, size: number, color: string) => {
      const text = this.add
        .text(0, y, value, textStyle(this.layout.font(size), color))
        .setOrigin(0.5, 0)
        .setAlign('center')
        .setWordWrapWidth(width)
        .setLineSpacing(2 * u);
      content.add(text);
      y += text.height + 14 * u;
    };
    paragraph(reason === 'interrupted' ? 'ANGEHALTEN' : 'PAUSE', 22, Palette.gold);
    if (this.mode === 'challenge') {
      paragraph(
        reason === 'interrupted'
          ? 'Die App war kurz im Hintergrund. Im Duell läuft der Durchgang weiter.'
          : 'Im Duell lässt sich nicht pausieren. Der Durchgang läuft weiter.',
        12,
        Palette.inkDim,
      );
    } else {
      if (reason === 'interrupted')
        paragraph('Die App war kurz im Hintergrund.', 12, Palette.inkDim);
      if (this.talentLines.length) {
        paragraph('DEINE TALENTE', 12, Palette.gold);
        y = this.buildTalentTable(content, y, width, u);
      }
    }
    const resume = createButton(
      this,
      0,
      y + 22 * u,
      this.mode === 'challenge' ? 'ZURÜCK INS SPIEL' : 'WEITER',
      () => (this.mode === 'challenge' ? this.closeDuelPause() : this.requestPause()),
      { width, height: 44 * u, fontSize: this.layout.font(14), variant: 'primary' },
    );
    content.add(resume.container);
    y += 56 * u;
    const quit = createButton(
      this,
      0,
      y + 22 * u,
      this.mode === 'challenge' ? 'DUELL ABBRECHEN' : 'RUN VERLASSEN',
      () => eventBus.emitEvent(GameEvent.AbortRequested, undefined),
      { width, height: 44 * u, fontSize: this.layout.font(12) },
    );
    content.add(quit.container);
    y += 58 * u;
    paragraph('Ein abgebrochener Run wird nicht gewertet.', 10, Palette.danger);
    content.y = (GAME_HEIGHT - y) / 2;
    const panel = createPanel(
      this,
      cx,
      GAME_HEIGHT / 2,
      width + 28 * u,
      y + 28 * u,
      Palette.goldHex,
      { alpha: 0.98 },
    ).setDepth(Depth.Overlay);
    this.pauseOverlay.push(shade, panel, content);
  }

  /**
   * Die aktiven Talente als zweispaltige Liste.
   *
   * Name und Rang links, Wirkung rechts, je Talent eine Zeile. Vorher stand
   * hier ein einziger Absatz, in dem zehn Eintraege mit "·" aneinanderhingen
   * und mitten im Wort umbrachen - lesbar war das nur, wenn man ohnehin
   * wusste, was drinsteht.
   *
   * Die Werte stehen rechtsbuendig untereinander: Zahlen vergleicht man
   * senkrecht, und genau das ist die Frage in der Pause ("wo stehe ich
   * eigentlich?"). Zeilenweise Texte statt eines Rasters, weil Phaser kein
   * Tabellenlayout kennt und zwei Spalten es nicht brauchen.
   *
   * @returns die neue Unterkante, damit der Aufrufer weiterzaehlen kann.
   */
  private buildTalentTable(
    content: Phaser.GameObjects.Container,
    top: number,
    width: number,
    unit: number,
  ): number {
    const size = this.layout.font(11);
    const zeilenHoehe = 17 * unit;
    let y = top;
    for (const line of this.talentLines) {
      const name = this.add
        .text(-width / 2, y, `${line.name}  R${line.rank}`, textStyle(size, Palette.ink))
        .setOrigin(0, 0);
      const effect = this.add
        .text(width / 2, y, line.effect, textStyle(size, Palette.success, { fontStyle: 'bold' }))
        .setOrigin(1, 0);
      // Sicherheitsnetz fuer sehr schmale Geraete: Beruehren sich die
      // Spalten, schrumpft der Name - die Wirkung ist die Information, die
      // man sucht, und bleibt deshalb unangetastet.
      const frei = width - effect.width - 12 * unit;
      if (name.width > frei) this.fit(name, frei);
      content.add(name);
      content.add(effect);
      y += zeilenHoehe;
    }
    return y + 8 * unit;
  }

  /**
   * Klappt den Duell-Pausenbildschirm zu und meldet das weiter.
   *
   * `RunResumed` obwohl nie etwas angehalten war: das Ereignis bedeutet hier
   * "der Bildschirm ist wieder frei, es wird wieder hingeschaut". Die
   * `GameScene` braucht diese Meldung, um dem Gegner den Wechsel von
   * "schaut nicht hin" zurueck auf "spielt" zu senden - ohne sie bliebe die
   * Anzeige beim anderen bis zum Rundenende auf `away` stehen.
   */
  private closeDuelPause(): void {
    this.hidePauseOverlay();
    eventBus.emitEvent(GameEvent.RunResumed, undefined);
  }

  private hidePauseOverlay(): void {
    for (const part of this.pauseOverlay) part.destroy();
    this.pauseOverlay = [];
  }

  // --- Event-Anbindung ------------------------------------------------------

  private readonly onScore = ({ score }: { score: number }): void => {
    this.lastOwnScore = score;
    // Der Abstand in der Gegnerzeile haengt an BEIDEN Staenden - ohne dieses
    // Nachziehen bliebe er stehen, bis der Gegner das naechste Mal sendet.
    for (const [playerIndex, text] of this.opponentLiveTexts) {
      if (text.alpha > 0) this.renderOpponentLive(playerIndex);
    }
    this.scoreText.setText(score.toLocaleString('de-DE'));
    // Kurzes Feedback ohne wandernde Textgrenzen.
    this.scoreText.setFontSize(this.layout.font(24));
    this.fit(this.scoreText, this.layout.columnWidth);
    this.emphasize(this.scoreText);

    this.checkOvertake(score);
  };

  /** Der Moment, in dem die Vorlage des Gegners faellt - einmalig gefeiert. */
  private checkOvertake(score: number): void {
    if (this.scoreToBeat === null || this.hasOvertaken || score <= this.scoreToBeat) return;

    this.hasOvertaken = true;

    this.targetText?.setText('IN FÜHRUNG').setColor(Palette.gold);

    if (this.targetText) {
      this.fit(this.targetText, this.layout.width);
      this.emphasize(this.targetText);
    }
  }

  /**
   * Was das HUD aus einem Fang macht: Gluecktreffer zeigen, XP summieren.
   *
   * Beides haengt am selben Ereignis und deshalb am selben Handler - ein
   * zweiter Listener auf `Collected` waere ein zweites `offEvent`-Paar
   * (Regel 4) fuer nichts.
   *
   * Nur eine Summe, keine Regel: Wie viel ein Fang bringt, entscheidet
   * `ProgressionSystem`; hier wird ausschliesslich addiert, was gemeldet
   * wurde. Fehlt `xpGained`, ist das Einsicht-Talent nicht gelernt - dann
   * bleibt die Zeile unsichtbar.
   */
  private readonly onCollected = ({
    xpGained,
    crit,
    awardedPoints,
  }: {
    xpGained?: number;
    crit: boolean;
    awardedPoints: number;
  }): void => {
    if (crit) this.showCritBurst(awardedPoints);
    if (xpGained === undefined) return;
    this.xpTotal += xpGained;
    this.xpText.setText(`+${this.xpTotal.toLocaleString('de-DE')} XP`);
    this.fit(this.xpText, this.layout.columnWidth);
    if (this.xpText.alpha === 0) this.xpText.setAlpha(1);
    else this.emphasize(this.xpText);
  };

  /**
   * Der leerlaufende Fensterbalken - und die Warnung, bevor die Serie reisst.
   *
   * Die Warnung faerbt die ganze Serienspalte rot, nicht nur den Balken:
   * Dieselbe Sprache, die der Timer in den letzten zehn Sekunden spricht
   * (`onTimer`). Wer sie einmal gelernt hat, versteht sie hier sofort.
   *
   * `comboWarning` merkt sich den Zustand, damit die Faerbung einmal je
   * Wechsel passiert und nicht bei jedem gemeldeten Hundertstel.
   */
  private readonly onComboWindow = ({ ratio, combo }: { ratio: number; combo: number }): void => {
    this.comboWindowBar.setRatio(ratio);
    // Ohne laufendes Fenster verschwindet der Balken ganz. Ein dauerhaft
    // leerer Balken sagt nichts und nimmt der Serienspalte die Ruhe.
    this.comboWindowBar.container.setAlpha(ratio > 0 ? 1 : 0);

    const warnen = ratio > 0 && ratio <= COMBO_WARN_RATIO && combo >= COMBO_WARN_MIN_SERIES;
    if (warnen === this.comboWarning) return;
    this.comboWarning = warnen;

    this.comboWindowBar.setTint(warnen ? 0xff6b6b : this.accent);
    this.comboText.setColor(warnen ? Palette.danger : Palette.inkDim);
    this.multiplierText.setColor(warnen ? Palette.danger : Palette.gold);
    if (warnen) this.emphasize(this.multiplierText);
  };

  /**
   * Der Jackpot: die Serie erreicht die letzte konfigurierte Stufe.
   *
   * Bis hierher sah Serie 16 aus wie Serie 4 - derselbe kurze
   * Multiplikator-Burst, obwohl dahinter der groesste Sprung der ganzen
   * Tabelle steht (x4,5 auf x6) und danach nur noch +0,25 je Fang kommen.
   * Ein Farbstoss in Weltfarbe macht daraus den Moment, den die Zahl
   * verdient - einmal je Serie, nicht bei jedem weiteren Fang darueber.
   */
  private celebrateJackpot(): void {
    if (prefersReducedMotion()) return;
    const flash = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TextureKey.Pixel)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setTint(this.accent)
      .setAlpha(0)
      .setDepth(Depth.Overlay + 1);
    // Aufblitzen und langsamer abklingen: 40 ms hin, 260 ms zurueck. Der
    // Stoss darf das Feld nicht verdecken, nur kurz einfaerben - deshalb
    // bleibt die Deckkraft weit unter der Haelfte. Als eine Kette aus zwei
    // Tweens statt als Yoyo, weil Hin- und Rueckweg verschieden lang sind.
    this.tweens.chain({
      targets: flash,
      tweens: [
        { alpha: 0.28, duration: 40 },
        { alpha: 0, duration: 260 },
      ],
      onComplete: () => flash.destroy(),
    });
  }

  private readonly onCombo = ({
    combo,
    multiplier,
    speedFactor,
  }: {
    combo: number;
    multiplier: number;
    speedFactor: number;
  }): void => {
    this.comboText.setText(`SERIE ${Math.max(0, combo)}`);
    this.multiplierText.setText(
      `×${multiplier.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`,
    );
    this.fit(this.comboText, this.layout.columnWidth);
    this.fit(this.multiplierText, this.layout.columnWidth);
    this.updateAgility(speedFactor);

    // Ein Fang setzt das Fenster neu - damit ist jede Warnung hinfaellig.
    // Ohne dieses Zuruecknehmen bliebe die Spalte rot, bis das naechste
    // Fenster wieder unter die Schwelle faellt.
    if (this.comboWarning) {
      this.comboWarning = false;
      this.comboWindowBar.setTint(this.accent);
      this.comboText.setColor(Palette.inkDim);
      this.multiplierText.setColor(Palette.gold);
    }

    // Mit der Serie faellt auch der Jackpot-Moment: Wer sie neu aufbaut,
    // soll ihn wieder erleben koennen.
    if (combo < SERIES_JACKPOT) this.jackpotCelebrated = false;

    if (combo < 2) {
      this.lastComboMultiplier = 1;
      return;
    }

    this.emphasize(this.comboText);

    if (combo >= SERIES_JACKPOT && !this.jackpotCelebrated) {
      this.jackpotCelebrated = true;
      this.celebrateJackpot();
    }

    if (multiplier <= this.lastComboMultiplier) return;
    this.lastComboMultiplier = multiplier;
    this.showMultiplierBurst(multiplier);
  };

  /**
   * Zeigt den Beweglichkeitsbonus der Serie an.
   *
   * Nur beim Stufenwechsel animieren, nicht bei jedem Fang: Innerhalb einer
   * Stufe aendert sich der Wert nicht, und ein Aufblitzen bei jedem Relikt
   * wuerde die Stufe unlesbar machen.
   */
  private updateAgility(speedFactor: number): void {
    const prozent = Math.round((speedFactor - 1) * 100);
    if (prozent <= 0) {
      this.lastAgilityPercent = 0;
      this.tweens.killTweensOf(this.agilityText);
      this.agilityText.setAlpha(0);
      return;
    }

    this.agilityText.setText(`+${prozent}% TEMPO`);
    if (prozent === this.lastAgilityPercent) return;

    this.lastAgilityPercent = prozent;
    this.tweens.killTweensOf(this.agilityText);
    this.fit(this.agilityText, this.layout.columnWidth);
    this.emphasize(this.agilityText);
  }

  private showMultiplierBurst(multiplier: number): void {
    const label = `×${multiplier.toLocaleString('de-DE', { maximumFractionDigits: 2 })}`;
    this.tweens.killTweensOf(this.multiplierBurstText);
    this.multiplierBurstText
      .setText(label)
      .setPosition(GAME_WIDTH / 2, this.layout.headerHeight + 18 * this.layout.unit)
      .setScale(1)
      .setAlpha(1);
    if (prefersReducedMotion()) {
      this.multiplierBurstText.setAlpha(0);
      return;
    }
    this.tweens.add({
      targets: this.multiplierBurstText,
      alpha: 0,
      duration: 260,
      delay: 180,
    });
  }

  /**
   * Der Gluecktreffer-Schriftzug: schnell da, kurz stehen, aufreissend weg.
   *
   * Er liegt ueber dem Spielfeld, nicht in der Kopfzeile - ein Krit ist ein
   * Ereignis im Spiel, keine Kennzahl. Die Hoehe (30 % des Bildes) haelt ihn
   * klar unter dem HUD-Kopf und weit ueber dem Daumen, der unten steuert.
   *
   * Der Multiplikator-Burst weicht fuer seine Dauer: Ein Krit faellt oft
   * genau dann, wenn auch die Serie eine Stufe steigt - beide uebereinander
   * waeren zwei goldene Schriftzuege an fast derselben Stelle.
   */
  private showCritBurst(points: number): void {
    // `this.time.now` statt `Date.now()`: Die Scene-Uhr steht in der Pause
    // still, die Wanduhr laeuft weiter. Sonst waere die Sperre nach jeder
    // Pause abgelaufen, egal wie kurz sie war.
    const now = this.time.now;
    if (now - this.lastCritBurstAt < CRIT_BURST.minGapMs) return;
    this.lastCritBurstAt = now;

    const u = this.layout.unit;
    const y = GAME_HEIGHT * CRIT_BURST.screenY;
    this.tweens.killTweensOf(this.multiplierBurstText);
    this.multiplierBurstText.setAlpha(0);
    this.tweens.killTweensOf([this.critBurstText, this.critBurstPointsText]);

    this.critBurstPointsText.setText(`+${points.toLocaleString('de-DE')}`);
    this.critBurstText.setPosition(GAME_WIDTH / 2, y).setAlpha(1);
    this.critBurstPointsText
      .setPosition(GAME_WIDTH / 2, y + 34 * u)
      .setAlpha(1)
      .setScale(1);

    if (prefersReducedMotion()) {
      // Ohne Bewegung bleibt die Auskunft, nicht der Schlag: stehen lassen
      // und ruhig ausblenden. Dieselbe Linie wie beim Multiplikator-Burst.
      this.critBurstText.setScale(1);
      this.tweens.add({
        targets: [this.critBurstText, this.critBurstPointsText],
        alpha: 0,
        duration: CRIT_BURST.fadeMs,
        delay: CRIT_BURST.holdMs + CRIT_BURST.hitMs,
      });
      return;
    }

    const targets = [this.critBurstText, this.critBurstPointsText];
    this.critBurstText.setScale(CRIT_BURST.startScale);
    this.critBurstPointsText.setScale(CRIT_BURST.startScale);
    // `Back.easeOut` schiesst ueber das Ziel hinaus und federt zurueck -
    // das ist der Teil, der als Einschlag gelesen wird.
    this.tweens.add({
      targets,
      scale: CRIT_BURST.hitScale,
      duration: CRIT_BURST.hitMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets,
          scale: CRIT_BURST.endScale,
          alpha: 0,
          duration: CRIT_BURST.fadeMs,
          delay: CRIT_BURST.holdMs,
          ease: 'Quad.easeIn',
        });
      },
    });
  }

  private readonly onTimer = ({
    remainingMs,
    totalMs,
  }: {
    remainingMs: number;
    totalMs: number;
  }): void => {
    const seconds = Math.ceil(remainingMs / 1000);
    this.timerText.setText(`${seconds}s`);
    this.timerBar.setRatio(remainingMs / totalMs);

    // Letzte 10 Sekunden rot - klare Warnung ohne zusaetzliches UI-Element.
    const isCritical = seconds <= 10;
    this.timerBar.setTint(isCritical ? 0xff6b6b : this.accent);
    this.timerText.setColor(isCritical ? Palette.danger : Palette.ink);
  };

  // Schutz gegen doppeltes Aufbauen: Ein zweites `RunPaused` - etwa durch die
  // Debug-Taste bei bereits offenem Bildschirm - wuerde sonst einen zweiten
  // Satz Knoepfe uebereinanderlegen, und der untere bliebe fuer immer stehen.
  private readonly onPaused = (payload: { reason: 'manual' | 'interrupted' }): void => {
    if (this.pauseOverlay.length > 0) return;
    this.showPauseOverlay(payload.reason);
  };
  private readonly onResumed = (): void => this.hidePauseOverlay();
  private readonly onOpponentDisconnected = ({ playerIndex }: { playerIndex: number }): void => {
    if (playerIndex === this.localPlayerIndex || !this.opponentLiveTexts.has(playerIndex)) return;
    this.opponentActivities.set(playerIndex, 'gone');
    // Der Punktestand bleibt stehen, aber als letzter bekannter - sonst
    // wirkte er wie ein aktueller.
    this.renderOpponentLive(playerIndex);
  };

  private readonly onOpponentLive = ({
    score,
    activity,
    playerIndex,
  }: {
    score: number;
    activity: 'playing' | 'away' | 'left' | 'finished' | 'gone';
    playerIndex: number;
  }): void => {
    if (playerIndex === this.localPlayerIndex || !this.opponentLiveTexts.has(playerIndex)) return;
    this.opponentScores.set(playerIndex, score);
    this.opponentActivities.set(playerIndex, activity);
    this.renderOpponentLive(playerIndex);
  };

  private readonly onOpponentName = ({
    name,
    playerIndex,
  }: {
    name: string;
    playerIndex?: number;
  }): void => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const targetIndex = Number.isInteger(playerIndex)
      ? playerIndex!
      : [...this.opponentLiveTexts.keys()][0];
    if (targetIndex === undefined) return;
    this.opponentLabels[targetIndex] = cleanName;
    this.renderOpponentLive(targetIndex);
  };

  /**
   * Schreibt die Gegner-Zeile.
   *
   * `away` wird bewusst NICHT "pausiert" genannt: im Duell laeuft die
   * Simulation weiter (Fairness-Regel in `GameScene.togglePause`), die
   * Punktzahl daneben steigt also sichtbar weiter. "Pausiert" wuerde dem
   * widersprechen und wie ein Anzeigefehler wirken.
   */
  private renderOpponentLive(playerIndex: number): void {
    const text = this.opponentLiveTexts.get(playerIndex);
    if (!text) return;
    const activity = this.opponentActivities.get(playerIndex) ?? 'playing';
    const opponentScore = this.opponentScores.get(playerIndex) ?? 0;
    const fullName = this.opponentLabels[playerIndex]?.trim() || `Spieler ${playerIndex + 1}`;
    const displayName =
      Array.from(fullName).length > 14
        ? Array.from(fullName).slice(0, 13).join('') + '\u2026'
        : fullName;
    const points = opponentScore.toLocaleString('de-DE');
    const diff = opponentScore - this.lastOwnScore;

    const lineLabel =
      activity === 'left'
        ? `${displayName} ausgestiegen`
        : activity === 'gone'
          ? `${displayName} ${points} · offline`
          : activity === 'finished'
            ? `${displayName} ${points} · fertig`
            : activity === 'away'
              ? `${displayName} ${points} · abwesend`
              : `${displayName} ${points}${diff === 0 ? '' : diff > 0 ? ` · ${diff} vorn` : ` · ${-diff} hinten`}`;

    // Aussteiger und Verbindungsverlust in Warnfarbe, alles andere gedaempft:
    // die Zeile soll beim Spielen nicht um Aufmerksamkeit konkurrieren,
    // ausser wenn sich etwas Endgueltiges geaendert hat.
    const color = activity === 'left' || activity === 'gone' ? Palette.danger : Palette.inkDim;

    text.setText(lineLabel).setColor(color).setAlpha(1).setFontSize(this.layout.font(11));
    this.fit(text, this.layout.width);
  }

  private registerEvents(): void {
    eventBus.onEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.onEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.onEvent(GameEvent.ComboWindowChanged, this.onComboWindow);
    eventBus.onEvent(GameEvent.Collected, this.onCollected);
    eventBus.onEvent(GameEvent.TimerChanged, this.onTimer);
    eventBus.onEvent(GameEvent.RunPaused, this.onPaused);
    eventBus.onEvent(GameEvent.RunResumed, this.onResumed);
    eventBus.onEvent(GameEvent.OpponentDisconnected, this.onOpponentDisconnected);
    eventBus.onEvent(GameEvent.OpponentLiveState, this.onOpponentLive);
    eventBus.onEvent(GameEvent.OpponentNameChanged, this.onOpponentName);
  }

  /**
   * Pflicht: ohne Abmelden wuerden die Listener nach einem Restart der Scene
   * doppelt feuern und auf zerstoerte Text-Objekte zugreifen.
   */
  private unregisterEvents(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout);
    eventBus.offEvent(GameEvent.ScoreChanged, this.onScore);
    eventBus.offEvent(GameEvent.ComboChanged, this.onCombo);
    eventBus.offEvent(GameEvent.ComboWindowChanged, this.onComboWindow);
    eventBus.offEvent(GameEvent.Collected, this.onCollected);
    eventBus.offEvent(GameEvent.TimerChanged, this.onTimer);
    eventBus.offEvent(GameEvent.RunPaused, this.onPaused);
    eventBus.offEvent(GameEvent.RunResumed, this.onResumed);
    eventBus.offEvent(GameEvent.OpponentDisconnected, this.onOpponentDisconnected);
    eventBus.offEvent(GameEvent.OpponentLiveState, this.onOpponentLive);
    eventBus.offEvent(GameEvent.OpponentNameChanged, this.onOpponentName);
  }
}
