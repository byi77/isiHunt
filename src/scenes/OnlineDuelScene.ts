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
import { ONLINE_DUEL_READY_TIMEOUT_MS } from '@/config/onlineDuel';
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

    NetworkDuelSystem.subscribeToRoom(supabase, this.roomCode, {
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
        if (started) return;
        statusText.setText('Verbindung zum Geschwister verloren.').setColor(Palette.danger);
      },
      onChannelError: (reason) => {
        if (started) return;
        statusText.setText(`Verbindungsfehler: ${reason}`).setColor(Palette.danger);
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
            statusText
              .setText('Geschwister ist nicht rechtzeitig beigetreten.')
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
    const state = ChallengeSystem.getState();
    ChallengeSystem.updateOnlineSync(state?.online?.clockOffsetMs ?? 0, startAtServerMs);
    this.scene.start(SceneKey.Game, { worldId: this.world.id, mode: 'challenge' });
  }

  private cleanupLobby(): void {
    if (this.readyTimeout) {
      this.readyTimeout.remove();
      this.readyTimeout = null;
    }
  }

  // --- Phase: Ergebnis -----------------------------------------------------------

  private buildResult(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);

    const winner = ChallengeSystem.winnerIndex();
    const state = ChallengeSystem.getState();
    const complete = ChallengeSystem.isComplete();

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

    this.buildBackToMenu('ZUM MENÜ', () => NetworkDuelSystem.unsubscribeFromRoom());
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
