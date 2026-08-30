/**
 * Netzwerk-Duell: Raum erzeugen/beitreten, Lobby, Ergebnis - das Netzwerk-
 * Analogon zu `ChallengeScene`, aber eigene Scene, weil die Zustaende
 * fundamental anders sind (Code, Warten auf Gegner, Verbindungsfehler) und
 * `ChallengeScene` bereits drei Phasen buendelt.
 *
 *   Menue --> [Einstieg] --> [Lobby: warten] --> GameScene --> [Ergebnis]
 *
 * Ein Raum kann zwei bis vier Spieler aufnehmen. Der Host startet, sobald
 * mindestens zwei Teilnehmer beigetreten sind; waehrend des Runs erscheinen
 * die Live-Staende der anderen Slots.
 */

import Phaser from 'phaser';

import { DUEL_TALENT_DRAFT_DURATION_MS, DUEL_TALENT_POINT_BUDGET } from '@/config/challenge';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/GameConfig';
import {
  ONLINE_DUEL_INVITATION_TTL_SECONDS,
  ONLINE_DUEL_INVITATION_POLL_INTERVAL_MS,
  ONLINE_DUEL_RESULT_POLL_INTERVAL_MS,
  ONLINE_DUEL_RESULT_TIMEOUT_MS,
  ONLINE_DUEL_START_POLL_INTERVAL_MS,
} from '@/config/onlineDuel';
import { getWorld, DEFAULT_WORLD_ID } from '@/config/worlds';
import type { WorldDef } from '@/config/worlds';
import type { TalentRanks } from '@/config/talents';
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
  /** Fallback, falls der `start`-Broadcast den anderen Client nicht erreicht. */
  private startPollTimer: Phaser.Time.TimerEvent | null = null;
  /** Erneuert offene Einladungen, falls der einmalige Broadcast verloren geht. */
  private invitationPollTimer: Phaser.Time.TimerEvent | null = null;
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
  private talentDraftStarted = false;
  private talentReadySubmitted = false;
  private startTimeRequestStarted = false;
  private talentDraftView: TalentDraftView | null = null;
  private talentDraftTimer: Phaser.Time.TimerEvent | null = null;
  private talentDraftDeadline = 0;
  private draftConfirmButton: ButtonHandle | null = null;
  private rematchPollTimer: Phaser.Time.TimerEvent | null = null;
  private lastKnownMatchNumber = 1;
  private rematchRequestStarted = false;
  private duelLobbyObjects: Phaser.GameObjects.GameObject[] = [];
  private roomLobbyObjects: Phaser.GameObjects.GameObject[] = [];
  private roomInviteObjects: Phaser.GameObjects.GameObject[] = [];
  private invitationObjects: Phaser.GameObjects.GameObject[] = [];
  private pendingInvitation: NetworkDuelSystem.DuelInvitation | null = null;
  private invitationStatusText: Phaser.GameObjects.Text | null = null;
  private outgoingInvitationIds: string[] = [];
  private availableDuelLobbyPlayers: NetworkDuelSystem.DuelLobbyPlayer[] = [];
  /** Serverzaehler der aktuell beigetretenen Spieler in der Raum-Lobby. */
  private roomPlayerCount = 1;
  private roomMaxPlayers = 4;
  private startRoomButton: ButtonHandle | null = null;

  constructor() {
    super(SceneKey.OnlineDuel);
  }

  create(data: OnlineDuelSceneData = {}): void {
    // Eine neue Duell-Menue-Instanz beginnt immer in der globalen
    // Bereitschaftslobby und uebernimmt keinen alten Raumzustand.
    NetworkDuelSystem.unsubscribeFromDuelLobby();
    SafeAreaSystem.showStatic('NETZWERK-DUELL');
    this.busy = false;
    this.transient = [];
    this.isHost = false;
    this.roomCode = '';
    this.codeInput = null;
    this.startPollTimer = null;
    this.invitationPollTimer = null;
    this.resultPollTimer = null;
    this.resultPollStartedAt = 0;
    this.runStarted = false;
    this.talentDraftStarted = false;
    this.talentReadySubmitted = false;
    this.startTimeRequestStarted = false;
    this.talentDraftView = null;
    this.talentDraftTimer = null;
    this.talentDraftDeadline = 0;
    this.draftConfirmButton = null;
    this.rematchPollTimer = null;
    this.lastKnownMatchNumber = 1;
    this.rematchRequestStarted = false;
    this.duelLobbyObjects = [];
    this.roomLobbyObjects = [];
    this.roomInviteObjects = [];
    this.invitationObjects = [];
    this.pendingInvitation = null;
    this.invitationStatusText = null;
    this.outgoingInvitationIds = [];
    this.availableDuelLobbyPlayers = [];
    this.roomPlayerCount = 1;
    this.roomMaxPlayers = 4;
    this.startRoomButton = null;

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
      this.enterRematchDraft();
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
        .setWordWrapWidth(GAME_WIDTH - 80)
        .setAlign('center')
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
    // Fuer alle Spieler derselbe Einstieg: Online-Duell bedeutet eine
    // gemeinsame Lobby mit Raumcode (2 bis 4 Geraete). Die alte globale
    // Direkt-Einladungsliste hat den Raumcode-Ablauf ueberlagert und bleibt
    // deshalb aus der sichtbaren Oberflaeche entfernt.
    this.buildDuelLobbyStart();
  }

  /** Einstieg fuer Host und Gaeste der gemeinsamen Raumcode-Lobby. */
  /** Kept as a non-visible compatibility path for automated room tests. */
  buildCodeStart(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);
    this.buildHeading(
      'NETZWERK-DUELL',
      'Lobby fuer 2 bis 4 Spieler - jeder auf seinem eigenen Geraet.',
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

  /** Direkter Duell-Einstieg: bereite Spieler oben, Bot darunter. */
  buildDuelLobbyStart(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);
    this.buildHeading('DUELL', 'Lade einen duellbereiten Spieler direkt ein.');

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
          'ODER SOLO SPIELEN',
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0.5)
        .setLetterSpacing(4),
    );

    /* Legacy code join is kept for automated room tests, but not shown in the duel menu.
    this.codeInput = createTextInput(this, GAME_WIDTH / 2, this.statusPage.contentY(755), {
      placeholder: '· · · · · ·',
      maxLength: 6,
      width: 340,
      uppercase: true,
      onSubmit: () => void this.joinRoom(),
    });
    this.keep(this.codeInput.element); */
    this.keep(
      createButton(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(800),
        'VS BOT',
        () => {
          ChallengeSystem.startBot(this.world.id);
          this.scene.start(SceneKey.Challenge);
        },
        { width: 440, height: 82, accent: Palette.goldHex, fontSize: FontSize.large },
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
      ).container.setVisible(false),
    );

    this.buildBackToMenu('ABBRECHEN');
    this.subscribeToDuelLobby();
  }

  private async subscribeToDuelLobby(): Promise<void> {
    const supabase = CloudSystem.getSupabaseClient();
    await AuthSystem.whenReady();
    if (!this.scene.isActive()) return;
    const playerName = SaveSystem.load().playerName;
    if (!supabase || !AuthSystem.isSignedIn() || !playerName) {
      this.statusPage.setStatus(
        supabase && !AuthSystem.isSignedIn()
          ? 'Melde dich an, um andere Spieler einzuladen.'
          : 'Spielername fuer Einladungen fehlt.',
        Palette.danger,
      );
      return;
    }

    NetworkDuelSystem.subscribeToDuelLobby(supabase, playerName, {
      onPlayersSync: (players) => {
        if (!this.scene.isActive() || this.pendingInvitation) return;
        this.availableDuelLobbyPlayers = players.filter(
          (player) => player.availability === 'available',
        );
        if (!this.roomCode) this.renderDuelLobbyPlayers(this.availableDuelLobbyPlayers);
        else if (this.isHost) this.renderRoomInvitePlayers(this.availableDuelLobbyPlayers);
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
    this.startInvitationPolling();
  }

  private startInvitationPolling(): void {
    if (this.invitationPollTimer) return;
    this.invitationPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_INVITATION_POLL_INTERVAL_MS,
      loop: true,
      callback: () => void this.loadPendingDuelInvitations(),
    });
  }

  private renderDuelLobbyPlayers(players: NetworkDuelSystem.DuelLobbyPlayer[]): void {
    this.clearDuelLobbyObjects();
    if (!this.scene.isActive()) return;

    const visiblePlayers = players
      .filter((player) => player.availability === 'available')
      .slice(0, 5);
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
      this.keepDuelLobby(
        this.add
          .text(92, y + 26, 'DUELLBEREIT', textStyle(FontSize.tiny, Palette.gold))
          .setOrigin(0, 0.5)
          .setDepth(Depth.Overlay),
      );

      const inviteButton = createButton(
        this,
        GAME_WIDTH - 145,
        y,
        'EINLADEN',
        () => void this.invitePlayer(player.playerName),
        {
          width: 170,
          height: 54,
          accent: 0x38bdf8,
          fontSize: FontSize.tiny,
        },
      );
      this.keepDuelLobby(inviteButton.container);
    });
  }

  private async invitePlayer(playerName: string): Promise<void> {
    if (this.busy || !AuthSystem.isSignedIn() || (this.roomCode && !this.isHost)) return;
    const alreadyInRoom = Boolean(this.roomCode && this.isHost);
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
    this.outgoingInvitationIds.push(result.value.id);

    if (alreadyInRoom) {
      this.statusPage.setStatus(
        `Einladung an ${playerName} gesendet. Du kannst weitere Spieler einladen.`,
        Palette.ink,
      );
      this.renderRoomInvitePlayers(this.availableDuelLobbyPlayers);
      return;
    }

    this.isHost = true;
    this.roomCode = result.value.code;
    this.participantToken = result.value.participantToken;
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      this.roomCode,
      0,
      this.participantToken,
      undefined,
      1,
    );
    this.roomPlayerCount = 1;
    this.roomMaxPlayers = 4;
    this.lastKnownMatchNumber = 1;
    this.enterLobby();
  }

  private async loadPendingDuelInvitations(): Promise<void> {
    if (!this.scene.isActive() || this.pendingInvitation || this.busy) return;
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
    this.roomPlayerCount = result.value.playerCount;
    this.roomMaxPlayers = result.value.maxPlayers;
    this.world = getWorld(result.value.worldId);
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      this.roomCode,
      result.value.playerIndex,
      this.participantToken,
      undefined,
      result.value.playerCount,
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
    this.roomPlayerCount = result.value.playerCount;
    this.roomMaxPlayers = result.value.maxPlayers;
    ChallengeSystem.startOnline(
      this.world.id,
      result.value.seed,
      this.roomCode,
      result.value.playerIndex,
      this.participantToken,
      undefined,
      result.value.playerCount,
    );
    this.lastKnownMatchNumber = 1;
    this.enterLobby();
  }

  private async joinRoom(rawCode?: string): Promise<void> {
    if (this.busy) return;

    const raw = rawCode ?? this.codeInput?.getValue() ?? '';
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
    this.roomPlayerCount = result.value.playerCount;
    this.roomMaxPlayers = result.value.maxPlayers;
    this.world = getWorld(result.value.worldId);
    ChallengeSystem.startOnline(
      result.value.worldId,
      result.value.seed,
      code,
      result.value.playerIndex,
      this.participantToken,
      undefined,
      result.value.playerCount,
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
    this.roomPlayerCount = state.playerCount ?? 2;
    this.roomMaxPlayers = 4;
    this.world = getWorld(state.worldId);
  }

  private enterLobby(): void {
    this.clearTransient();
    this.statusPage.setStatus('', Palette.inkDim);

    this.buildHeading(
      'DUELL-LOBBY',
      this.isHost
        ? 'Du bist Host. Lade weitere Spieler ein oder starte ab zwei Spielern.'
        : 'Du bist beigetreten. Warte auf den Start durch den Host ...',
    );

    if (this.isHost) {
      this.keep(
        this.add
          .text(
            GAME_WIDTH / 2,
            this.statusPage.contentY(265),
            `Raum ${this.roomCode} · Einladungen sind direkt an Spieler gebunden`,
            textStyle(FontSize.tiny, Palette.inkDim),
          )
          .setOrigin(0.5)
          .setWordWrapWidth(GAME_WIDTH - 120)
          .setAlign('center'),
      );
    }

    const lobbyStatusY = this.isHost ? 310 : 390;
    const lobbyStatus = this.add
      .text(
        GAME_WIDTH / 2,
        this.statusPage.contentY(lobbyStatusY),
        'Lobby wird verbunden ...',
        textStyle(FontSize.small, Palette.ink),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(GAME_WIDTH - 140)
      .setAlign('center');
    this.keep(lobbyStatus);

    this.renderRoomLobby(
      ChallengeSystem.getState()?.online?.playerNames ?? [],
      this.roomPlayerCount,
      this.roomMaxPlayers,
    );

    if (this.isHost) this.renderRoomInvitePlayers(this.availableDuelLobbyPlayers);

    if (this.isHost) {
      const startButton = createButton(
        this,
        GAME_WIDTH / 2,
        this.statusPage.contentY(1000),
        'DUELL STARTEN',
        () => void this.startTalentDraft(lobbyStatus),
        { width: 460, accent: Palette.goldHex, fontSize: FontSize.large },
      );
      startButton.setEnabled(false);
      this.startRoomButton = startButton;
      this.keep(startButton.container);
    }

    this.buildBackToMenu('ABBRECHEN');

    void this.runLobbyFlow(lobbyStatus);
  }

  private renderRoomLobby(
    names: readonly (string | null)[],
    playerCount: number,
    maxPlayers: number,
  ): void {
    this.clearRoomLobbyObjects();
    const panelY = this.statusPage.contentY(this.isHost ? 470 : 580);
    this.keepRoomLobby(
      createPanel(this, GAME_WIDTH / 2, panelY, GAME_WIDTH - 120, 310, this.world.accent, {
        alpha: 0.55,
        radius: 20,
      }),
    );
    this.keepRoomLobby(
      this.add
        .text(
          GAME_WIDTH / 2,
          panelY - 118,
          `${Math.max(0, playerCount)}/${maxPlayers} SPIELER VERBUNDEN`,
          textStyle(FontSize.body, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setDepth(Depth.Overlay),
    );

    for (let index = 0; index < maxPlayers; index += 1) {
      const name = names[index] ?? 'Wartet auf Spieler ...';
      const isLocal = index === ChallengeSystem.getState()?.online?.localPlayerIndex;
      this.keepRoomLobby(
        this.add
          .text(
            GAME_WIDTH / 2,
            panelY - 64 + index * 56,
            `${index + 1}. ${name}${isLocal ? ' (Du)' : ''}`,
            textStyle(FontSize.small, name.startsWith('Wartet') ? Palette.inkDim : Palette.ink),
          )
          .setOrigin(0.5)
          .setDepth(Depth.Overlay),
      );
    }
  }

  /** Zeigt dem Host weiterhin die verfuegbaren Spieler fuer Einladungen. */
  private renderRoomInvitePlayers(players: NetworkDuelSystem.DuelLobbyPlayer[]): void {
    this.clearRoomInviteObjects();
    if (!this.scene.isActive() || !this.isHost || !this.roomCode) return;

    const visiblePlayers = players
      .filter((player) => player.availability === 'available')
      .slice(0, 4);
    const panelY = this.statusPage.contentY(790);
    this.keepRoomInvite(
      this.add
        .text(
          GAME_WIDTH / 2,
          this.statusPage.contentY(650),
          'WEITERE SPIELER EINLADEN',
          textStyle(FontSize.small, Palette.gold, { fontStyle: 'bold' }),
        )
        .setOrigin(0.5)
        .setDepth(Depth.Overlay),
    );
    this.keepRoomInvite(
      createPanel(this, GAME_WIDTH / 2, panelY, GAME_WIDTH - 120, 270, this.world.accent, {
        alpha: 0.4,
        radius: 20,
      }),
    );

    if (visiblePlayers.length === 0) {
      this.keepRoomInvite(
        this.add
          .text(
            GAME_WIDTH / 2,
            panelY,
            'Gerade ist niemand weiteres duellbereit.',
            textStyle(FontSize.small, Palette.inkDim),
          )
          .setOrigin(0.5)
          .setDepth(Depth.Overlay),
      );
      return;
    }

    visiblePlayers.forEach((player, index) => {
      const y = this.statusPage.contentY(710 + index * 54);
      this.keepRoomInvite(
        this.add
          .text(92, y, player.playerName, textStyle(FontSize.small, Palette.ink))
          .setOrigin(0, 0.5)
          .setDepth(Depth.Overlay),
      );
      const inviteButton = createButton(
        this,
        GAME_WIDTH - 145,
        y,
        'EINLADEN',
        () => void this.invitePlayer(player.playerName),
        { width: 170, height: 50, accent: 0x38bdf8, fontSize: FontSize.tiny },
      );
      this.keepRoomInvite(inviteButton.container);
    });
  }

  private async startTalentDraft(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (!this.isHost || this.busy || this.roomPlayerCount < 2) return;
    this.busy = true;
    this.startRoomButton?.setEnabled(false);
    statusText.setText('Talentphase wird gestartet ...').setColor(Palette.ink);
    const result = await NetworkDuelSystem.startTalentDraft(this.roomCode, this.participantToken);
    this.busy = false;
    if (!this.scene.isActive() || this.talentDraftStarted || this.runStarted) return;
    if (!result.ok) {
      statusText.setText(result.error).setColor(Palette.danger);
      this.startRoomButton?.setEnabled(this.roomPlayerCount >= 2);
      return;
    }
    this.beginInitialTalentDraft(statusText);
    NetworkDuelSystem.broadcastTalentDraftStarted(result.value);
  }

  private beginInitialTalentDraft(statusText: Phaser.GameObjects.Text): void {
    if (this.talentDraftStarted || this.runStarted || !this.scene.isActive()) return;
    this.talentDraftStarted = true;
    this.clearRoomLobbyObjects();
    this.clearRoomInviteObjects();
    if (this.startRoomButton) {
      const button = this.startRoomButton.container;
      this.transient = this.transient.filter((object) => object !== button);
      button.destroy();
      this.startRoomButton = null;
    }
    this.buildOnlineTalentDraft(statusText, 'TALENT-BUILD BESTAETIGEN', () => {
      void this.submitInitialTalentDraft(statusText);
    });
  }

  private async submitInitialTalentDraft(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (this.talentReadySubmitted || this.busy || !this.talentDraftStarted) return;
    this.busy = true;
    const localIndex =
      ChallengeSystem.getState()?.online?.localPlayerIndex ?? (this.isHost ? 0 : 1);
    const draft = ChallengeSystem.duelTalentDraftFor(localIndex);
    const result = await NetworkDuelSystem.submitTalentDraft(
      this.roomCode,
      draft,
      this.participantToken,
    );
    this.busy = false;
    if (!this.scene.isActive()) return;
    if (!result.ok) {
      this.talentDraftView?.setEnabled(true);
      this.draftConfirmButton?.setEnabled(true);
      statusText.setText(result.error).setColor(Palette.danger);
      return;
    }

    this.talentReadySubmitted = true;
    statusText.setText('Talent-Build gespeichert. Warte auf die anderen Spieler ...');
    void this.pollLobbyStatus(statusText);
  }

  private async startDuelAfterTalentDraft(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (
      !this.isHost ||
      !this.talentDraftStarted ||
      !this.talentReadySubmitted ||
      this.startTimeRequestStarted ||
      this.busy ||
      this.runStarted
    )
      return;

    this.startTimeRequestStarted = true;
    this.busy = true;
    statusText.setText('Duell wird gestartet ...').setColor(Palette.ink);
    const result = await NetworkDuelSystem.setStartTime(this.roomCode, this.participantToken);
    this.busy = false;
    if (!this.scene.isActive() || this.runStarted) return;
    if (!result.ok) {
      this.startTimeRequestStarted = false;
      statusText.setText(result.error).setColor(Palette.danger);
      return;
    }

    this.runStarted = true;
    NetworkDuelSystem.broadcastStartTime(result.value);
    this.beginRun(result.value);
  }

  /** Verbindet den Kanal, gleicht die Uhr ab und wartet auf den Host-Start. */
  private async runLobbyFlow(statusText: Phaser.GameObjects.Text): Promise<void> {
    const supabase = CloudSystem.getSupabaseClient();
    const challengeState = ChallengeSystem.getState();
    if (!supabase || !challengeState?.online) {
      statusText.setText('Kein Online-Dienst eingerichtet.').setColor(Palette.danger);
      return;
    }

    const localPlayerIndex = challengeState.online.localPlayerIndex;
    const sharedChannelKey = challengeState.seed;

    NetworkDuelSystem.subscribeToRoom(
      supabase,
      this.roomCode,
      localPlayerIndex,
      {
        onPresenceSync: (playerNames, isFullSync) => {
          ChallengeSystem.updateOnlinePlayerNames(playerNames, isFullSync);
          if (!this.talentDraftStarted) {
            this.renderRoomLobby(
              ChallengeSystem.getState()?.online?.playerNames ?? [],
              this.roomPlayerCount,
              this.roomMaxPlayers,
            );
          }
        },
        onTalentDraftStarted: () => {
          this.beginInitialTalentDraft(statusText);
        },
        onStartTimeSet: (startAtMs) => {
          if (this.runStarted || !this.scene.isActive()) return;
          this.runStarted = true;
          this.beginRun(startAtMs);
        },
        onOpponentDisconnected: () => {
          if (this.runStarted || !this.scene.isActive()) return;
          statusText.setText('Ein Spieler hat die Lobby verlassen.').setColor(Palette.danger);
        },
        onChannelError: (reason) => {
          if (this.runStarted || !this.scene.isActive()) return;
          statusText
            .setText(`Verbindungsfehler: ${reason}\nDie Lobby versucht es weiter ...`)
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
    if (!this.talentDraftStarted) {
      statusText.setText(
        this.isHost
          ? 'Warte auf mindestens einen weiteren Spieler ...'
          : 'Warte auf den Start durch den Host ...',
      );
    }
    this.startLobbyPolling(statusText);
    void this.pollLobbyStatus(statusText);
  }

  private startLobbyPolling(statusText: Phaser.GameObjects.Text): void {
    if (this.startPollTimer) return;
    this.startPollTimer = this.time.addEvent({
      delay: ONLINE_DUEL_START_POLL_INTERVAL_MS,
      loop: true,
      callback: () => void this.pollLobbyStatus(statusText),
    });
  }

  private async pollLobbyStatus(statusText: Phaser.GameObjects.Text): Promise<void> {
    if (this.runStarted || !this.scene.isActive()) return;
    const result = await NetworkDuelSystem.getRoomStatus(this.roomCode, this.participantToken);
    if (this.runStarted || !this.scene.isActive() || !result.ok || !result.value) return;

    this.roomPlayerCount = result.value.playerCount;
    this.roomMaxPlayers = result.value.maxPlayers;
    if (this.roomPlayerCount >= 2) {
      ChallengeSystem.updateOnlinePlayerCount(this.roomPlayerCount);
    }
    if (result.value.talentDraftStartedAtMs !== null && !this.talentDraftStarted) {
      this.beginInitialTalentDraft(statusText);
    }
    const names = ChallengeSystem.getState()?.online?.playerNames ?? [];
    if (!this.talentDraftStarted) {
      this.renderRoomLobby(names, this.roomPlayerCount, this.roomMaxPlayers);
    }
    this.startRoomButton?.setEnabled(this.isHost && this.roomPlayerCount >= 2);

    if (result.value.startAtMs !== null) {
      this.runStarted = true;
      this.beginRun(result.value.startAtMs);
      return;
    }

    if (this.talentDraftStarted) {
      statusText.setText(
        `${result.value.talentReadyCount}/${this.roomPlayerCount} Spieler haben ihren Talent-Build bestaetigt.`,
      );
      if (result.value.talentReadyCount >= this.roomPlayerCount) {
        void this.startDuelAfterTalentDraft(statusText);
      }
      return;
    }

    statusText.setText(
      this.isHost
        ? `${this.roomPlayerCount}/${this.roomMaxPlayers} Spieler verbunden. Host kann starten.`
        : `${this.roomPlayerCount}/${this.roomMaxPlayers} Spieler verbunden. Warte auf den Host ...`,
    );
  }

  private buildOnlineTalentDraft(
    statusText: Phaser.GameObjects.Text,
    buttonLabel: string,
    onConfirm: () => void,
  ): void {
    const localIndex =
      ChallengeSystem.getState()?.online?.localPlayerIndex ?? (this.isHost ? 0 : 1);
    const initialRanks = ChallengeSystem.duelTalentDraftFor(localIndex);
    const hasSuggestion = Object.values(initialRanks).some((rank) => rank > 0);
    const topY = this.statusPage.contentY(this.isHost ? 700 : 610);

    this.keep(
      this.add
        .text(
          GAME_WIDTH / 2,
          topY - 112,
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
      .text(GAME_WIDTH / 2, topY + 320, '', textStyle(FontSize.small, Palette.gold))
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

  private beginRun(startAtServerMs: number): void {
    // `runStarted` hier statt nur an den Aufrufstellen: `beginRun` ist der
    // einzige Weg in den Run.
    this.runStarted = true;
    this.cleanupLobby();
    ChallengeSystem.updateOnlinePlayerCount(this.roomPlayerCount);
    const state = ChallengeSystem.getState();
    ChallengeSystem.updateOnlineSync(state?.online?.clockOffsetMs ?? 0, startAtServerMs);
    this.scene.start(SceneKey.Game, { worldId: this.world.id, mode: 'challenge' });
  }

  private cleanupLobby(): void {
    // Der Raumkanal bleibt fuer GameScene und Ergebnis aktiv. Die alte globale
    // Direkt-Einladungslobby wird dagegen nicht mehr ueber die UI verwendet
    // und darf keine veralteten Presence-Eintraege hinterlassen.
    NetworkDuelSystem.unsubscribeFromDuelLobby();
    if (this.startPollTimer) {
      this.startPollTimer.remove();
      this.startPollTimer = null;
    }
    if (this.invitationPollTimer) {
      this.invitationPollTimer.remove();
      this.invitationPollTimer = null;
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
        ? 'Die anderen Spieler spielen noch ihre Runde.'
        : winner === null
          ? 'Punktgleich - das muss wiederholt werden.'
          : 'Gut gejagt.',
    );

    if (complete && state) {
      state.rounds.forEach((round, index) => {
        this.buildResultCard(round, index, winner === index);
      });

      if ((state.playerCount ?? 2) === 2) {
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
      } else {
        this.keep(
          this.add
            .text(
              GAME_WIDTH / 2,
              this.statusPage.contentY(930),
              'Fuer ein neues Mehrspieler-Duell eine neue Lobby erstellen.',
              textStyle(FontSize.small, Palette.inkDim),
            )
            .setOrigin(0.5)
            .setWordWrapWidth(GAME_WIDTH - 120)
            .setAlign('center'),
        );
      }
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
    const localIndex =
      ChallengeSystem.getState()?.online?.localPlayerIndex ?? (this.isHost ? 0 : 1);
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
    drafts?: TalentRanks[],
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

    const localIndex = ChallengeSystem.getState()?.online?.localPlayerIndex ?? 0;
    const playerResults = statusResult.value.playerResults;
    for (let index = 0; index < statusResult.value.playerCount; index += 1) {
      if (index === localIndex) continue;
      const result = playerResults[index];
      if (result) this.applyOpponentResult(index, result);
    }
  }

  /**
   * Traegt ein eingetroffenes Gegner-Ergebnis ein und baut den Bildschirm neu.
   *
   * Beide Wege (Broadcast und Polling) landen hier, koennen also dasselbe
   * Ergebnis doppelt liefern. Das ist unkritisch: `submitOnlineRound()`
   * schreibt an eine feste Position statt anzuhaengen, und der
   * `isComplete()`-Torwaechter verhindert einen zweiten Neuaufbau.
   */
  private applyOpponentResult(
    playerIndex: number,
    result: NetworkDuelSystem.DuelRoundResult,
  ): void {
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
    const playerCount = ChallengeSystem.getState()?.playerCount ?? 2;
    const compact = playerCount > 2;
    const y = this.statusPage.contentY((compact ? 350 : 420) + index * (compact ? 135 : 190));
    const cardHeight = compact ? 116 : 170;
    const color = isWinner ? Palette.goldHex : this.world.accent;
    this.keep(
      createPanel(this, GAME_WIDTH / 2, y, GAME_WIDTH - 120, cardHeight, color, {
        alpha: isWinner ? 0.75 : 0.45,
      }),
    );
    this.keep(
      this.add
        .text(
          104,
          y - (compact ? 32 : 50),
          ChallengeSystem.playerLabel(index),
          textStyle(
            compact ? FontSize.small : FontSize.body,
            isWinner ? Palette.gold : Palette.ink,
            {
              fontStyle: 'bold',
            },
          ),
        )
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(
          104,
          y + (compact ? 4 : 5),
          round.score.toLocaleString('de-DE'),
          textStyle(compact ? FontSize.body : FontSize.heading, Palette.ink, { fontStyle: 'bold' }),
        )
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(
          104,
          y + (compact ? 37 : 54),
          `${relics(round.totalCollected)}  ·  Kette ${round.bestCombo}`,
          textStyle(FontSize.tiny, Palette.inkDim),
        )
        .setOrigin(0, 0.5),
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
        () => void this.leaveDuelAndReturn(onBeforeMenu),
        { width: 300, height: 72, accent: 0x9aa3bd, fontSize: FontSize.small },
      ).container,
    );
  }

  /**
   * Beendet den serverseitigen Raum vor dem Wechsel ins Hauptmenue.
   *
   * Die Presence-Lobby und die Datenbank-Mitgliedschaft sind zwei getrennte
   * Zustaende. Nur den Realtime-Kanal zu schliessen liess die beiden Spieler
   * zwar wieder sichtbar werden, hielt ihre Profile aber bis zum Raum-Timeout
   * blockiert. Der Await ist absichtlich vor `scene.start(Menu)`, damit ein
   * direkt anschliessend gestartetes Duell nicht gegen den alten Raum laeuft.
   */
  private async leaveDuelAndReturn(onBeforeMenu?: () => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.statusPage.setStatus('Duell wird verlassen ...', Palette.inkDim);

    if (this.roomCode && this.participantToken) {
      await NetworkDuelSystem.leaveRoom(this.roomCode, this.participantToken);
    }
    if (!this.scene.isActive()) return;

    onBeforeMenu?.();
    this.cancelOutgoingInvitation();
    NetworkDuelSystem.unsubscribeFromRoom();
    NetworkDuelSystem.unsubscribeFromDuelLobby();
    this.clearInvitationPrompt();
    ChallengeSystem.clear();
    this.scene.start(SceneKey.Menu);
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

  private keepRoomLobby(object: Phaser.GameObjects.GameObject): void {
    this.keep(object);
    this.roomLobbyObjects.push(object);
  }

  private clearRoomLobbyObjects(): void {
    if (this.roomLobbyObjects.length === 0) return;
    const objects = new Set(this.roomLobbyObjects);
    for (const object of this.roomLobbyObjects) object.destroy();
    this.transient = this.transient.filter((object) => !objects.has(object));
    this.roomLobbyObjects = [];
  }

  private keepRoomInvite(object: Phaser.GameObjects.GameObject): void {
    this.keep(object);
    this.roomInviteObjects.push(object);
  }

  private clearRoomInviteObjects(): void {
    if (this.roomInviteObjects.length === 0) return;
    const objects = new Set(this.roomInviteObjects);
    for (const object of this.roomInviteObjects) object.destroy();
    this.transient = this.transient.filter((object) => !objects.has(object));
    this.roomInviteObjects = [];
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
    const invitationIds = this.outgoingInvitationIds;
    this.outgoingInvitationIds = [];
    for (const invitationId of invitationIds) {
      void NetworkDuelSystem.cancelDuelInvitation(invitationId);
    }
  }

  private clearTransient(): void {
    if (this.talentDraftTimer) {
      this.talentDraftTimer.remove();
      this.talentDraftTimer = null;
    }
    for (const object of this.transient) object.destroy();
    this.transient = [];
    this.duelLobbyObjects = [];
    this.roomLobbyObjects = [];
    this.roomInviteObjects = [];
    this.invitationObjects = [];
    this.pendingInvitation = null;
    this.invitationStatusText = null;
    this.codeInput = null;
    this.talentDraftView = null;
    this.draftConfirmButton = null;
  }
}
