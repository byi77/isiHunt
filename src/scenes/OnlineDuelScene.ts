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

import { DUEL_TALENT_DRAFT_DURATION_MS, DUEL_TALENT_POINT_BUDGET } from '@/config/challenge';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import {
  ONLINE_DUEL_GUEST_START_TIMEOUT_MS,
  ONLINE_DUEL_INVITATION_TTL_SECONDS,
  ONLINE_DUEL_READY_TIMEOUT_MS,
  ONLINE_DUEL_RESULT_POLL_INTERVAL_MS,
  ONLINE_DUEL_RESULT_TIMEOUT_MS,
  ONLINE_DUEL_START_POLL_INTERVAL_MS,
} from '@/config/onlineDuel';
import { getWorld, DEFAULT_WORLD_ID } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import type { TalentRanks } from '@/config/talents';
import { eventBus, GameEvent } from '@/core/EventBus';
import { SceneKey } from '@/scenes/SceneKey';
import * as AuthSystem from '@/systems/AuthSystem';
import * as ChallengeSystem from '@/systems/ChallengeSystem';
import * as CloudSystem from '@/systems/CloudSystem';
import * as NetworkDuelSystem from '@/systems/NetworkDuelSystem';
import * as SaveSystem from '@/systems/SaveSystem';
import * as SafeAreaSystem from '@/systems/SafeAreaSystem';
import { Depth } from '@/ui/depth';
import { createTalentDraftView, type TalentDraftView } from '@/ui/talentDraft';
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
  /** 'result' nach Rueckkehr aus GameScene; 'rematch' nach Server-Reset. */
  phase?: 'result' | 'rematch';
  /** Welt aus der vorgelagerten Duellauswahl. */
  worldId?: string;
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
  private participantToken = '';
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
  private talentDraftView: TalentDraftView | null = null;
  private talentDraftTimer: Phaser.Time.TimerEvent | null = null;
  private talentDraftDeadline = 0;
  private draftConfirmed = false;
  private draftSubmissionStarted = false;
  private draftConfirmButton: ButtonHandle | null = null;
  private clockSynced = false;
  private rematchPollTimer: Phaser.Time.TimerEvent | null = null;
  private lastKnownMatchNumber = 1;
  private rematchRequestStarted = false;
  private duelLobbyObjects: Phaser.GameObjects.GameObject[] = [];
  private invitationObjects: Phaser.GameObjects.GameObject[] = [];
  private pendingInvitation: NetworkDuelSystem.DuelInvitation | null = null;
  private invitationStatusText: Phaser.GameObjects.Text | null = null;
  private outgoingInvitationId: string | null = null;

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
    this.talentDraftView = null;
    this.talentDraftTimer = null;
    this.talentDraftDeadline = 0;
    this.draftConfirmed = false;
    this.draftSubmissionStarted = false;
    this.draftConfirmButton = null;
    this.clockSynced = false;
    this.rematchPollTimer = null;
    this.lastKnownMatchNumber = 1;
    this.rematchRequestStarted = false;
    this.duelLobbyObjects = [];
    this.invitationObjects = [];
    this.pendingInvitation = null;
    this.invitationStatusText = null;
    this.outgoingInvitationId = null;

    const state = ChallengeSystem.getState();
    this.world = getWorld(
      data.worldId ?? state?.worldId ?? SaveSystem.load().lastWorldId ?? DEFAULT_WORLD_ID,
    );

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

    if (data.phase === 'rematch') {
      if (!state || state.kind !== 'duel-online' || !state.online) {
        this.scene.start(SceneKey.Menu);
        return;
      }
      this.restoreRoomFromState(state);
      this.lastKnownMatchNumber = state.duelMatchNumber ?? 1;
      this.enterLobby();
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
    if (AuthSystem.isSignedIn()) {
      this.buildDuelLobbyStart();
      return;
    }
    this.buildCodeStart();
  }

  /** Einstieg fuer Gaeste und als Fallback fuer eingeloggte Spieler. */
  private buildCodeStart(): void {
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

  /**
   * Einstieg fuer eingeloggte Spieler: aktive Duellbereitschaft sehen und
   * direkt herausfordern. Der Code-Pfad bleibt darunter bewusst sichtbar, weil
   * er weiterhin fuer Freunde ohne Login und bei Realtime-Problemen gebraucht
   * wird.
   */
  private buildDuelLobbyStart(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);
    this.buildHeading('DUELL', 'Fordere einen duellbereiten Spieler direkt heraus.');

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(270),
          'DUELLBEREITE SPIELER',
          textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setDepth(Depth.Overlay),
    );
    this.keep(
      createPanel(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(435),
        GAME_WIDTH - 120,
        400,
        0x38bdf8,
        { alpha: 0.62, radius: 20 },
      ),
    );
    this.renderDuelLobbyPlayers([]);

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(700),
          'ODER CODE VERWENDEN',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(4),
    );

    this.codeInput = createTextInput(this, GAME_WIDTH / 2, this.statusPage.contentY(755), {
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
        this.statusPage.contentY(850),
        'BEITRETEN',
        () => void this.joinRoom(),
        { width: 440, height: 76, accent: 0x9aa3bd, fontSize: FontSize.body },
      ).container,
    );
    this.keep(
      createButton(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(955),
        'RAUMCODE ERSTELLEN',
        () => void this.createRoom(),
        { width: 380, height: 64, accent: Palette.goldHex, fontSize: FontSize.small },
      ).container,
    );

    this.buildBackToMenu('ABBRECHEN');
    this.subscribeToDuelLobby();
  }

  private subscribeToDuelLobby(): void {
    const supabase = CloudSystem.getSupabaseClient();
    const playerName = SaveSystem.load().playerName;
    if (!supabase || !AuthSystem.isSignedIn() || !playerName) {
      this.statusPage.setStatus('Spielername fuer Einladungen fehlt.', Palette.danger);
      return;
    }

    NetworkDuelSystem.subscribeToDuelLobby(supabase, playerName, {
      onPlayersSync: (players) => {
        if (!this.scene.isActive() || this.pendingInvitation) return;
        this.renderDuelLobbyPlayers(players);
      },
      onInvitationReceived: () => {
        // Die globale Lobby bleibt waehrend eines laufenden Duells abonniert,
        // damit andere Spieler den Status IM DUELL sehen. Eine Einladung darf
        // in dieser Zeit aber keine bereits beendete Scene wiederbeleben.
        if (!this.scene.isActive()) return;
        NetworkDuelSystem.setDuelLobbyAvailability('busy');
        void this.loadPendingDuelInvitations();
      },
      onChannelError: (reason) => {
        if (!this.scene.isActive() || this.pendingInvitation) return;
        this.statusPage.setStatus(`Duell-Lobby nicht erreichbar: ${reason}`, Palette.danger);
      },
    });
    void this.loadPendingDuelInvitations();
  }

  private renderDuelLobbyPlayers(players: NetworkDuelSystem.DuelLobbyPlayer[]): void {
    this.clearDuelLobbyObjects();
    if (!this.scene.isActive()) return;

    const visiblePlayers = players.slice(0, 5);
    if (visiblePlayers.length === 0) {
      this.keepDuelLobby(
        this.add
          .text(
            GAME_WIDTH / 2,
            this.statusPage.contentY(435),
            'Gerade ist niemand duellbereit.',
            textStyle(FontSize.small, Palette.inkDim),
          )
          .setOrigin(0.5)
          .setDepth(Depth.Overlay),
      );
      return;
    }

    visiblePlayers.forEach((player, index) => {
      const y = this.statusPage.contentY(330 + index * 66);
      this.keepDuelLobby(
        this.add
          .text(92, y, player.playerName, textStyle(FontSize.body, Palette.ink))
          .setOrigin(0, 0.5)
          .setDepth(Depth.Overlay),
      );
      const available = player.availability === 'available';
      this.keepDuelLobby(
        this.add
          .text(
            92,
            y + 26,
            available ? 'DUELLBEREIT' : 'IM DUELL',
            textStyle(FontSize.tiny, available ? Palette.gold : Palette.inkDim),
          )
          .setOrigin(0, 0.5)
          .setDepth(Depth.Overlay),
      );

      const inviteButton = createButton(
        this,
        GAME_WIDTH - 145,
        y,
        available ? 'EINLADEN' : 'BESETZT',
        () => void this.invitePlayer(player.playerName),
        {
          width: 170,
          height: 54,
          accent: available ? 0x38bdf8 : 0x59627a,
          fontSize: FontSize.tiny,
        },
      );
      inviteButton.setEnabled(available);
      this.keepDuelLobby(inviteButton.container);
    });
  }

  private async invitePlayer(playerName: string): Promise<void> {
    if (this.busy || !AuthSystem.isSignedIn()) return;
    this.busy = true;
    this.statusPage.setStatus(`Einladung an ${playerName} wird gesendet ...`, Palette.inkDim);
    const result = await NetworkDuelSystem.createDuelInvitation(this.world.id, playerName);
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.statusPage.setStatus(result.error, Palette.danger);
      return;
    }

    NetworkDuelSystem.setDuelLobbyAvailability('busy');
    this.outgoingInvitationId = result.value.id;
    this.isHost = true;
    this.roomCode = result.value.code;
    this.participantToken = result.value.participantToken;
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      this.roomCode,
      0,
      this.participantToken,
    );
    this.lastKnownMatchNumber = 1;
    this.enterLobby();
  }

  private async loadPendingDuelInvitations(): Promise<void> {
    const result = await NetworkDuelSystem.listDuelInvitations();
    if (!this.scene.isActive() || !result.ok || result.value.length === 0) return;
    NetworkDuelSystem.setDuelLobbyAvailability('busy');
    if (!this.pendingInvitation) this.showInvitationPrompt(result.value[0]!);
  }

  private showInvitationPrompt(invitation: NetworkDuelSystem.DuelInvitation): void {
    if (this.pendingInvitation) return;
    this.pendingInvitation = invitation;

    const blocker = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, Palette.backdrop, 0.88)
      .setDepth(Depth.Overlay - 1)
      .setInteractive();
    this.keepInvitation(blocker);

    this.keepInvitation(
      createPanel(this, GAME_WIDTH / 2, 620, GAME_WIDTH - 100, 360, Palette.goldHex, {
        alpha: 0.92,
        radius: 22,
      }).setDepth(Depth.Overlay),
    );
    this.keepInvitation(
      this.add
        .text(GAME_WIDTH / 2, 500, 'DUELL-EINLADUNG', textStyle(FontSize.heading, Palette.gold))
        .setOrigin(0.5)
        .setDepth(Depth.Overlay + 1),
    );
    this.keepInvitation(
      this.add
        .text(
          GAME_WIDTH / 2,
          570,
          `${invitation.inviterName} fordert dich heraus.\nWelt: ${getWorld(invitation.worldId).name}`,
          textStyle(FontSize.body, Palette.ink),
        )
        .setOrigin(0.5)
        .setAlign('center')
        .setDepth(Depth.Overlay + 1),
    );
    this.invitationStatusText = this.add
      .text(
        GAME_WIDTH / 2,
        650,
        `Die Einladung ist ${ONLINE_DUEL_INVITATION_TTL_SECONDS} Sekunden gültig.`,
        textStyle(FontSize.tiny, Palette.inkDim),
      )
      .setOrigin(0.5)
      .setDepth(Depth.Overlay + 1);
    this.keepInvitation(this.invitationStatusText);

    const accept = createButton(this, 245, 735, 'ANNEHMEN', () => void this.acceptInvitation(), {
      width: 210,
      height: 64,
      accent: Palette.goldHex,
      fontSize: FontSize.small,
    });
    accept.container.setDepth(Depth.Overlay + 1);
    this.keepInvitation(accept.container);
    const decline = createButton(this, 475, 735, 'ABLEHNEN', () => void this.declineInvitation(), {
      width: 210,
      height: 64,
      accent: 0x9aa3bd,
      fontSize: FontSize.small,
    });
    decline.container.setDepth(Depth.Overlay + 1);
    this.keepInvitation(decline.container);
  }

  private async acceptInvitation(): Promise<void> {
    const invitation = this.pendingInvitation;
    if (!invitation || this.busy) return;
    this.busy = true;
    this.invitationStatusText?.setText('Einladung wird angenommen ...');
    const result = await NetworkDuelSystem.acceptDuelInvitation(invitation.id);
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.invitationStatusText?.setText(result.error).setColor(Palette.danger);
      return;
    }

    this.clearInvitationPrompt();
    NetworkDuelSystem.setDuelLobbyAvailability('busy');
    this.isHost = false;
    this.roomCode = result.value.code;
    this.participantToken = result.value.participantToken;
    this.world = getWorld(result.value.worldId);
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      this.roomCode,
      1,
      this.participantToken,
    );
    this.lastKnownMatchNumber = result.value.matchNumber ?? 1;
    this.enterLobby();
  }

  private async declineInvitation(): Promise<void> {
    const invitation = this.pendingInvitation;
    if (!invitation || this.busy) return;
    this.busy = true;
    this.invitationStatusText?.setText('Einladung wird abgelehnt ...');
    const result = await NetworkDuelSystem.declineDuelInvitation(invitation.id);
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.invitationStatusText?.setText(result.error).setColor(Palette.danger);
      return;
    }
    this.clearInvitationPrompt();
    NetworkDuelSystem.setDuelLobbyAvailability('available');
    this.statusPage.setStatus('Einladung abgelehnt.', Palette.inkDim);
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

    NetworkDuelSystem.setDuelLobbyAvailability('busy');
    this.isHost = true;
    this.roomCode = result.value.code;
    this.participantToken = result.value.participantToken;
    ChallengeSystem.startOnline(
      this.world.id,
      result.value.seed,
      this.roomCode,
      0,
      this.participantToken,
    );
    this.lastKnownMatchNumber = 1;
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

    NetworkDuelSystem.setDuelLobbyAvailability('busy');
    this.isHost = false;
    this.roomCode = code;
    this.participantToken = result.value.participantToken;
    this.world = getWorld(result.value.worldId);
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      code,
      1,
      this.participantToken,
    );
    this.lastKnownMatchNumber = 1;
    this.enterLobby();
  }

  // --- Phase: Lobby --------------------------------------------------------------

  private restoreRoomFromState(
    state: NonNullable<ReturnType<typeof ChallengeSystem.getState>>,
  ): void {
    if (!state.online) return;
    this.roomCode = state.online.roomCode;
    this.isHost = state.online.localPlayerIndex === 0;
    this.participantToken = state.online.participantToken;
    this.world = getWorld(state.worldId);
  }

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

    this.buildOnlineTalentDraft(lobbyStatus, 'TALENTE BESTÄTIGEN', () => {
      this.draftConfirmed = true;
      if (this.clockSynced) void this.submitDraftAndReady(lobbyStatus);
    });

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
    const challengeState = ChallengeSystem.getState();
    const sharedChannelKey = challengeState?.kind === 'duel-online' ? challengeState.seed : '';

    NetworkDuelSystem.subscribeToRoom(
      supabase,
      this.roomCode,
      localPlayerIndex,
      {
        onPresenceSync: (playerNames) => {
          ChallengeSystem.updateOnlinePlayerNames(playerNames);
          const opponentIndex = localPlayerIndex === 0 ? 1 : 0;
          const opponentName = playerNames[opponentIndex];
          if (opponentName) {
            eventBus.emitEvent(GameEvent.OpponentNameChanged, { name: opponentName });
          }
        },
        onOpponentReady: () => {
          if (!this.scene.isActive()) return;
          this.opponentReady = true;
          if (!this.runStarted) statusText.setText('Freund bereit - Start wird vorbereitet ...');
        },
        onStartTimeSet: (startAtMs) => {
          if (this.runStarted || !this.scene.isActive()) return;
          this.runStarted = true;
          this.beginRun(startAtMs);
        },
        onOpponentDisconnected: () => {
          // Nur waehrend der Lobby relevant fuer diese Scene - ein Abbruch
          // WAEHREND des Runs betrifft GameScene, die den Kanal separat
          // beobachtet (siehe GameScene.subscribeOpponentDisconnect()).
          if (this.runStarted || !this.scene.isActive()) return;
          statusText.setText('Verbindung zum Freund verloren.').setColor(Palette.danger);
        },
        onChannelError: (reason) => {
          if (this.runStarted || !this.scene.isActive()) return;
          // Bei einem Kanalfehler ist das Polling der einzige verbliebene Weg
          // zur Startzeit - es laeuft deshalb bewusst WEITER. Nur die Meldung
          // sagt dem Spieler, dass die Verbindung stockt.
          statusText
            .setText(`Verbindungsfehler: ${reason}\nEs wird weiter versucht ...`)
            .setColor(Palette.danger);
        },
      },
      ChallengeSystem.playerLabel(localPlayerIndex),
      this.participantToken,
      sharedChannelKey,
    );

    const offsetResult = await NetworkDuelSystem.measureClockOffset();
    if (!this.scene.isActive() || this.runStarted) return;
    if (!offsetResult.ok) {
      statusText.setText(offsetResult.error).setColor(Palette.danger);
      return;
    }
    ChallengeSystem.updateOnlineSync(offsetResult.value, null);
    this.clockSynced = true;
    statusText.setText(
      this.draftConfirmed ? 'Talent-Build wird gespeichert ...' : 'Talent-Build festlegen ...',
    );
    if (this.draftConfirmed) void this.submitDraftAndReady(statusText);
  }

  private buildOnlineTalentDraft(
    statusText: Phaser.GameObjects.Text,
    buttonLabel: string,
    onConfirm: () => void,
  ): void {
    const localIndex: 0 | 1 = this.isHost ? 0 : 1;
    const initialRanks = ChallengeSystem.duelTalentDraftFor(localIndex);
    const hasSuggestion = Object.values(initialRanks).some((rank) => rank > 0);
    const topY = this.statusPage.contentY(this.isHost ? 700 : 610);

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(this.isHost ? 650 : 560),
          hasSuggestion
            ? 'Dein Build aus dem Vormatch ist vorgeschlagen. Ändere ihn mit + und −.'
            : `Verteile ${DUEL_TALENT_POINT_BUDGET} Punkte mit + und −.`,
          textStyle(FontSize.small, Palette.ink),
        )
        .setOrigin(0.5)
        .setWordWrapWidth(GAME_WIDTH - 100)
        .setAlign('center'),
    );

    this.talentDraftView = createTalentDraftView(this, {
      initialRanks,
      accent: this.world.accent,
      topY,
      onChange: (ranks) => {
        ChallengeSystem.setDuelTalentDraft(localIndex, ranks);
      },
    });
    for (const object of this.talentDraftView.objects) this.keep(object);

    const timerText = this.add
      .text(GAME_WIDTH / 2, topY + 5 * 64 + 34, '', textStyle(FontSize.small, Palette.gold))
      .setOrigin(0.5);
    this.keep(timerText);

    const confirm = (): void => {
      if (this.talentDraftTimer) {
        this.talentDraftTimer.remove();
        this.talentDraftTimer = null;
      }
      this.talentDraftView?.setEnabled(false);
      this.draftConfirmButton?.setEnabled(false);
      onConfirm();
    };

    const button = createButton(
      this,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 250,
      hasSuggestion ? 'VORSCHLAG ÜBERNEHMEN' : buttonLabel,
      confirm,
      { width: 460, accent: this.world.accent, fontSize: FontSize.large },
    );
    this.draftConfirmButton = button;
    this.keep(button.container);

    this.talentDraftDeadline = Date.now() + DUEL_TALENT_DRAFT_DURATION_MS;
    const updateTimer = (): void => {
      const remaining = Math.max(0, this.talentDraftDeadline - Date.now());
      timerText.setText(
        remaining > 0
          ? `${Math.ceil(remaining / 1000)} Sekunden zur Talentvergabe`
          : 'Talentvergabe beendet - Auswahl wird übernommen ...',
      );
      if (remaining <= 0) confirm();
    };
    updateTimer();
    this.talentDraftTimer = this.time.addEvent({ delay: 250, loop: true, callback: updateTimer });
    statusText.setText('Talent-Build festlegen ...');
  }

  private async submitDraftAndReady(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (this.draftSubmissionStarted || this.runStarted || !this.draftConfirmed) return;
    this.draftSubmissionStarted = true;
    const localIndex: 0 | 1 = this.isHost ? 0 : 1;
    const draft = ChallengeSystem.duelTalentDraftFor(localIndex);
    const draftResult = await NetworkDuelSystem.submitTalentDraft(
      this.roomCode,
      draft,
      this.participantToken,
    );
    if (!this.scene.isActive() || this.runStarted) return;
    if (!draftResult.ok) {
      this.draftSubmissionStarted = false;
      this.draftConfirmed = false;
      this.talentDraftView?.setEnabled(true);
      this.draftConfirmButton?.setEnabled(true);
      statusText.setText(draftResult.error).setColor(Palette.danger);
      return;
    }

    const readyResult = await NetworkDuelSystem.markReady(
      this.roomCode,
      this.isHost,
      this.participantToken,
    );
    if (!this.scene.isActive() || this.runStarted) return;
    if (!readyResult.ok) {
      this.draftSubmissionStarted = false;
      this.draftConfirmed = false;
      this.talentDraftView?.setEnabled(true);
      this.draftConfirmButton?.setEnabled(true);
      statusText.setText(readyResult.error).setColor(Palette.danger);
      return;
    }
    NetworkDuelSystem.broadcastReady();
    statusText.setText(
      this.opponentReady ? 'Beide bereit - Start wird vorbereitet ...' : 'Warte auf Freund ...',
    );
    this.startWaitTimers(statusText);
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

    const statusResult = await NetworkDuelSystem.getRoomStatus(
      this.roomCode,
      this.participantToken,
    );
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
    const startResult = await NetworkDuelSystem.setStartTime(this.roomCode, this.participantToken);
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
    // Die globale Lobby ist bewusst laenger als diese Scene aktiv: vom
    // Einstieg ueber GameScene bis zum Ergebnis muss der Spieler fuer andere
    // Clients als IM DUELL sichtbar bleiben. ABBRECHEN und GameScene.abortRun
    // kuemmern sich explizit um das endgueltige Unsubscribe.
    if (this.startPollTimer) {
      this.startPollTimer.remove();
      this.startPollTimer = null;
    }
    if (this.readyTimeout) {
      this.readyTimeout.remove();
      this.readyTimeout = null;
    }
    this.stopResultPolling();
    if (this.rematchPollTimer) {
      this.rematchPollTimer.remove();
      this.rematchPollTimer = null;
    }
    if (this.talentDraftTimer) {
      this.talentDraftTimer.remove();
      this.talentDraftTimer = null;
    }
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
    if (state?.online) {
      this.restoreRoomFromState(state);
      this.lastKnownMatchNumber = state.duelMatchNumber ?? 1;
      if (!complete) this.awaitOpponentResult();
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

      this.keep(
        createButton(
          this,
          GAME_WIDTH / 2,
          this.statusPage.contentY(930),
          'REMATCH',
          () => this.enterRematchDraft(),
          { width: 460, accent: this.world.accent, fontSize: FontSize.large },
        ).container,
      );
    }

    this.buildBackToMenu('ZUM MENÜ', () => {
      this.stopResultPolling();
      NetworkDuelSystem.unsubscribeFromRoom();
    });
  }

  private enterRematchDraft(): void {
    const state = ChallengeSystem.getState();
    if (!state?.online) return;

    this.stopResultPolling();
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);
    this.restoreRoomFromState(state);
    this.draftConfirmed = false;
    this.draftSubmissionStarted = false;
    this.rematchRequestStarted = false;
    this.buildHeading('REMATCH', `Der Raum bleibt offen: ${this.roomCode}`);

    const statusText = this.add
      .text(
        GAME_WIDTH / 2,
        this.statusPage.contentY(420),
        'Talent-Build festlegen ...',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center');
    this.keep(statusText);

    this.buildOnlineTalentDraft(statusText, 'REMATCH ANFRAGEN', () => {
      void this.requestOnlineRematch(statusText);
    });
    this.buildBackToMenu('ZUM MENÜ');
  }

  private async requestOnlineRematch(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (this.rematchRequestStarted) return;
    this.rematchRequestStarted = true;
    const localIndex: 0 | 1 = this.isHost ? 0 : 1;
    const draft = ChallengeSystem.duelTalentDraftFor(localIndex);
    const result = await NetworkDuelSystem.requestRematch(
      this.roomCode,
      draft,
      this.participantToken,
    );
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.rematchRequestStarted = false;
      this.talentDraftView?.setEnabled(true);
      this.draftConfirmButton?.setEnabled(true);
      statusText.setText(result.error).setColor(Palette.danger);
      return;
    }

    this.lastKnownMatchNumber = result.value.matchNumber;
    if (result.value.seed) {
      this.resetOnlineMatchAndRestart(result.value.seed, result.value.matchNumber);
      return;
    }

    statusText
      .setText('Dein Rematch ist vorgemerkt. Warte auf den Freund ...')
      .setColor(Palette.ink);
    this.startRematchPolling(statusText);
  }

  private startRematchPolling(statusText: Phaser.GameObjects.Text): void {
    if (this.rematchPollTimer) return;
    this.rematchPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_START_POLL_INTERVAL_MS,
      loop: true,
      callback: () => void this.pollRematch(statusText),
    });
  }

  private async pollRematch(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (!this.scene.isActive() || !this.rematchPollTimer) return;
    const result = await NetworkDuelSystem.getRoomStatus(this.roomCode, this.participantToken);
    if (!this.scene.isActive() || !this.rematchPollTimer) return;
    if (!result.ok || !result.value) {
      if (!result.ok) statusText.setText(result.error).setColor(Palette.danger);
      return;
    }
    if (result.value.matchNumber <= this.lastKnownMatchNumber) return;

    this.resetOnlineMatchAndRestart(result.value.seed, result.value.matchNumber, [
      result.value.hostTalentDraft,
      result.value.guestTalentDraft,
    ]);
  }

  private resetOnlineMatchAndRestart(
    seed: string,
    matchNumber: number,
    drafts?: [TalentRanks, TalentRanks],
  ): void {
    if (this.rematchPollTimer) {
      this.rematchPollTimer.remove();
      this.rematchPollTimer = null;
    }
    if (!ChallengeSystem.resetOnlineMatch(seed, matchNumber, drafts)) return;
    this.scene.restart({ phase: 'rematch' });
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

    const statusResult = await NetworkDuelSystem.getRoomStatus(
      this.roomCode,
      this.participantToken,
    );
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
          this.cancelOutgoingInvitation();
          NetworkDuelSystem.unsubscribeFromRoom();
          NetworkDuelSystem.unsubscribeFromDuelLobby();
          this.clearInvitationPrompt();
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

  private keepDuelLobby(object: Phaser.GameObjects.GameObject): void {
    this.keep(object);
    this.duelLobbyObjects.push(object);
  }

  private clearDuelLobbyObjects(): void {
    if (this.duelLobbyObjects.length === 0) return;
    const objects = new Set(this.duelLobbyObjects);
    for (const object of this.duelLobbyObjects) object.destroy();
    this.transient = this.transient.filter((object) => !objects.has(object));
    this.duelLobbyObjects = [];
  }

  private keepInvitation(object: Phaser.GameObjects.GameObject): void {
    this.keep(object);
    this.invitationObjects.push(object);
  }

  private clearInvitationPrompt(): void {
    const objects = new Set(this.invitationObjects);
    for (const object of this.invitationObjects) object.destroy();
    this.transient = this.transient.filter((object) => !objects.has(object));
    this.invitationObjects = [];
    this.pendingInvitation = null;
    this.invitationStatusText = null;
  }

  private cancelOutgoingInvitation(): void {
    const invitationId = this.outgoingInvitationId;
    this.outgoingInvitationId = null;
    if (invitationId) void NetworkDuelSystem.cancelDuelInvitation(invitationId);
  }

  private clearTransient(): void {
    if (this.talentDraftTimer) {
      this.talentDraftTimer.remove();
      this.talentDraftTimer = null;
    }
    for (const object of this.transient) object.destroy();
    this.transient = [];
    this.duelLobbyObjects = [];
    this.invitationObjects = [];
    this.pendingInvitation = null;
    this.invitationStatusText = null;
    this.codeInput = null;
    this.talentDraftView = null;
    this.draftConfirmButton = null;
  }
}
