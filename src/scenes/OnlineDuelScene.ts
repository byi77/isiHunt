/**
 * Netzwerk-Duell: Raum erzeugen/beitreten, Lobby, Ergebnis - das Netzwerk-
 * Analogon zu `ChallengeScene`, aber eigene Scene, weil die Zustaende
 * fundamental anders sind (Code, Warten auf Gegner, Verbindungsfehler) und
 * `ChallengeScene` bereits drei Phasen buendelt.
 *
 *   Menue --> [Einstieg] --> [Lobby: warten] --> GameScene --> [Ergebnis]
 *
 * Phase 1 dieses Features (siehe Planungsnotiz): kein Live-Score waehrend
 * des Runs, nur synchroner Start und Ergebnis am Ende.
 */

import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import {
  ONLINE_DUEL_GUEST_START_TIMEOUT_MS,
  ONLINE_DUEL_READY_TIMEOUT_MS,
  ONLINE_DUEL_RESULT_POLL_INTERVAL_MS,
  ONLINE_DUEL_RESULT_TIMEOUT_MS,
  ONLINE_DUEL_START_POLL_INTERVAL_MS,
} from '@/config/onlineDuel';
import { getWorld, DEFAULT_WORLD_ID } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import { SceneKey } from '@/scenes/SceneKey';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { FontSize, Palette, textStyle } from '@/ui/theme';
import type { TextInputHandle } from '@/ui/textInput';
import { createTextInput } from '@/ui/textInput';
import {
  createBackStatusText,
  createButton,
  createDriftLayers,
  createMenuLayout,
  createPanel,
  createStatusPage,
  createVignette,
  createWorldBackdrop,
} from '@/ui/widgets';
import type { ButtonHandle, StatusPageHandle } from '@/ui/widgets';

/** "1 Relikt" statt "1 Relikte" - deckungsgleich mit ChallengeScene. */
function relics(count: number): string {
  return `${count} ${count === 1 ? 'Relikt' : 'Relikte'}`;
}

interface OnlineDuelSceneData {
  /** 'result' nach Rueckkehr aus GameScene; sonst beginnt der Ablauf von vorn. */
  phase?: 'result';
}

export class OnlineDuelScene extends Phaser.Scene {
  private busy = false;
  private statusText!: Phaser.GameObjects.Text;
  private statusPage!: StatusPageHandle;
  private contentOffset = 0;
  private transient: Phaser.GameObjects.GameObject[] = [];
  private world!: WorldDef;

  /** Nur waehrend Lobby/Ergebnis gesetzt. */
  private isHost = false;
  private roomCode = '';
  private codeInput: TextInputHandle | null = null;
  private readyTimeout: Phaser.Time.TimerEvent | null = null;
  /** Fallback, falls der `start`-Broadcast den anderen Client nicht erreicht. */
  private startPollTimer: Phaser.Time.TimerEvent | null = null;
  /** Dasselbe fuer das Rundenergebnis des Gegners im Ergebnisbildschirm. */
  private resultPollTimer: Phaser.Time.TimerEvent | null = null;
  private resultPollStartedAt = 0;
  /**
   * Feld statt lokaler Variable in `runLobbyFlow`, weil das Zeitlimit nach
   * einem WEITER WARTEN erneut startet und dieselbe Antwort auf "laeuft der
   * Run schon?" braucht - eine Closure-Variable waere beim zweiten Anlauf
   * nicht mehr erreichbar.
   */
  private runStarted = false;
  private opponentReady = false;
  private keepWaitingButton: ButtonHandle | null = null;

  constructor() {
    super(SceneKey.OnlineDuel);
  }

