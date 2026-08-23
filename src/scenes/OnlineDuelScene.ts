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
import type { StatusPageHandle } from '@/ui/widgets';

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
          'Du bekommst einen Code fuer dein Geschwister',
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
   * und wartet auf die vom Gastgeber gesetzte Startzeit.
   */
  private async runLobbyFlow(statusText: Phaser.GameObjects.Text): Promise<void> {
    const supabase = CloudSystem.getSupabaseClient();
    if (!supabase) {
      statusText.setText('Kein Online-Dienst eingerichtet.').setColor(Palette.danger);
      return;
    }

    let opponentReady = false;
    let started = false;
    const localPlayerIndex: 0 | 1 = this.isHost ? 0 : 1;

    NetworkDuelSystem.subscribeToRoom(supabase, this.roomCode, localPlayerIndex, {
      onOpponentReady: () => {
        opponentReady = true;
        if (!started) statusText.setText('Geschwister bereit - Start wird vorbereitet ...');
      },
      onStartTimeSet: (startAtMs) => {
        if (started) return;
        started = true;
        this.beginRun(startAtMs);
      },
      onOpponentDisconnected: () => {
        // Nur waehrend der Lobby relevant fuer diese Scene - ein Abbruch
        // WAEHREND des Runs betrifft GameScene, die den Kanal separat
        // beobachtet (siehe GameScene.subscribeOpponentDisconnect()).
        if (started) return;
        statusText.setText('Verbindung zum Geschwister verloren.').setColor(Palette.danger);
      },
      onChannelError: (reason) => {
        if (started) return;
        // Bei einem Kanalfehler ist das Polling der einzige verbliebene Weg
        // zur Startzeit - es laeuft deshalb bewusst WEITER. Nur die Meldung
        // sagt dem Spieler, dass die Verbindung stockt.
        statusText
          .setText(`Verbindungsfehler: ${reason}\nEs wird weiter versucht ...`)
          .setColor(Palette.danger);
      },
    });

    const offsetResult = await NetworkDuelSystem.measureClockOffset();
    if (!this.scene.isActive() || started) return;
    if (!offsetResult.ok) {
      statusText.setText(offsetResult.error).setColor(Palette.danger);
      return;
    }
    ChallengeSystem.updateOnlineSync(offsetResult.value, null);

    const readyResult = await NetworkDuelSystem.markReady(this.roomCode, this.isHost);
    if (!this.scene.isActive() || started) return;
    if (!readyResult.ok) {
      statusText.setText(readyResult.error).setColor(Palette.danger);
      return;
    }
    NetworkDuelSystem.broadcastReady();
    statusText.setText(
      opponentReady ? 'Beide bereit - Start wird vorbereitet ...' : 'Warte auf Geschwister ...',
    );

    // Nur der Gastgeber setzt die Startzeit - verhindert, dass beide
    // gleichzeitig versuchen und einer einen bereits gesetzten Wert
    // ueberschreibt (die RPC selbst ist idempotent genug fuer diesen Fall,
    // aber ein einzelner Ausloeser haelt den Ablauf einfacher).
    if (this.isHost) {
      this.readyTimeout = this.time.delayedCall(ONLINE_DUEL_READY_TIMEOUT_MS, () => {
        void (async () => {
          if (started || !this.scene.isActive()) return;
          const statusResult = await NetworkDuelSystem.getRoomStatus(this.roomCode);
          if (!this.scene.isActive() || started) return;
          if (!statusResult.ok || !statusResult.value?.guestReady) {
            // BUG belegt (Debug-Report v0.1.205, 2026-08-21): Hier wurde die
            // Meldung gesetzt, der Poll-Timer lief aber weiter - im Report
            // sind nach dem Timeout bei t+10s noch 17 weitere
            // `getRoomStatus`-Aufrufe zu sehen, bis der Test abgebrochen
            // wurde. Das Warten war also aufgegeben, das Geraet fragte aber
            // im 1,5-Sekunden-Takt weiter, und der Bildschirm bot ausser
            // ABBRECHEN nichts an. `cleanupLobby()` raeumt genau das auf -
            // es wurde bisher nur bei `beginRun()` und beim SHUTDOWN
            // gerufen, nicht beim Aufgeben.
            this.cleanupLobby();
            statusText
              .setText('Geschwister ist nicht beigetreten.\nCode prüfen und erneut versuchen.')
              .setColor(Palette.danger);
            return;
          }
          await this.trySetStartTime(statusText);
        })();
      });

      // Zusaetzlich sofort versuchen, falls beide schon vor dem Timeout
      // bereit sind (der haeufigere Fall).
      void this.pollAndSetStartTime(statusText);
    }

    // Fallback fuer BEIDE Rollen: `channel.send()` von Supabase Realtime
    // besitzt ohne `broadcast.ack` keine Zustellbestaetigung und loest
    // trotzdem mit "ok" auf (siehe ONLINE_DUEL_START_POLL_INTERVAL_MS-
    // Kommentar in config/onlineDuel.ts). Der Gastgeber hat `set_duel_
    // start_time` zu diesem Zeitpunkt bereits erfolgreich in die Datenbank
    // geschrieben - dieses Polling findet die Startzeit unabhaengig davon,
    // ob das begleitende `start`-Broadcast-Event ankam.
    this.startPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_START_POLL_INTERVAL_MS,
      loop: true,
      callback: () => {
        void (async () => {
          if (started || !this.scene.isActive()) return;
          const statusResult = await NetworkDuelSystem.getRoomStatus(this.roomCode);
          if (started || !this.scene.isActive()) return;
          const startAtMs = statusResult.ok ? (statusResult.value?.startAtMs ?? null) : null;
          if (startAtMs === null) return;
          started = true;
          this.beginRun(startAtMs);
        })();
      },
    });
  }

  private async pollAndSetStartTime(statusText: Phaser.GameObjects.Text): Promise<void> {
    const statusResult = await NetworkDuelSystem.getRoomStatus(this.roomCode);
    if (!this.scene.isActive()) return;
    if (statusResult.ok && statusResult.value?.hostReady && statusResult.value.guestReady) {
      await this.trySetStartTime(statusText);
    }
  }

  private async trySetStartTime(statusText: Phaser.GameObjects.Text): Promise<void> {
    const startResult = await NetworkDuelSystem.setStartTime(this.roomCode);
    if (!this.scene.isActive()) return;
    if (!startResult.ok) {
      // Dieselbe Luecke wie beim Ready-Timeout: Ohne Aufraeumen liefe das
      // Polling hinter einer stehenden Fehlermeldung weiter.
      this.cleanupLobby();
      statusText.setText(startResult.error).setColor(Palette.danger);
      return;
    }
    NetworkDuelSystem.broadcastStartTime(startResult.value);
    this.beginRun(startResult.value);
  }

  private beginRun(startAtServerMs: number): void {
    if (this.readyTimeout) {
      this.readyTimeout.remove();
      this.readyTimeout = null;
    }
    if (this.startPollTimer) {
      this.startPollTimer.remove();
      this.startPollTimer = null;
    }
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
        ? 'Dein Geschwister spielt noch seine Runde.'
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
      this.statusPage.setStatus('Kein Ergebnis vom Geschwister erhalten.', Palette.danger);
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