  create(data: OnlineDuelSceneData = {}): void {
    SafeAreaSystem.showStatic('NETZWERK-DUELL');
    this.busy = false;
    this.transient = [];
    this.isHost = false;
    this.roomCode = '';
    this.codeInput = null;
    this.readyTimeout = null;
    this.startPollTimer = null;
    this.resultPollTimer = null;
    this.resultPollStartedAt = 0;
    this.runStarted = false;
    this.opponentReady = false;
    this.keepWaitingButton = null;

    const state = ChallengeSystem.getState();
    this.world = getWorld(state?.worldId ?? SaveSystem.load().lastWorldId ?? DEFAULT_WORLD_ID);

    this.buildBackground();
    this.contentOffset = createMenuLayout().sections.next(150) - 300;
    this.statusText = createBackStatusText(this);
    this.statusPage = createStatusPage(this.statusText, this.contentOffset);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupLobby());

    if (data.phase === 'result') {
      // Ergebnis-Rueckkehr aus GameScene setzt einen laufenden Zustand voraus.
      if (!state || state.kind !== 'duel-online') {
        this.scene.start(SceneKey.Menu);
        return;
      }
      this.buildResult();
      return;
    }

    this.buildStart();
  }

  private buildBackground(): void {
    createWorldBackdrop(
      this,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.world.bgTop,
      this.world.bgBottom,
      this.world.accent,
      this.world.spaceVariant,
    );
    createDriftLayers(this, GAME_WIDTH, GAME_HEIGHT, this.world.spaceVariant);
    createVignette(this, GAME_WIDTH, GAME_HEIGHT);
  }

  private buildHeading(title: string, subtitle: string): void {
    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(150),
          title,
          textStyle(FontSize.heading, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setLetterSpacing(2)
        .setDepth(Depth.Overlay),
    );
    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(212),
          subtitle,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 140)
        .setAlign('center')
        .setDepth(Depth.Overlay),
    );
  }

  // --- Phase: Einstieg ---------------------------------------------------------

  private buildStart(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);
    this.buildHeading(
      'NETZWERK-DUELL',
      'Spielt gleichzeitig gegeneinander - jeder auf seinem eigenen Geraet.',
    );

    this.keep(
      createButton(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(400),
        'RAUM ERSTELLEN',
        () => void this.createRoom(),
        { width: 440, accent: Palette.goldHex, fontSize: FontSize.body },
      ).container,
    );
    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(464),
          'Du bekommst einen Code fuer deinen Freund',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5),
    );

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(570),
          'ODER',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(6),
    );

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(642),
          'Code vom anderen Geraet eingeben',
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5),
    );

    this.codeInput = createTextInput(this, GAME_WIDTH / 2, this.statusPage.contentY(712), {
      placeholder: '· · · · · ·',
      maxLength: 6,
      width: 340,
      uppercase: true,
      onSubmit: () => void this.joinRoom(),
    });
    this.keep(this.codeInput.element);

    this.keep(
      createButton(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(830),
        'BEITRETEN',
        () => void this.joinRoom(),
        { width: 440, height: 76, accent: 0x9aa3bd, fontSize: FontSize.body },
      ).container,
    );

    this.buildBackToMenu('ABBRECHEN');
  }

  private async createRoom(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusPage.setStatus('Raum wird erstellt ...', Palette.inkDim);

    const result = await NetworkDuelSystem.createRoom(this.world.id);
    this.busy = false;
    if (!this.scene.isActive()) return;

    if (!result.ok) {
      this.statusPage.setStatus(result.error, Palette.danger);
      return;
    }

    this.isHost = true;
    this.roomCode = result.value.code;
    ChallengeSystem.startOnline(this.world.id, result.value.seed, this.roomCode, 0);
    this.enterLobby();
  }

  private async joinRoom(): Promise<void> {
    if (this.busy) return;

    const raw = this.codeInput?.getValue() ?? '';
    const code = NetworkDuelSystem.normalizeRoomCode(raw);

    this.busy = true;
    this.statusPage.setStatus('Raum wird gesucht ...', Palette.inkDim);

    const result = await NetworkDuelSystem.joinRoom(code);
    this.busy = false;
    if (!this.scene.isActive()) return;

    if (!result.ok) {
      this.statusPage.setStatus(result.error, Palette.danger);
      return;
    }
    if (!result.value) {
      this.statusPage.setStatus('Code unbekannt oder abgelaufen.', Palette.danger);
      return;
    }

    this.isHost = false;
    this.roomCode = code;
    this.world = getWorld(result.value.worldId);
    ChallengeSystem.startOnline(result.value.worldId, result.value.seed, code, 1);
    this.enterLobby();
  }

  // --- Phase: Lobby --------------------------------------------------------------

  private enterLobby(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);

    this.buildHeading(
      this.isHost ? 'WARTE AUF DEIN GESCHWISTER' : 'VERBUNDEN',
      this.isHost ? `Code: ${this.roomCode}` : 'Uhr wird abgeglichen ...',
    );

    if (this.isHost) {
      this.keep(
        createPanel(
          this,
          GAME_WIDTH / 2,
          this.statusPage.contentY(420),
          GAME_WIDTH - 160,
          140,
          Palette.goldHex,
        ),
      );
      this.keep(
        this.add
          .text(
            GAME_WIDTH / 2,
            this.statusPage.contentY(420),
            this.roomCode,
            textStyle(FontSize.title, Palette.gold, { fontStyle: 'bold' }),
          )
          .setOrigin(0.5)
          .setLetterSpacing(10),
      );
      this.keep(
        this.add
          .text(
            GAME_WIDTH / 2,
            this.statusPage.contentY(520),
            `Gueltig fuer ${NetworkDuelSystem.roomCodeTtlMinutes()} Minuten`,
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0.5),
      );
    }

    const lobbyStatusY = this.isHost ? 610 : 420;
    const lobbyStatus = this.add
      .text(
        GAME_WIDTH / 2,
        this.statusPage.contentY(lobbyStatusY),
        'Uhr wird abgeglichen ...',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center');
    this.keep(lobbyStatus);

    this.buildBackToMenu('ABBRECHEN');

    void this.runLobbyFlow(lobbyStatus);
  }

  /**
   * Verbindet den Realtime-Kanal, misst den Uhr-Offset, meldet Bereitschaft
   * und wartet auf die gemeinsame Startzeit.
   *
   * **Beide Rollen koennen die Startzeit setzen.** Frueher tat das nur der
   * Gastgeber; der Gast pollte ausschliesslich auf ein fertiges `startAtMs`
   * und war damit auf einen Ausloeser angewiesen, den nur das andere Geraet
   * betaetigen konnte. Gab der Gastgeber vorher auf (Ready-Timeout), wartete
   * der Gast unbegrenzt auf etwas, das nie mehr kommen konnte - belegt durch
   * den Zwei-Geraete-Bericht v0.1.246 (2026-08-23). `set_duel_start_time`
   * prueft serverseitig nur `host_ready and guest_ready`, nicht *wer* ruft
   * (siehe `supabase/phase_2_11_duel_rooms.sql`), und `update ... set
   * start_at` ist fuer denselben berechneten Wert unkritisch, wenn beide es
   * tun. Die Beschraenkung auf den Gastgeber war reine Client-Konvention -
   * und genau die wurde in diesem Fall zur Falle.
   */
  private async runLobbyFlow(statusText: Phaser.GameObjects.Text): Promise<void> {
    const supabase = CloudSystem.getSupabaseClient();
    if (!supabase) {
      statusText.setText('Kein Online-Dienst eingerichtet.').setColor(Palette.danger);
      return;
    }

    const localPlayerIndex: 0 | 1 = this.isHost ? 0 : 1;

    NetworkDuelSystem.subscribeToRoom(supabase, this.roomCode, localPlayerIndex, {
      onOpponentReady: () => {
        this.opponentReady = true;
        if (!this.runStarted) statusText.setText('Freund bereit - Start wird vorbereitet ...');
      },
      onStartTimeSet: (startAtMs) => {
        if (this.runStarted) return;
        this.runStarted = true;
        this.beginRun(startAtMs);
      },
      onOpponentDisconnected: () => {
        // Nur waehrend der Lobby relevant fuer diese Scene - ein Abbruch
        // WAEHREND des Runs betrifft GameScene, die den Kanal separat
        // beobachtet (siehe GameScene.subscribeOpponentDisconnect()).
        if (this.runStarted) return;
        statusText.setText('Verbindung zum Freund verloren.').setColor(Palette.danger);
      },
      onChannelError: (reason) => {
        if (this.runStarted) return;
        // Bei einem Kanalfehler ist das Polling der einzige verbliebene Weg
        // zur Startzeit - es laeuft deshalb bewusst WEITER. Nur die Meldung
        // sagt dem Spieler, dass die Verbindung stockt.
        statusText
          .setText(`Verbindungsfehler: ${reason}\nEs wird weiter versucht ...`)
          .setColor(Palette.danger);
      },
    });

    const offsetResult = await NetworkDuelSystem.measureClockOffset();
    if (!this.scene.isActive() || this.runStarted) return;
    if (!offsetResult.ok) {
      statusText.setText(offsetResult.error).setColor(Palette.danger);
      return;
    }
    ChallengeSystem.updateOnlineSync(offsetResult.value, null);

    const readyResult = await NetworkDuelSystem.markReady(this.roomCode, this.isHost);
    if (!this.scene.isActive() || this.runStarted) return;
    if (!readyResult.ok) {
      statusText.setText(readyResult.error).setColor(Palette.danger);
      return;
    }
    NetworkDuelSystem.broadcastReady();
    statusText.setText(
      this.opponentReady ? 'Beide bereit - Start wird vorbereitet ...' : 'Warte auf Freund ...',
    );

    this.startWaitTimers(statusText);

    // Sofort einmal versuchen, falls der andere schon bereit ist (der
    // haeufigere Fall) - der Poll-Takt darunter faengt alles spaetere ab.
    void this.pollAndSetStartTime(statusText);
  }

  /**
   * Startet Wartetakt und Zeitlimit der Lobby - als eigene Methode, weil der
   * WEITER-WARTEN-Knopf sie ein zweites Mal braucht.
   */
  private startWaitTimers(statusText: Phaser.GameObjects.Text): void {
    // Das Zeitlimit gilt jetzt fuer BEIDE Rollen. Der Gast hatte vorher gar
    // keins und wartete im Fehlerfall stumm bis zum Schliessen der App.
    this.readyTimeout = this.time.delayedCall(
      this.isHost ? ONLINE_DUEL_READY_TIMEOUT_MS : ONLINE_DUEL_GUEST_START_TIMEOUT_MS,
      () => this.giveUpWaiting(statusText),
    );

    // Fallback fuer BEIDE Rollen: `channel.send()` von Supabase Realtime
    // besitzt ohne `broadcast.ack` keine Zustellbestaetigung und loest
    // trotzdem mit "ok" auf (siehe ONLINE_DUEL_START_POLL_INTERVAL_MS-
    // Kommentar in config/onlineDuel.ts). Dieses Polling findet die
    // Startzeit unabhaengig davon, ob das begleitende `start`-Broadcast-
    // Event ankam - und setzt sie selbst, sobald beide bereit sind.
    this.startPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_START_POLL_INTERVAL_MS,
      loop: true,
      callback: () => {
        void this.pollAndSetStartTime(statusText);
      },
    });
  }

  /**
   * Ein Poll-Durchlauf: Startzeit uebernehmen, wenn sie schon steht - sonst
   * selbst setzen, sobald beide bereit sind.
   *
   * Beide Schritte in einem Abruf, weil sie auf derselben Antwort beruhen:
   * ein zweiter `getRoomStatus()` fuer die zweite Frage waere eine
   * ueberfluessige Anfrage im 1,5-Sekunden-Takt.
   */
  private async pollAndSetStartTime(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (this.runStarted || !this.scene.isActive()) return;

    const statusResult = await NetworkDuelSystem.getRoomStatus(this.roomCode);
    if (this.runStarted || !this.scene.isActive()) return;
    if (!statusResult.ok || !statusResult.value) return;

    const room = statusResult.value;

    if (room.startAtMs !== null) {
      this.runStarted = true;
      this.beginRun(room.startAtMs);
      return;
    }

    if (room.hostReady && room.guestReady) {
      await this.trySetStartTime(statusText);
    }
  }

  private async trySetStartTime(statusText: Phaser.GameObjects.Text): Promise<void> {
    const startResult = await NetworkDuelSystem.setStartTime(this.roomCode);
    if (!this.scene.isActive() || this.runStarted) return;
    if (!startResult.ok) {
      // Kein Aufraeumen mehr: seit beide Rollen die Startzeit setzen duerfen,
      // ist ein Fehlschlag hier meistens ein Rennen (der andere war eine
      // Zehntelsekunde schneller, der Raum steht bereits auf "gestartet") und
      // kein Grund aufzugeben. Der naechste Poll-Durchlauf findet dann die
      // gesetzte `startAtMs` und startet den Run. Das Zeitlimit bleibt der
      // Waechter fuer den Fall, dass es doch ein echter Fehler war.
      statusText
        .setText(`${startResult.error}\nEs wird weiter versucht ...`)
        .setColor(Palette.danger);
      return;
    }
    this.runStarted = true;
    NetworkDuelSystem.broadcastStartTime(startResult.value);
    this.beginRun(startResult.value);
  }

  /**
   * Das Zeitlimit ist abgelaufen - Warten einstellen, aber nicht in eine
   * Sackgasse fuehren.
   *
   * **Warum ein WEITER-WARTEN-Knopf und kein blosser Abbruch.** Frueher
   * setzte diese Stelle nur eine Meldung und raeumte auf; der Bildschirm bot
   * danach ausser ABBRECHEN nichts mehr an. Trat der Freund eine
   * Sekunde spaeter bei, erfuhr das Geraet davon nichts mehr - es fragte
   * nicht mehr nach, und niemand rief `set_duel_start_time`. Der Raum lebt
   * laut `DUEL_ROOM_CODE_TTL_MINUTES` aber noch Minuten weiter: aufgeben ist
   * hier eine Frage an den Spieler, keine Tatsache.
   */
  private giveUpWaiting(statusText: Phaser.GameObjects.Text): void {
    if (this.runStarted || !this.scene.isActive()) return;

    // Das Polling wird eingestellt, solange die Frage offen steht - sonst
    // liefe es hinter einer stehenden Meldung weiter (Debug-Report v0.1.205,
    // 2026-08-21: 17 weitere Abrufe nach dem aufgegebenen Warten).
    this.cleanupLobby();

    statusText
      .setText(
        this.isHost
          ? 'Freund ist noch nicht beigetreten.\nCode prüfen - oder weiter warten.'
          : 'Der Start laesst auf sich warten.\nGeraet des Freundes pruefen - oder weiter warten.',
      )
      .setColor(Palette.danger);

    const button = createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 240,
      'WEITER WARTEN',
      () => {
        this.discardKeepWaitingButton();
        statusText.setText('Warte auf Freund ...').setColor(Palette.ink);
        this.startWaitTimers(statusText);
      },
      { width: 300, height: 72, accent: Palette.goldHex, fontSize: FontSize.small },
    );
    this.keepWaitingButton = button;
    this.keep(button.container);
  }

  /**
   * Entfernt den WEITER-WARTEN-Knopf restlos - auch aus `transient`.
   *
   * Ohne das Herausnehmen bliebe bei jedem Warte-Zyklus eine tote Referenz in
   * der Liste zurueck; `clearTransient()` riefe `destroy()` ein zweites Mal
   * auf (unschaedlich, aber falsch) und die Liste wuechse bei jedem
   * Durchlauf weiter.
   */
  private discardKeepWaitingButton(): void {
    if (!this.keepWaitingButton) return;
    const { container } = this.keepWaitingButton;
    this.transient = this.transient.filter((object) => object !== container);
    container.destroy();
    this.keepWaitingButton = null;
  }

  private beginRun(startAtServerMs: number): void {
    // `runStarted` hier statt nur an den Aufrufstellen: `beginRun` ist der
    // einzige Weg in den Run, und alle Wartepfade fragen dieses Feld ab.
    this.runStarted = true;
    this.cleanupLobby();
    const state = ChallengeSystem.getState();
    ChallengeSystem.updateOnlineSync(state?.online?.clockOffsetMs ?? 0, startAtServerMs);
    this.scene.start(SceneKey.Game, { worldId: this.world.id, mode: 'challenge' });
  }

  private cleanupLobby(): void {
    if (this.startPollTimer) {
      this.startPollTimer.remove();
      this.startPollTimer = null;
    }
    if (this.readyTimeout) {
      this.readyTimeout.remove();
      this.readyTimeout = null;
    }
    this.stopResultPolling();
  }

  private stopResultPolling(): void {
    if (this.resultPollTimer) {
      this.resultPollTimer.remove();
      this.resultPollTimer = null;
    }
  }

  // --- Phase: Ergebnis -----------------------------------------------------------

  private buildResult(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);

    const winner = ChallengeSystem.winnerIndex();
    const state = ChallengeSystem.getState();
    const complete = ChallengeSystem.isComplete();

    // Raum-Code aus dem Zustand zurueckholen: nach der Rueckkehr aus
    // GameScene ist `create()` neu gelaufen und hat die Felder geleert, der
    // Duell-Zustand ueberlebt den Scene-Wechsel aber im ChallengeSystem.
    if (!complete && state?.online) {
      this.roomCode = state.online.roomCode;
      this.isHost = state.online.localPlayerIndex === 0;
      this.awaitOpponentResult();
    }

    this.buildHeading(
      !complete
        ? 'WARTE AUF ERGEBNIS'
        : winner === null
          ? 'UNENTSCHIEDEN'
          : `${ChallengeSystem.playerLabel(winner).toUpperCase()} GEWINNT`,
      !complete
        ? 'Dein Freund spielt noch seine Runde.'
        : winner === null
          ? 'Punktgleich - das muss wiederholt werden.'
          : 'Gut gejagt.',
    );

    if (complete && state) {
      state.rounds.forEach((round, index) => {
        this.buildResultCard(round, index, winner === index);
      });
    }

    this.buildBackToMenu('ZUM MENÜ', () => {
      this.stopResultPolling();
      NetworkDuelSystem.unsubscribeFromRoom();
    });
  }

  /**
   * Wartet auf das Rundenergebnis des Gegners - ueber beide Wege gleichzeitig.
   *
   * Der Broadcast-Handler wird hier ZUM ERSTEN MAL ueberhaupt registriert:
   * `onOpponentRoundResult` war deklariert und wurde beim Eintreffen auch
   * aufgerufen, aber keine Scene hatte ihn je gesetzt - das `?.` schluckte
   * jedes Ergebnis lautlos, und beide Geraete blieben auf "WARTE AUF
   * ERGEBNIS" stehen (Testbericht v0.1.236, 2026-08-22).
   *
   * Der Handler allein genuegt aber nicht: wer zuerst fertig ist, sendet
   * seinen Broadcast, waehrend der andere noch spielt und gar nicht zuhoert.
   * Es gibt also keinen Zeitpunkt, zu dem beide gleichzeitig empfangsbereit
   * sind. Deshalb ist das Polling ueber `getRoomStatus()` hier der tragende
   * Weg und der Broadcast nur die Abkuerzung - dieselbe Aufteilung, mit der
   * die Lobby schon die Startzeit absichert.
   */
  private awaitOpponentResult(): void {
    NetworkDuelSystem.updateHandlers({
      onOpponentRoundResult: (playerIndex, result) => {
        this.applyOpponentResult(playerIndex, result);
      },
    });

    this.resultPollStartedAt = Date.now();
    this.resultPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_RESULT_POLL_INTERVAL_MS,
      loop: true,
      callback: () => {
        void this.pollOpponentResult();
      },
    });
  }

  private async pollOpponentResult(): Promise<void> {
    if (!this.scene.isActive() || !this.resultPollTimer) return;

    if (Date.now() - this.resultPollStartedAt > ONLINE_DUEL_RESULT_TIMEOUT_MS) {
      // Aufgeben heisst auch aufraeumen - sonst liefe das Polling hinter
      // einer stehenden Meldung weiter, dieselbe Luecke wie beim
      // Ready-Timeout in der Lobby.
      this.stopResultPolling();
      this.statusPage.setStatus('Kein Ergebnis vom Freund erhalten.', Palette.danger);
      return;
    }

    const statusResult = await NetworkDuelSystem.getRoomStatus(this.roomCode);
    if (!this.scene.isActive() || !this.resultPollTimer) return;
    if (!statusResult.ok || !statusResult.value) return;

    const opponentResult = this.isHost
      ? statusResult.value.guestResult
      : statusResult.value.hostResult;
    if (!opponentResult) return;

    this.applyOpponentResult(this.isHost ? 1 : 0, opponentResult);
  }

  /**
   * Traegt ein eingetroffenes Gegner-Ergebnis ein und baut den Bildschirm neu.
   *
   * Beide Wege (Broadcast und Polling) landen hier, koennen also dasselbe
   * Ergebnis doppelt liefern. Das ist unkritisch: `submitOnlineRound()`
   * schreibt an eine feste Position statt anzuhaengen, und der
   * `isComplete()`-Torwaechter verhindert einen zweiten Neuaufbau.
   */
  private applyOpponentResult(playerIndex: 0 | 1, result: NetworkDuelSystem.DuelRoundResult): void {
    if (ChallengeSystem.isComplete()) return;

    ChallengeSystem.submitOnlineRound(playerIndex, result);
    if (!ChallengeSystem.isComplete()) return;

    this.stopResultPolling();
    this.buildResult();
  }

  private buildResultCard(
    round: { score: number; bestCombo: number; totalCollected: number },
    index: number,
    isWinner: boolean,
  ): void {
    const y = this.statusPage.contentY(420 + index * 190);
    const color = isWinner ? Palette.goldHex : this.world.accent;
    this.keep(
      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, 158, color, {
        alpha: isWinner ? 0.75 : 0.45,
      }),
    );
    this.keep(
      this.add
        .text(
          104,
          y - 44,
          ChallengeSystem.playerLabel(index),
          textStyle(FontSize.body, isWinner ? Palette.gold : Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(
          104,
          y + 18,
          round.score.toLocaleString('de-DE'),
          textStyle(FontSize.heading, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(
          GAME_WIDTH - 104,
          y + 24,
          `${relics(round.totalCollected)}  ·  Kette ${round.bestCombo}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(1, 0.5),
    );
  }

  // --- Hilfen -----------------------------------------------------------------

  private buildBackToMenu(label: string, onBeforeMenu?: () => void): void {
    this.keep(
      createButton(
        this,
        GAME_WIDTH / 2,
        GAME_HEIGHT - 140,
        label,
        () => {
          onBeforeMenu?.();
          ChallengeSystem.clear();
          this.scene.start(SceneKey.Menu);
        },
        { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
      ).container,
    );
  }

  private keep(object: Phaser.GameObjects.GameObject): void {
    this.transient.push(object);
  }

  private clearTransient(): void {
    for (const object of this.transient) object.destroy();
    this.transient = [];
    this.codeInput = null;
  }
}
